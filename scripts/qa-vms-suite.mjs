import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectDir, "public");
const adminDir = path.join(publicDir, "admin");
const portalDir = path.join(publicDir, "portal");
const errors = [];
const warnings = [];
let buttonCount = 0;
let linkCount = 0;
let scriptCount = 0;

const decodeEntities = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&#38;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&#39;", "'");

const stripCode = (html) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

const allHtmlFiles = async (dir) => (await readdir(dir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => path.join(dir, entry.name));

const targetForHref = (htmlFile, rawHref) => {
  const decoded = decodeEntities(rawHref).trim();
  if (!decoded || decoded.startsWith("#") || decoded.includes("${")) return null;
  if (/^(https?:|mailto:|tel:|data:|blob:|about:)/i.test(decoded)) return null;
  if (/^javascript:/i.test(decoded)) return { error: "javascript: links are not allowed" };

  const clean = decoded.split("#")[0].split("?")[0];
  if (!clean) return null;
  if (clean === "/" || clean.startsWith("/staff-login")) return null;

  let target = clean.startsWith("/")
    ? path.join(publicDir, clean.replace(/^\/+/, ""))
    : path.resolve(path.dirname(htmlFile), clean);
  if (clean.endsWith("/")) target = path.join(target, "index.html");
  return { target };
};

const files = [...await allHtmlFiles(adminDir), ...await allHtmlFiles(portalDir)];

for (const file of files) {
  const label = path.relative(publicDir, file);
  const html = await readFile(file, "utf8");
  const markup = stripCode(html);

  if (!/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
    errors.push(`${label}: missing noindex protection`);
  }

  const ids = [...markup.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) errors.push(`${label}: duplicate IDs: ${duplicateIds.join(", ")}`);

  const buttons = [...markup.matchAll(/<button\b([^>]*)>/gi)];
  buttonCount += buttons.length;
  const missingTypes = buttons.filter((match) => !/\btype\s*=/.test(match[1])).length;
  if (missingTypes) warnings.push(`${label}: ${missingTypes} button(s) rely on the browser default type`);

  const hrefs = [...html.matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => match[1]);
  linkCount += hrefs.length;
  for (const href of hrefs) {
    const resolution = targetForHref(file, href);
    if (!resolution) continue;
    if (resolution.error) {
      errors.push(`${label}: ${resolution.error} (${href})`);
      continue;
    }
    try {
      await access(resolution.target);
    } catch {
      errors.push(`${label}: broken local link ${decodeEntities(href)} -> ${path.relative(publicDir, resolution.target)}`);
    }
  }

  if (/href=["']clients\.html["']/i.test(html)) errors.push(`${label}: legacy clients.html route remains`);
  if (/Service-Catalog\(1\)\.html/i.test(html)) errors.push(`${label}: obsolete Service-Catalog(1).html route remains`);

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1];
    const source = match[2];
    if (/\bsrc\s*=/.test(attributes) || /type=["'](?:application\/ld\+json|application\/json|text\/template)["']/i.test(attributes) || !source.trim()) continue;
    scriptCount += 1;
    try {
      new vm.Script(source, { filename: `${label}:inline-${scriptCount}` });
    } catch (error) {
      errors.push(`${label}: inline script syntax error — ${error.message}`);
    }
  }
}

const requiredAdminFiles = [
  "index.html",
  "dashboard.html",
  "VMS-Audit.html",
  "vms_qr_tools_FINAL_MOBILE_FIXED.html",
  "Client-Directory.html",
  "Service-Catalog.html",
  "Billing&Subscriptions.html",
  "Promotions.html",
  "Projects&Request.html",
  "Files&Assets.html",
  "Notification&Activities.html",
  "VMS-LinkHub.html",
];
for (const file of requiredAdminFiles) {
  try { await access(path.join(adminDir, file)); } catch { errors.push(`Missing Admin deployment file: ${file}`); }
}

try {
  await access(path.join(portalDir, "index.html"));
  const portal = await readFile(path.join(portalDir, "index.html"), "utf8");
  if (!portal.includes("/api/portal/session")) errors.push("Client Portal session gate is missing");
} catch {
  errors.push("Missing Client Portal deployment entry point");
}

try {
  await esbuild({
    entryPoints: [
      path.join(projectDir, "netlify/functions/checkups.ts"),
      path.join(projectDir, "netlify/functions/client-login-link.ts"),
      path.join(projectDir, "netlify/functions/portal-session.ts"),
      path.join(projectDir, "netlify/functions/admin-session.ts"),
      path.join(projectDir, "netlify/functions/admin-logout.ts"),
    ],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    outdir: "/tmp/vms-function-qa",
    write: false,
    logLevel: "silent",
  });
} catch (error) {
  errors.push(`Netlify function build failed: ${error.message}`);
}

console.log(`QA inspected ${files.length} HTML files, ${linkCount} links, ${buttonCount} buttons, and ${scriptCount} inline scripts.`);
if (warnings.length) console.log(`Warnings (${warnings.length}):\n- ${warnings.join("\n- ")}`);
if (errors.length) {
  console.error(`Errors (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("PASS: deployment routes, local links, IDs, inline JavaScript, and Netlify functions passed the automated sweep.");
}
