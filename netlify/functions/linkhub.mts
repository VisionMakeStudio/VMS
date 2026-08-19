import type { Config, Context } from "@netlify/functions";
import { jsonError, requireUser, supabaseEnv } from "./_shared/auth.mts";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function slugify(value: unknown) {
  return String(value || "vms-linkhub")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "vms-linkhub";
}

function safeHex(value: unknown, fallback: string) {
  const v = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

function safeHttp(value: unknown) {
  const v = String(value || "").trim();
  if (!v) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return /^https?:$/.test(u.protocol) ? u.href : "";
  } catch { return ""; }
}

function socialHref(platform: unknown, value: unknown) {
  const p = String(platform || "").toLowerCase();
  const v = String(value || "").trim();
  if (!v) return "";
  if (p === "email") return `mailto:${v.replace(/^mailto:/i, "")}`;
  if (p === "phone") return `tel:${v.replace(/^tel:/i, "")}`;
  if (p === "whatsapp" && !/^https?:/i.test(v)) return `https://wa.me/${v.replace(/\D/g, "")}`;
  return safeHttp(v);
}

function iconSvg(platform: unknown) {
  const p = String(platform || "").toLowerCase();
  const common = 'viewBox="0 0 24 24" aria-hidden="true"';
  const map: Record<string, string> = {
    instagram:`<svg ${common}><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.6" r="1.2" fill="currentColor"/></svg>`,
    facebook:`<svg ${common}><path fill="currentColor" d="M13.8 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.6 1.7-1.6H17V3.8c-.4-.1-1.3-.2-2.4-.2-2.4 0-4 1.5-4 4.2V10H8v3h2.6v8h3.2z"/></svg>`,
    whatsapp:`<svg ${common}><path d="M20 11.7a8 8 0 0 1-11.8 7l-4 .9 1-3.9A8 8 0 1 1 20 11.7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.1 7.8c.3-.4.6-.3.9-.1l1.1 1.4c.2.3.2.5 0 .8l-.6.8c.8 1.6 1.8 2.6 3.5 3.4l.8-.7c.3-.2.5-.2.8 0l1.3 1c.3.2.4.5.2.8-.5.9-1.4 1.5-2.4 1.4-3.3-.4-7-4-7.3-7.4-.1-.5.4-1.1.7-1.4Z" fill="currentColor"/></svg>`,
    tiktok:`<svg ${common}><path d="M14.2 3v11.3a4.3 4.3 0 1 1-3.3-4.2v2.7a1.8 1.8 0 1 0 .8 1.5V3h2.5Zm0 0c.6 2.4 2.1 3.8 4.5 4.1v2.6c-2-.1-3.5-.8-4.5-1.8V3Z" fill="currentColor"/></svg>`,
    youtube:`<svg ${common}><rect x="2.8" y="6" width="18.4" height="12" rx="4" fill="currentColor"/><path d="m10 9 6 3-6 3V9Z" fill="white"/></svg>`,
    x:`<svg ${common}><path d="M5 4 19 20M19 4 5 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    linkedin:`<svg ${common}><rect x="4" y="9" width="3.3" height="10" rx=".6" fill="currentColor"/><circle cx="5.65" cy="5.7" r="1.8" fill="currentColor"/><path d="M10 9h3.2v1.4c.8-1.1 1.9-1.7 3.4-1.7 2.8 0 3.9 1.8 3.9 5V19h-3.3v-4.7c0-1.7-.4-2.8-1.9-2.8-1.7 0-2.1 1.3-2.1 3V19H10V9Z" fill="currentColor"/></svg>`,
    email:`<svg ${common}><rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
    phone:`<svg ${common}><path d="M6.2 3.8 9 3l2 4.6-1.8 1.3c1.1 2.4 2.6 3.9 5 5l1.3-1.8 4.6 2-.8 2.8c-.3 1.1-1.3 1.8-2.4 1.7-6.5-.8-11.8-6-12.5-12.5-.1-1.1.7-2.1 1.8-2.3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    website:`<svg ${common}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 12h17M12 3c2.2 2.3 3.2 5.3 3.2 9S14.2 18.7 12 21M12 3c-2.2 2.3-3.2 5.3-3.2 9S9.8 18.7 12 21" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
  };
  return map[p] || map.website;
}

function cleanPublishedData(input: any) {
  const data = input && typeof input === "object" && !Array.isArray(input) ? JSON.parse(JSON.stringify(input)) : {};
  for (const key of Object.keys(data)) if (key.startsWith("_")) delete data[key];
  return data;
}

