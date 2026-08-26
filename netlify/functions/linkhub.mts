import type { Config, Context } from "@netlify/functions";

type Json = Record<string, any>;

function env(name: string) {
  return Netlify.env.get(name) || "";
}

function supabasePublicEnv() {
  const url = env("SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !publishableKey) {
    throw Object.assign(new Error("LinkHub server configuration is incomplete."), { status: 503 });
  }
  return { url: url.replace(/\/$/, ""), publishableKey };
}

function jsonError(error: any) {
  const status = Number(error?.status) || 500;
  return Response.json({ error: error?.message || "Request failed." }, { status });
}

function bearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    throw Object.assign(new Error("Sign-in required."), { status: 401 });
  }
  return auth;
}

async function sbRest(path: string, options: {
  token?: string;
  method?: string;
  body?: any;
  prefer?: string;
} = {}) {
  const { url, publishableKey } = supabasePublicEnv();
  const headers: Record<string, string> = {
    apikey: publishableKey,
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = options.token;
  if (options.prefer) headers.Prefer = options.prefer;

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const raw = await res.text();
  let payload: any = null;
  if (raw) {
    try { payload = JSON.parse(raw); }
    catch { payload = raw; }
  }

  if (!res.ok) {
    const message = payload?.message || payload?.error_description || payload?.error || `LinkHub database request failed (${res.status}).`;
    const status = res.status === 401 || res.status === 403 ? 401 : res.status >= 500 ? 502 : res.status;
    throw Object.assign(new Error(message), { status });
  }
  return payload;
}

async function sbAdmin(path: string, options: { method?: string; body?: any; prefer?: string } = {}) {
  const { url } = supabasePublicEnv();
  const secret = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw Object.assign(new Error("LinkHub analytics is not configured."), { status: 503 });
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await res.text();
  const payload = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : null;
  if (!res.ok) throw Object.assign(new Error(payload?.message || `LinkHub analytics request failed (${res.status}).`), { status: 502 });
  return payload;
}

function analyticsSummary(events: any[]) {
  const views = events.filter((event) => event.event_type === "linkhub_view").length;
  const clicks = events.filter((event) => event.event_type === "linkhub_click").length;
  return {
    views,
    clicks,
    recent: events.slice(0, 30).map((event) => ({
      type: event.event_type === "linkhub_view" ? "view" : "click",
      label: event.metadata?.label || event.title || (event.event_type === "linkhub_view" ? "LinkHub viewed" : "Link clicked"),
      kind: event.metadata?.kind || "",
      at: event.created_at,
    })),
  };
}

async function currentClient(req: Request) {
  const token = bearer(req);
  const rows = await sbRest("clients?select=id,business_name,owner_email&limit=1", { token });
  const client = Array.isArray(rows) ? rows[0] : null;
  if (!client) throw Object.assign(new Error("Your VMS client account was not found."), { status: 404 });
  return { token, client };
}

async function ownPage(clientId: string, token: string) {
  const rows = await sbRest(`linkhub_pages?client_id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`, { token });
  return Array.isArray(rows) ? rows[0] : null;
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c] || c));
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
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  const map: Record<string, string> = {
    instagram:`<svg ${common}><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.6" r="1.2" fill="currentColor"/></svg>`,
    facebook:`<svg ${common}><path fill="currentColor" d="M13.8 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.6 1.7-1.6H17V3.8c-.4-.1-1.3-.2-2.4-.2-2.4 0-4 1.5-4 4.2V10H8v3h2.6v8h3.2z"/></svg>`,
    whatsapp:`<svg ${common}><path d="M20 11.7a8 8 0 0 1-11.8 7l-4 .9 1-3.9A8 8 0 1 1 20 11.7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.1 7.8c.3-.4.6-.3.9-.1l1.1 1.4c.2.3.2.5 0 .8l-.6.8c.8 1.6 1.8 2.6 3.5 3.4l.8-.7c.3-.2.5-.2.8 0l1.3 1c.3.2.4.5.2.8-.5.9-1.4 1.5-2.4 1.4-3.3-.4-7-4-7.3-7.4-.1-.5.4-1.1.7-1.4Z" fill="currentColor"/></svg>`,
    tiktok:`<svg ${common}><path d="M14.2 3v11.3a4.3 4.3 0 1 1-3.3-4.2v2.7a1.8 1.8 0 1 0 .8 1.5V3h2.5Zm0 0c.6 2.4 2.1 3.8 4.5 4.1v2.6c-2-.1-3.5-.8-4.5-1.8V3Z" fill="currentColor"/></svg>`,
    youtube:`<svg ${common}><rect x="2.8" y="6" width="18.4" height="12" rx="4" fill="currentColor"/><path d="m10 9 6 3-6 3V9Z" fill="white"/></svg>`,
    x:`<svg ${common} fill="currentColor"><path d="M18.6 3H22l-7.4 8.5L23.3 21h-6.8l-5.3-7-6.1 7H1.7l7.9-9.1L1.3 3h7l4.8 6.4L18.6 3zm-1.2 16.3h1.9L7.3 4.6H5.2l12.2 14.7z"/></svg>`,
    linkedin:`<svg ${common}><rect x="4" y="9" width="3.3" height="10" rx=".6" fill="currentColor"/><circle cx="5.65" cy="5.7" r="1.8" fill="currentColor"/><path d="M10 9h3.2v1.4c.8-1.1 1.9-1.7 3.4-1.7 2.8 0 3.9 1.8 3.9 5V19h-3.3v-4.7c0-1.7-.4-2.8-1.9-2.8-1.7 0-2.1 1.3-2.1 3V19H10V9Z" fill="currentColor"/></svg>`,
    email:`<svg ${common}><rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
    phone:`<svg ${common}><path d="M6.2 3.8 9 3l2 4.6-1.8 1.3c1.1 2.4 2.6 3.9 5 5l1.3-1.8 4.6 2-.8 2.8c-.3 1.1-1.3 1.8-2.4 1.7-6.5-.8-11.8-6-12.5-12.5-.1-1.1.7-2.1 1.8-2.3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    website:`<svg ${common}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 12h17M12 3c2.2 2.3 3.2 5.3 3.2 9S14.2 18.7 12 21M12 3c-2.2 2.3-3.2 5.3-3.2 9S9.8 18.7 12 21" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
  };
  return map[p] || map.website;
}

