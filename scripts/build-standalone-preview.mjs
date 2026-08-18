import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const scratchRoot = resolve(projectRoot, "../..");
const bundlePath = resolve(projectRoot, ".standalone-preview.js");
const outputPath = resolve(scratchRoot, "VMS-Public-Website-Preview.html");
const localPreviewPath = resolve(projectRoot, "VMS-Public-Website-Preview.html");

execFileSync(
  resolve(projectRoot, "node_modules/.bin/esbuild"),
  [
    resolve(projectRoot, "src/standalone-entry.jsx"),
    "--bundle",
    "--format=iife",
    "--platform=browser",
    "--jsx=automatic",
    "--minify",
    `--outfile=${bundlePath}`,
  ],
  { cwd: projectRoot, stdio: "inherit" },
);

const asDataUrl = (filePath, mimeType) =>
  `data:${mimeType};base64,${readFileSync(filePath).toString("base64")}`;

const logo = asDataUrl(resolve(projectRoot, "public/assets/vms-logo.png"), "image/png");
const motif = asDataUrl(resolve(projectRoot, "public/assets/vms-hero-motif.png"), "image/png");
const inter = asDataUrl(
  resolve(projectRoot, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"),
  "font/woff2",
);

let css = readFileSync(resolve(projectRoot, "src/styles.css"), "utf8");
css = css.replaceAll('url("/assets/vms-hero-motif.png")', `url("${motif}")`);

let javascript = readFileSync(bundlePath, "utf8");
javascript = javascript
  .replaceAll("/assets/vms-logo.png", logo)
  .replaceAll("</script", "<\\/script");

execFileSync(process.execPath, ["--check", bundlePath], { stdio: "inherit" });

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#003049" />
    <meta name="description" content="Vision Make Studio interactive public website preview." />
    <title>Vision Make Studio — Interactive Website Preview</title>
    <style>
      @font-face {
        font-family: "Inter Variable";
        src: url("${inter}") format("woff2");
        font-style: normal;
        font-weight: 100 900;
        font-display: swap;
      }
      ${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>${javascript}</script>
  </body>
</html>
`;

writeFileSync(outputPath, html);
writeFileSync(localPreviewPath, html);
rmSync(bundlePath, { force: true });
console.log(`Standalone preview written to ${outputPath}`);