async function rest(path: string, init: RequestInit = {}) {
  const { url, serviceKey } = supabaseEnv();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw Object.assign(new Error(`LinkHub database request failed (${res.status}).`), { status: 502 });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function clientForEmail(email: string) {
  const rows = await rest(`clients?owner_email=ilike.${encodeURIComponent(email)}&select=id,business_name,owner_email&limit=1`);
  return Array.isArray(rows) ? rows[0] : null;
}

async function pageForClient(clientId: string) {
  const rows = await rest(`linkhub_pages?client_id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`);
  return Array.isArray(rows) ? rows[0] : null;
}

function pageUrl(req: Request, slug: string) {
  const u = new URL(req.url);
  return `${u.origin}/link/${encodeURIComponent(slug)}`;
}

function renderPublic(data: any, slug: string) {
  const style = data?.style || {};
  const bg = safeHex(style.bg, "#003049");
  const text = safeHex(style.text, "#FFFFFF");
  const button = safeHex(style.button, "#FFFFFF");
  const buttonText = safeHex(style.buttonText, "#003049");
  const name = esc(data?.businessName || data?.restaurant?.name || "VMS LinkHub");
  const title = esc(data?.title || "");
  const bio = esc(data?.bio || "");
  const photo = String(data?.photoData || "");
  const photoSafe = /^(data:image\/(?:png|jpeg|jpg|webp);base64,|https?:\/\/)/i.test(photo) ? photo : "";
  const links = (Array.isArray(data?.links) ? data.links : []).filter((x: any) => x?.visible !== false && x?.label);
  const socials = (Array.isArray(data?.socials) ? data.socials : []).filter((x: any) => x?.visible !== false && x?.url);
  const contact: string[] = [];
  if (data?.phone) contact.push(`<a href="tel:${esc(String(data.phone).replace(/^tel:/i, ""))}">Call</a>`);
  if (data?.email) contact.push(`<a href="mailto:${esc(String(data.email).replace(/^mailto:/i, ""))}">Email</a>`);
  const website = safeHttp(data?.website);
  if (website) contact.push(`<a href="${esc(website)}" target="_blank" rel="noopener">Website</a>`);
  const map = safeHttp(data?.mapUrl || data?.visit?.mapsUrl || data?.restaurant?.mapsUrl);
  if (map) contact.push(`<a href="${esc(map)}" target="_blank" rel="noopener">Directions</a>`);

  const linkHtml = links.map((l: any) => {
    const href = safeHttp(l.url) || "#";
    return `<a class="main-link" href="${esc(href)}" ${href === "#" ? "" : 'target="_blank" rel="noopener"'}>${esc(l.label)}</a>`;
  }).join("");
  const socialHtml = socials.map((s: any) => {
    const href = socialHref(s.platform, s.url);
    if (!href) return "";
    return `<a class="social" href="${esc(href)}" ${/^https?:/i.test(href) ? 'target="_blank" rel="noopener"' : ""} aria-label="${esc(s.label || s.platform)}" title="${esc(s.label || s.platform)}">${iconSvg(s.platform)}</a>`;
  }).join("");

  const wifi = data?.wifi || {};
  const wifiHtml = wifi?.enabled ? `<details class="feature"><summary>Wi‑Fi</summary><div class="feature-body"><b>${esc(wifi.ssid || "Wi‑Fi Network")}</b><span>${esc(wifi.security || "")}</span>${wifi.password ? `<div class="password-row"><code id="wifiPass">${esc(wifi.password)}</code><button type="button" id="copyWifi">Copy password</button></div>` : ""}<small>Open Wi‑Fi settings on your device, choose the network above, then enter the password.</small></div></details>` : "";

  const r = data?.restaurant || {};
  const menuSections = (Array.isArray(r.sections) ? r.sections : []).filter((s: any) => s?.visible !== false);
  const menuHtml = r?.enabled ? `<details class="feature"><summary>${esc(r.name || "Restaurant Menu")}</summary><div class="feature-body restaurant"><h3>${esc(r.name || name)}</h3>${r.cuisine ? `<p>${esc(r.cuisine)}</p>` : ""}${r.description ? `<p>${esc(r.description)}</p>` : ""}${menuSections.map((sec: any) => `<section><h4>${esc(sec.name)}</h4>${(Array.isArray(sec.items) ? sec.items : []).filter((i: any) => i?.visible !== false).map((i: any) => `<div class="menu-item"><div><b>${esc(i.name)}</b>${i.description ? `<span>${esc(i.description)}</span>` : ""}</div>${r.showPrices !== false && (i.price !== "" && i.price != null) ? `<strong>$${Number(i.price).toFixed(2)}</strong>` : i.priceLabel ? `<strong>${esc(i.priceLabel)}</strong>` : ""}</div>`).join("")}</section>`).join("")}</div></details>` : "";

  const visit = data?.visit || {};
  const visitHtml = visit?.enabled ? `<details class="feature"><summary>Visit Us</summary><div class="feature-body"><b>${esc(visit.name || name)}</b>${visit.category ? `<span>${esc(visit.category)}</span>` : ""}${visit.address ? `<p>${esc(visit.address)}</p>` : ""}${visit.hours ? `<p>${esc(typeof visit.hours === "string" ? visit.hours : JSON.stringify(visit.hours))}</p>` : ""}${safeHttp(visit.mapsUrl) ? `<a class="mini-link" href="${esc(safeHttp(visit.mapsUrl))}" target="_blank" rel="noopener">Open in Maps</a>` : ""}</div></details>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${name} — VMS LinkHub</title><meta name="robots" content="index,follow"><style>
    :root{--bg:${bg};--text:${text};--button:${button};--buttonText:${buttonText}}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{background:var(--bg);color:var(--text);padding:24px 14px 40px}.page{width:min(620px,100%);margin:0 auto}.profile{text-align:center;padding:16px 8px}.avatar{width:96px;height:96px;border-radius:50%;margin:0 auto 14px;background:rgba(255,255,255,.15);display:grid;place-items:center;overflow:hidden;font-weight:1000;font-size:28px}.avatar img{width:100%;height:100%;object-fit:cover}.profile h1{font-size:25px;margin:0}.profile .title{font-size:12px;opacity:.82;margin:6px 0 0}.profile .bio{font-size:11px;line-height:1.55;opacity:.78;margin:7px auto 0;max-width:480px}.contacts,.socials{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:12px 0}.contacts a{color:var(--text);text-decoration:none;border:1px solid color-mix(in srgb,var(--text) 24%,transparent);border-radius:999px;padding:8px 11px;font-size:10px;font-weight:800}.links{display:grid;gap:10px;margin:18px 0}.main-link{display:flex;min-height:54px;align-items:center;justify-content:center;text-align:center;padding:10px 14px;border-radius:14px;background:var(--button);color:var(--buttonText);text-decoration:none;font-size:12px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.08)}.social{width:43px;height:43px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--button) 15%,transparent);color:var(--text);border:1px solid color-mix(in srgb,var(--text) 18%,transparent);text-decoration:none}.social svg{width:20px;height:20px}.features{display:grid;gap:9px;margin-top:16px}.feature{border:1px solid color-mix(in srgb,var(--text) 18%,transparent);border-radius:14px;background:color-mix(in srgb,var(--bg) 88%,white 12%);overflow:hidden}.feature summary{cursor:pointer;padding:14px;font-size:11px;font-weight:900;list-style:none}.feature summary::-webkit-details-marker{display:none}.feature-body{padding:0 14px 14px;display:grid;gap:7px;font-size:10px;line-height:1.5}.feature-body span,.feature-body small,.feature-body p{opacity:.78;margin:0}.password-row{display:flex;gap:8px;align-items:center}.password-row code{flex:1;padding:9px;border-radius:9px;background:rgba(255,255,255,.13);overflow-wrap:anywhere}.password-row button,.mini-link{border:0;border-radius:9px;background:var(--button);color:var(--buttonText);padding:9px 10px;font-size:9px;font-weight:900;text-decoration:none}.restaurant section{padding-top:8px;border-top:1px solid color-mix(in srgb,var(--text) 13%,transparent)}.restaurant h3,.restaurant h4{margin:0}.menu-item{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--text) 9%,transparent)}.menu-item div{display:grid;gap:2px}.menu-item span{font-size:9px}.powered{text-align:center;font-size:9px;opacity:.55;margin-top:24px}.powered a{color:inherit}.unavailable{text-align:center;padding:80px 20px}.unavailable h1{font-size:24px}.unavailable p{font-size:12px;opacity:.75}
  </style></head><body><main class="page"><section class="profile"><div class="avatar">${photoSafe ? `<img src="${esc(photoSafe)}" alt="${name}">` : esc(String(data?.businessName || "VMS").slice(0,2).toUpperCase())}</div><h1>${name}</h1>${title ? `<p class="title">${title}</p>` : ""}${bio ? `<p class="bio">${bio}</p>` : ""}<div class="contacts">${contact.join("")}</div></section><div class="links">${linkHtml || `<div style="text-align:center;font-size:11px;opacity:.7">More links coming soon.</div>`}</div>${socialHtml ? `<div class="socials">${socialHtml}</div>` : ""}<div class="features">${wifiHtml}${menuHtml}${visitHtml}</div><div class="powered">VMS LinkHub · Smart Business Card by <a href="https://visionmakestudio.com" target="_blank" rel="noopener">Vision Make Studio</a></div></main><script>document.getElementById('copyWifi')?.addEventListener('click',async()=>{const v=document.getElementById('wifiPass')?.textContent||'';try{await navigator.clipboard.writeText(v);document.getElementById('copyWifi').textContent='Copied'}catch{}});</script></body></html>`;
}

export default async (req: Request, context: Context) => {
  try {
    const u = new URL(req.url);
    const publicRoute = u.pathname.startsWith("/link/");

    if (publicRoute) {
      if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
      const slug = decodeURIComponent(u.pathname.replace(/^\/link\//, "").split("/")[0] || "").trim().toLowerCase();
      if (!slug) return new Response("LinkHub not found", { status: 404 });
      const rows = await rest(`linkhub_pages?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=slug,published_data,published_at&limit=1`);
      const page = Array.isArray(rows) ? rows[0] : null;
      if (!page) return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#003049;color:white;font-family:system-ui;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px"><div><h1>LinkHub unavailable</h1><p>This LinkHub has not been published or the link is no longer available.</p></div></body>`, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      return new Response(renderPublic(page.published_data || {}, page.slug), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
    }

    if (u.pathname !== "/api/linkhub") return new Response("Not found", { status: 404 });

    if (req.method === "GET") {
      if (u.searchParams.get("mine") !== "1") return Response.json({ error: "Missing LinkHub request." }, { status: 400 });
      const user = await requireUser(req);
      const email = String(user.email || "").trim().toLowerCase();
      const client = await clientForEmail(email);
      if (!client) return Response.json({ error: "Your VMS client account was not found." }, { status: 404 });
      const page = await pageForClient(client.id);
      const slug = page?.slug || `${slugify(client.business_name)}-${String(client.id).replace(/-/g, "").slice(0, 6)}`;
      return Response.json({
        ok: true,
        slug,
        url: pageUrl(req, slug),
        status: page?.status || "draft",
        publishedAt: page?.published_at || null,
        publishedData: page?.published_data && Object.keys(page.published_data).length ? page.published_data : null,
      });
    }

    if (req.method === "POST") {
      const user = await requireUser(req);
      const email = String(user.email || "").trim().toLowerCase();
      const client = await clientForEmail(email);
      if (!client) return Response.json({ error: "Your VMS client account was not found." }, { status: 404 });
      const body: any = await req.json();
      if (body?.action !== "publish") return Response.json({ error: "Unsupported LinkHub action." }, { status: 400 });
      const data = cleanPublishedData(body?.data);
      const serialized = JSON.stringify(data);
      if (serialized.length > 2_000_000) return Response.json({ error: "This LinkHub is too large to publish. Reduce oversized images and try again." }, { status: 413 });
      if (!String(data?.businessName || "").trim()) return Response.json({ error: "Add a business or display name before publishing." }, { status: 400 });
      const existing = await pageForClient(client.id);
      const slug = existing?.slug || `${slugify(client.business_name || data.businessName)}-${String(client.id).replace(/-/g, "").slice(0, 6)}`;
      const now = new Date().toISOString();
      const rows = await rest(`linkhub_pages?on_conflict=client_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ client_id: client.id, slug, draft_data: data, published_data: data, status: "published", published_at: now, updated_at: now }),
      });
      const saved = Array.isArray(rows) ? rows[0] : null;
      return Response.json({ ok: true, slug, url: pageUrl(req, slug), status: "published", publishedAt: saved?.published_at || now, publishedData: data });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error: any) {
    console.error("VMS LinkHub function failed", error);
    return jsonError(error);
  }
};

export const config: Config = { path: ["/api/linkhub", "/link/*"] };