function cleanPublishedData(input: any) {
  const data = input && typeof input === "object" && !Array.isArray(input)
    ? JSON.parse(JSON.stringify(input)) : {};
  for (const key of Object.keys(data)) if (key.startsWith("_")) delete data[key];
  return data;
}

function pageUrl(req: Request, slug: string) {
  const u = new URL(req.url);
  return `${u.origin}/link/${encodeURIComponent(slug)}`;
}

function formatHours(hours: any) {
  if (!hours) return "";
  if (typeof hours === "string") return esc(hours);
  if (!Array.isArray(hours)) return "";
  return hours.map((row: any) => {
    const day = esc(row?.day || row?.label || "");
    const value = row?.closed ? "Closed" : [row?.open, row?.close].filter(Boolean).map(esc).join(" – ");
    return day && value ? `<div class="hour"><span>${day}</span><b>${value}</b></div>` : "";
  }).join("");
}

function renderPublic(data: any, slug: string) {
  const style = data?.style || {};
  const gradient = style?.gradient;
  const gradientA = safeHex(gradient?.a, "");
  const gradientB = safeHex(gradient?.b, "");
  const gradientDir = /^(?:45|90|145|180)deg$/.test(String(gradient?.dir || "")) ? String(gradient.dir) : "145deg";
  const bg = gradientA && gradientB ? `linear-gradient(${gradientDir},${gradientA},${gradientB})` : safeHex(style.bg, "#003049");
  const text = safeHex(style.text, "#FFFFFF");
  const button = safeHex(style.button, "#FFFFFF");
  const buttonText = safeHex(style.buttonText, "#003049");
  const name = esc(data?.businessName || data?.restaurant?.name || "VMS LinkHub");
  const title = esc(data?.title || "");
  const bio = esc(data?.bio || "");
  const photo = String(data?.photoData || "");
  const photoSafe = /^(data:image\/(?:png|jpeg|jpg|webp);base64,|https?:\/\/)/i.test(photo) ? photo : "";

  const contacts: string[] = [];
  if (data?.phone) contacts.push(`<a data-track-kind="contact" data-track-label="Call" href="tel:${esc(String(data.phone).replace(/^tel:/i, ""))}">Call</a>`);
  if (data?.email) contacts.push(`<a data-track-kind="contact" data-track-label="Email" href="mailto:${esc(String(data.email).replace(/^mailto:/i, ""))}">Email</a>`);
  const website = safeHttp(data?.website);
  if (website) contacts.push(`<a data-track-kind="contact" data-track-label="Website" href="${esc(website)}" target="_blank" rel="noopener">Website</a>`);
  const maps = safeHttp(data?.mapUrl || data?.visit?.mapsUrl || data?.restaurant?.mapsUrl);
  if (maps) contacts.push(`<a data-track-kind="contact" data-track-label="Directions" href="${esc(maps)}" target="_blank" rel="noopener">Directions</a>`);

  const links = (Array.isArray(data?.links) ? data.links : [])
    .filter((x: any) => x?.visible !== false && x?.label)
    .map((x: any) => {
      const href = safeHttp(x.url);
      return href ? `<a class="main-link" data-track-kind="link" data-track-label="${esc(x.label)}" href="${esc(href)}" target="_blank" rel="noopener">${esc(x.label)}</a>` : "";
    }).join("");

  const socials = (Array.isArray(data?.socials) ? data.socials : [])
    .filter((x: any) => x?.visible !== false && x?.url)
    .map((x: any) => {
      const href = socialHref(x.platform, x.url);
      if (!href) return "";
      return `<a class="social" data-track-kind="social" data-track-label="${esc(x.label || x.platform)}" href="${esc(href)}" ${/^https?:/i.test(href) ? 'target="_blank" rel="noopener"' : ""} aria-label="${esc(x.label || x.platform)}" title="${esc(x.label || x.platform)}">${iconSvg(x.platform)}</a>`;
    }).join("");

  const wifi = data?.wifi || {};
  const wifiHtml = wifi?.enabled ? `
    <details class="feature">
      <summary data-track-kind="feature" data-track-label="Wi-Fi">Wi‑Fi <span>›</span></summary>
      <div class="feature-body">
        <div class="feature-kicker">NETWORK</div>
        <b class="feature-title">${esc(wifi.ssid || "Wi‑Fi Network")}</b>
        ${wifi.security ? `<p>${esc(wifi.security)}</p>` : ""}
        ${wifi.password ? `<div class="password-row"><input id="wifiPass" type="password" readonly value="${esc(wifi.password)}"><button type="button" id="toggleWifi">Show</button><button type="button" id="copyWifi">Copy</button></div>` : ""}
        <small>Open Wi‑Fi settings on your device, choose this network, then enter the password.</small>
      </div>
    </details>` : "";

  const restaurant = data?.restaurant || {};
  const sections = (Array.isArray(restaurant.sections) ? restaurant.sections : []).filter((x: any) => x?.visible !== false);
  const menuHtml = restaurant?.enabled ? `
    <details class="feature">
      <summary data-track-kind="feature" data-track-label="Restaurant Menu">${esc(restaurant.name || "Restaurant Menu")} <span>›</span></summary>
      <div class="feature-body restaurant">
        <b class="feature-title">${esc(restaurant.name || name)}</b>
        ${restaurant.cuisine ? `<p>${esc(restaurant.cuisine)}</p>` : ""}
        ${restaurant.description ? `<p>${esc(restaurant.description)}</p>` : ""}
        ${sections.map((section: any) => `
          <section class="menu-section">
            <h3>${esc(section.name || "Menu")}</h3>
            ${(Array.isArray(section.items) ? section.items : []).filter((item: any) => item?.visible !== false).map((item: any) => `
              <div class="menu-item">
                <div><b>${esc(item.name || "Item")}</b>${item.description ? `<small>${esc(item.description)}</small>` : ""}</div>
                ${restaurant.showPrices !== false && item.price !== "" && item.price != null && Number.isFinite(Number(item.price)) ? `<strong>$${Number(item.price).toFixed(2)}</strong>` : item.priceLabel ? `<strong>${esc(item.priceLabel)}</strong>` : ""}
              </div>`).join("")}
          </section>`).join("")}
      </div>
    </details>` : "";

  const visit = data?.visit || {};
  const visitMap = safeHttp(visit.mapsUrl || data?.mapUrl);
  const visitHtml = visit?.enabled ? `
    <details class="feature">
      <summary data-track-kind="feature" data-track-label="Visit Us">Visit Us <span>›</span></summary>
      <div class="feature-body">
        <b class="feature-title">${esc(visit.name || data?.businessName || "Visit Us")}</b>
        ${visit.category ? `<p>${esc(visit.category)}</p>` : ""}
        ${visit.bio ? `<p>${esc(visit.bio)}</p>` : ""}
        ${visit.address ? `<p>${esc(visit.address)}</p>` : ""}
        ${formatHours(visit.hours)}
        ${visitMap ? `<a class="mini-link" data-track-kind="feature" data-track-label="Visit Us directions" href="${esc(visitMap)}" target="_blank" rel="noopener">Open in Maps</a>` : ""}
      </div>
    </details>` : "";

  const initials = esc(String(data?.businessName || "VMS").trim().split(/\s+/).slice(0, 2).map((p: string) => p[0] || "").join("").toUpperCase() || "VM");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${bg}">
<title>${name} — VMS LinkHub</title>
<style>
:root{--bg:${bg};--text:${text};--button:${button};--buttonText:${buttonText}}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{background:var(--bg);color:var(--text);padding:24px 14px 44px}.page{width:min(620px,100%);margin:0 auto}.profile{text-align:center;padding:18px 8px}.avatar{width:96px;height:96px;border-radius:50%;margin:0 auto 14px;background:rgba(255,255,255,.16);display:grid;place-items:center;overflow:hidden;font-weight:950;font-size:25px}.avatar img{width:100%;height:100%;object-fit:cover}.profile h1{font-size:25px;margin:0}.profile .title{font-size:12px;opacity:.84;margin:7px 0 0}.profile .bio{font-size:11px;line-height:1.55;opacity:.78;margin:8px auto 0;max-width:480px}.contacts,.socials{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:13px 0}.contacts a{color:var(--text);text-decoration:none;border:1px solid rgba(255,255,255,.26);border-radius:999px;padding:8px 12px;font-size:10px;font-weight:850}.links{display:grid;gap:10px;margin:18px 0}.main-link{display:flex;min-height:54px;align-items:center;justify-content:center;text-align:center;padding:10px 14px;border-radius:14px;background:var(--button);color:var(--buttonText);text-decoration:none;font-size:12px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.08)}.social{width:43px;height:43px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.10);color:var(--text);border:1px solid rgba(255,255,255,.20);text-decoration:none}.social svg{width:20px;height:20px}.features{display:grid;gap:9px;margin-top:16px}.feature{border:1px solid rgba(255,255,255,.20);border-radius:14px;background:rgba(255,255,255,.08);overflow:hidden}.feature summary{cursor:pointer;padding:15px;font-size:11px;font-weight:900;list-style:none;display:flex;justify-content:space-between}.feature summary::-webkit-details-marker{display:none}.feature-body{padding:0 14px 15px;display:grid;gap:8px;font-size:10px;line-height:1.5}.feature-kicker{font-size:8px;font-weight:900;opacity:.62}.feature-title{font-size:13px}.feature-body p,.feature-body small{opacity:.79;margin:0}.password-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px}.password-row input{min-width:0;border:0;border-radius:9px;padding:10px;background:rgba(255,255,255,.13);color:var(--text)}.password-row button,.mini-link{border:0;border-radius:9px;background:var(--button);color:var(--buttonText);padding:9px 10px;font-size:9px;font-weight:900;text-decoration:none;text-align:center}.menu-section{padding-top:10px;border-top:1px solid rgba(255,255,255,.14)}.menu-section h3{margin:0 0 5px}.menu-item{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.10)}.menu-item>div{display:grid;gap:2px}.hour{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid rgba(255,255,255,.10);padding:6px 0}.powered{text-align:center;font-size:9px;opacity:.56;margin-top:26px}.powered a{color:inherit}.empty{text-align:center;font-size:11px;opacity:.68;padding:10px}
@media(max-width:520px){body{padding-top:12px}.avatar{width:88px;height:88px}.profile h1{font-size:22px}.password-row{grid-template-columns:1fr 1fr}.password-row input{grid-column:1/-1}}
</style>
</head>
<body>
<main class="page">
<section class="profile">
<div class="avatar">${photoSafe ? `<img src="${esc(photoSafe)}" alt="${name}">` : initials}</div>
<h1>${name}</h1>${title ? `<p class="title">${title}</p>` : ""}${bio ? `<p class="bio">${bio}</p>` : ""}
${contacts.length ? `<div class="contacts">${contacts.join("")}</div>` : ""}
</section>
<div class="links">${links || `<div class="empty">More links coming soon.</div>`}</div>
${socials ? `<div class="socials">${socials}</div>` : ""}
<div class="features">${wifiHtml}${menuHtml}${visitHtml}</div>
<div class="powered">VMS LinkHub · Smart Business Card by <a href="https://visionmakestudio.com" target="_blank" rel="noopener">Vision Make Studio</a></div>
</main>
<script>
const LINKHUB_SLUG=${JSON.stringify(slug)};
function trackLinkHub(type,kind='',label=''){
  const body=JSON.stringify({slug:LINKHUB_SLUG,type,kind,label});
  try{if(navigator.sendBeacon){navigator.sendBeacon('/api/linkhub-event',new Blob([body],{type:'application/json'}));return}}catch{}
  fetch('/api/linkhub-event',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
}
try{const key='vms_lh_view_'+LINKHUB_SLUG,last=Number(sessionStorage.getItem(key)||0);if(Date.now()-last>1800000){sessionStorage.setItem(key,String(Date.now()));trackLinkHub('view')}}catch{trackLinkHub('view')}
document.querySelectorAll('[data-track-kind]').forEach(link=>link.addEventListener('click',()=>trackLinkHub('click',link.dataset.trackKind||'',link.dataset.trackLabel||link.textContent||''),{capture:true}));
const pass=document.getElementById('wifiPass');
document.getElementById('toggleWifi')?.addEventListener('click',e=>{if(!pass)return;const show=pass.type==='password';pass.type=show?'text':'password';e.currentTarget.textContent=show?'Hide':'Show'});
document.getElementById('copyWifi')?.addEventListener('click',async e=>{if(!pass)return;try{await navigator.clipboard.writeText(pass.value);e.currentTarget.textContent='Copied';setTimeout(()=>e.currentTarget.textContent='Copy',1200)}catch{}});
</script>
</body></html>`;
}

export default async (req: Request, _context: Context) => {
  try {
    const u = new URL(req.url);

    if (u.pathname === "/api/linkhub-event") {
      if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const body: any = await req.json().catch(() => ({}));
      const slug = String(body?.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
      const type = body?.type === "click" ? "linkhub_click" : body?.type === "view" ? "linkhub_view" : "";
      if (!slug || !type) return Response.json({ error: "Invalid LinkHub activity." }, { status: 400 });
      const pages = await sbAdmin(`linkhub_pages?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=client_id&limit=1`);
      const page = Array.isArray(pages) ? pages[0] : null;
      if (!page) return new Response(null, { status: 204 });
      const kind = String(body?.kind || "").replace(/[^a-z0-9 _-]/gi, "").slice(0, 40);
      const label = String(body?.label || "").replace(/[<>]/g, "").trim().slice(0, 120);
      await sbAdmin("activity_events", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          client_id: page.client_id,
          event_type: type,
          title: type === "linkhub_view" ? "LinkHub viewed" : `LinkHub click${label ? ` · ${label}` : ""}`,
          detail: type === "linkhub_view" ? "A visitor opened the public LinkHub." : `A visitor clicked ${label || kind || "a LinkHub action"}.`,
          needs_action: false,
          resolved: true,
          metadata: { source: "public_linkhub", slug, kind, label },
        },
      });
      return Response.json({ ok: true });
    }

    if (u.pathname.startsWith("/link/")) {
      if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
      const slug = decodeURIComponent(u.pathname.replace(/^\/link\//, "").split("/")[0] || "").trim().toLowerCase();
      if (!slug) return new Response("LinkHub not found", { status: 404 });

      const rows = await sbRest(`linkhub_pages?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=slug,published_data,published_at&limit=1`);
      const page = Array.isArray(rows) ? rows[0] : null;
      if (!page) {
        return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#003049;color:white;font-family:system-ui;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px"><div><h1>LinkHub unavailable</h1><p>This LinkHub has not been published or the link is no longer available.</p></div></body>`, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
      return new Response(renderPublic(page.published_data || {}, slug), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60, stale-while-revalidate=300" }
      });
    }

    if (u.pathname !== "/api/linkhub") return new Response("Not found", { status: 404 });

    if (req.method === "GET") {
      if (u.searchParams.get("mine") !== "1") return Response.json({ error: "Missing LinkHub request." }, { status: 400 });
      const { token, client } = await currentClient(req);
      const page = await ownPage(client.id, token);
      const slug = page?.slug || `${slugify(client.business_name)}-${String(client.id).replace(/-/g, "").slice(0, 6)}`;
      const events = await sbAdmin(`activity_events?client_id=eq.${encodeURIComponent(client.id)}&event_type=in.(linkhub_view,linkhub_click)&select=event_type,title,detail,created_at,metadata&order=created_at.desc&limit=5000`).catch(() => []);
      return Response.json({
        ok: true,
        slug,
        url: pageUrl(req, slug),
        status: page?.status || "draft",
        publishedAt: page?.published_at || null,
        publishedData: page?.published_data && Object.keys(page.published_data).length ? page.published_data : null,
        analytics: analyticsSummary(Array.isArray(events) ? events : []),
      });
    }

    if (req.method === "POST") {
      const { token, client } = await currentClient(req);
      const body: any = await req.json();
      if (body?.action !== "publish") return Response.json({ error: "Unsupported LinkHub action." }, { status: 400 });

      const data = cleanPublishedData(body?.data);
      const serialized = JSON.stringify(data);
      if (serialized.length > 2_000_000) return Response.json({ error: "This LinkHub is too large to publish. Reduce oversized images and try again." }, { status: 413 });
      if (!String(data?.businessName || "").trim()) return Response.json({ error: "Add a business or display name before publishing." }, { status: 400 });

      const existing = await ownPage(client.id, token);
      const slug = existing?.slug || `${slugify(client.business_name || data.businessName)}-${String(client.id).replace(/-/g, "").slice(0, 6)}`;
      const now = new Date().toISOString();
      const rows = await sbRest("linkhub_pages?on_conflict=client_id", {
        token,
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: {
          client_id: client.id,
          slug,
          draft_data: data,
          published_data: data,
          status: "published",
          published_at: now,
          updated_at: now,
        }
      });
      const saved = Array.isArray(rows) ? rows[0] : null;
      return Response.json({
        ok: true,
        slug,
        url: pageUrl(req, slug),
        status: "published",
        publishedAt: saved?.published_at || now,
        publishedData: data,
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error: any) {
    console.error("VMS LinkHub function failed", error);
    return jsonError(error);
  }
};

export const config: Config = { path: ["/api/linkhub", "/api/linkhub-event", "/link/*"] };
