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

const LH_IC: Record<string, string> = {
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  wifi:'<path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.7 16a5 5 0 016.6 0"/><circle cx="12" cy="19.5" r="1"/>',
  menu:'<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M16 3c-1.7 0-3 2.2-3 5.5S14.3 13 16 13v8"/>',
  copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v9A1.5 1.5 0 005 15.5h3.5"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
};
function lhIc(n: string) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${LH_IC[n] || ""}</svg>`;
}

function renderPublic(data: any, slug: string) {
  const style = data?.style || {};
  const named = ["cream", "navy", "red", "sky"];
  const theme = named.includes(String(data?.theme)) ? String(data.theme) : "";
  const gradient = style?.gradient;
  const gradientA = safeHex(gradient?.a, "");
  const gradientB = safeHex(gradient?.b, "");
  const gradientDir = /^(?:45|90|145|180)deg$/.test(String(gradient?.dir || "")) ? String(gradient.dir) : "145deg";
  const btnShape = ["round", "pill", "out"].includes(String(style?.btn)) ? String(style.btn) : "round";
  const themeBg: Record<string, string> = { cream: "#F6F3EC", navy: "#003049", red: "#2A0A0D", sky: "#E3EFF6" };
  let pageColor = "#003049";
  let customVars = "";
  if (theme) {
    pageColor = themeBg[theme];
  } else {
    // Custom colors (and older pages saved before themes existed)
    const bgc = safeHex(style.bg, "#003049");
    const text = safeHex(style.text, "#FFFFFF");
    const button = safeHex(style.button, "#FFFFFF");
    const buttonText = safeHex(style.buttonText, "#003049");
    pageColor = gradientA && gradientB ? gradientA : bgc;
    const bg = gradientA && gradientB ? `linear-gradient(${gradientDir},${gradientA},${gradientB})` : bgc;
    customVars = `--lac:${text};--lbg:${bgc};--lpage:${bg};--lbtn:${button};--lbtnfg:${buttonText};--lin:${text};--lmu:color-mix(in srgb,${text} 72%,transparent);--lsur:color-mix(in srgb,${text} 12%,transparent);`;
  }
  const cls = `lh${theme && theme !== "cream" ? ` t-${theme}` : ""} b-${btnShape}`;

  const name = esc(data?.businessName || data?.restaurant?.name || "VMS LinkHub");
  const title = esc(data?.title || "");
  const bio = esc(data?.bio || "");
  const photo = String(data?.photoData || "");
  const photoSafe = /^(data:image\/(?:png|jpeg|jpg|webp);base64,|https?:\/\/)/i.test(photo) ? photo : "";
  const initials = esc(String(data?.businessName || "VMS").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).slice(0, 2).map((p: string) => p[0] || "").join("").toUpperCase() || "VM");
  const ext = (href: string) => /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : "";

  const acts: string[] = [];
  if (data?.phone) acts.push(`<a data-track-kind="contact" data-track-label="Call" href="tel:${esc(String(data.phone).replace(/^tel:/i, ""))}" aria-label="Call" title="Call">${lhIc("phone")}</a>`);
  if (data?.email) acts.push(`<a data-track-kind="contact" data-track-label="Email" href="mailto:${esc(String(data.email).replace(/^mailto:/i, ""))}" aria-label="Email" title="Email">${lhIc("mail")}</a>`);
  const maps = safeHttp(data?.mapUrl || data?.visit?.mapsUrl || data?.restaurant?.mapsUrl);
  if (maps) acts.push(`<a data-track-kind="contact" data-track-label="Directions" href="${esc(maps)}" target="_blank" rel="noopener" aria-label="Directions" title="Directions">${lhIc("pin")}</a>`);
  const website = safeHttp(data?.website);
  if (website) acts.push(`<a data-track-kind="contact" data-track-label="Website" href="${esc(website)}" target="_blank" rel="noopener" aria-label="Website" title="Website">${lhIc("globe")}</a>`);

  const links = (Array.isArray(data?.links) ? data.links : [])
    .filter((x: any) => x?.visible !== false && x?.label)
    .map((x: any) => {
      const href = safeHttp(x.url);
      return href ? `<a class="lb" data-track-kind="link" data-track-label="${esc(x.label)}" href="${esc(href)}" target="_blank" rel="noopener">${esc(x.label)}</a>` : "";
    }).join("");

  const socials = (Array.isArray(data?.socials) ? data.socials : [])
    .filter((x: any) => x?.visible !== false && x?.url)
    .map((x: any) => {
      const href = socialHref(x.platform, x.url);
      if (!href) return "";
      const label = esc(x.label || x.platform);
      return `<a data-track-kind="social" data-track-label="${label}" href="${esc(href)}"${ext(href)} aria-label="${label}" title="${label}">${iconSvg(x.platform)}</a>`;
    }).join("");

  const back = `<button type="button" class="back" data-lhs="main">← Back</button>`;
  const feats: string[] = [];
  const screens: string[] = [];

  const restaurant = data?.restaurant || {};
  if (restaurant?.enabled) {
    const sections = (Array.isArray(restaurant.sections) ? restaurant.sections : []).filter((x: any) => x?.visible !== false);
    feats.push(`<button type="button" data-lhs="menu" data-track-kind="feature" data-track-label="Menu">${lhIc("menu")}Menu</button>`);
    screens.push(`<section class="lhv" data-screen="menu" hidden>${back}<div class="scrn"><b>${esc(restaurant.name || "Menu")}</b>
      ${restaurant.cuisine ? `<p class="sub">${esc(restaurant.cuisine)}</p>` : ""}${restaurant.description ? `<p class="sub">${esc(restaurant.description)}</p>` : ""}
      ${sections.map((section: any) => `<p class="sec">${esc(section.name || "Menu")}</p>` +
        (Array.isArray(section.items) ? section.items : []).filter((item: any) => item?.visible !== false).map((item: any) => {
          const price = restaurant.showPrices !== false && item.price !== "" && item.price != null && Number.isFinite(Number(item.price))
            ? `$${Number(item.price).toFixed(2)}` : item.priceLabel ? esc(item.priceLabel) : "";
          return `<div class="mi"><span><span class="nm">${esc(item.name || "Item")}</span>${item.description ? `<small>${esc(item.description)}</small>` : ""}</span>${price ? `<strong>${price}</strong>` : ""}</div>`;
        }).join("")).join("") || `<p class="sub">The menu is coming soon.</p>`}
    </div></section>`);
  }

  const wifi = data?.wifi || {};
  if (wifi?.enabled) {
    feats.push(`<button type="button" data-lhs="wifi" data-track-kind="feature" data-track-label="Wi-Fi">${lhIc("wifi")}Wi‑Fi</button>`);
    screens.push(`<section class="lhv" data-screen="wifi" hidden>${back}<div class="scrn"><b>Free Wi‑Fi</b>
      <div class="mi"><span>Network</span><strong>${esc(wifi.ssid || "Wi‑Fi Network")}</strong></div>
      ${wifi.security ? `<div class="mi"><span>Security</span><span>${esc(wifi.security)}</span></div>` : ""}
      ${wifi.password ? `<div class="mi"><span>Password</span><input id="wifiPass" type="password" readonly value="${esc(wifi.password)}" aria-label="Wi-Fi password"></div>
      <div class="two"><button type="button" class="lb sm" id="toggleWifi">${lhIc("eye")}<span>Show</span></button><button type="button" class="lb sm" id="copyWifi">${lhIc("copy")}<span>Copy</span></button></div>` : ""}
      <p class="sub">Open Wi‑Fi settings on your phone, pick this network, then enter the password.</p>
    </div></section>`);
  }

  const visit = data?.visit || {};
  if (visit?.enabled) {
    const visitMap = safeHttp(visit.mapsUrl || data?.mapUrl);
    const hours = Array.isArray(visit.hours) ? visit.hours.map((row: any) => {
      const day = esc(String(row?.day || row?.label || "").slice(0, 3));
      const value = row?.closed ? "Closed" : [row?.open, row?.close].filter(Boolean).map(esc).join("–");
      return day && value ? `<div class="mi"><span>${day}</span><span>${value}</span></div>` : "";
    }).join("") : typeof visit.hours === "string" && visit.hours ? `<div class="mi"><span>Hours</span><span>${esc(visit.hours)}</span></div>` : "";
    feats.push(`<button type="button" data-lhs="visit" data-track-kind="feature" data-track-label="Visit Us">${lhIc("pin")}Visit us</button>`);
    screens.push(`<section class="lhv" data-screen="visit" hidden>${back}<div class="scrn"><b>${esc(visit.name || "Visit us")}</b>
      ${visit.category ? `<p class="sub">${esc(visit.category)}</p>` : ""}${visit.bio ? `<p class="sub">${esc(visit.bio)}</p>` : ""}
      ${visit.address ? `<div class="mi"><span>Address</span><span class="r">${esc(visit.address)}</span></div>` : ""}
      ${hours}
      ${visitMap ? `<a class="lb" data-track-kind="feature" data-track-label="Visit Us directions" href="${esc(visitMap)}" target="_blank" rel="noopener">Get directions</a>` : ""}
    </div></section>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${pageColor}">
<title>${name} — VMS LinkHub</title>
${bio ? `<meta name="description" content="${bio}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@600;700&display=swap">
<style>
*,*::before,*::after{box-sizing:border-box}
:root{--display:"Unbounded","Arial Black",system-ui,sans-serif;--body:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
html,body{margin:0;min-height:100%}
html{background:${pageColor};-webkit-text-size-adjust:100%}
body{font:400 15px/1.55 var(--body);-webkit-font-smoothing:antialiased;overscroll-behavior-y:none}
h1,p{margin:0}
img,svg{display:block;max-width:100%}
button,input{font:inherit;color:inherit}
button{cursor:pointer;-webkit-tap-highlight-color:transparent;background:none;border:0;padding:0}
.ico{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.lh{--lbg:#F6F3EC;--lsur:#FFFFFF;--lbtn:#003049;--lbtnfg:#FDF0D5;--lin:#0B2233;--lmu:#586A74;--lac:#C1121F;--lpage:var(--lbg);min-height:100vh;min-height:100dvh;background:var(--lpage);color:var(--lin);font-family:var(--body);padding:max(40px,calc(env(safe-area-inset-top) + 24px)) max(18px,env(safe-area-inset-right)) max(30px,calc(env(safe-area-inset-bottom) + 20px)) max(18px,env(safe-area-inset-left))}
.lh.t-navy{--lbg:#003049;--lsur:#0A3A55;--lbtn:#FDF0D5;--lbtnfg:#003049;--lin:#FDF0D5;--lmu:rgba(253,240,213,.72);--lac:#FFB48A}
.lh.t-red{--lbg:#2A0A0D;--lsur:#3B1216;--lbtn:#C1121F;--lbtnfg:#fff;--lin:#FDF0D5;--lmu:rgba(253,240,213,.72);--lac:#FFB48A}
.lh.t-sky{--lbg:#E3EFF6;--lsur:#fff;--lbtn:#2F6F96;--lbtnfg:#fff;--lin:#0B2233;--lmu:#46606E;--lac:#003049}
.lhv{width:min(480px,100%);margin:0 auto;display:grid;gap:14px;align-content:start}
.lhv[hidden]{display:none}
.lha{width:96px;height:96px;border-radius:30px;margin:0 auto;display:grid;place-items:center;overflow:hidden;font-family:var(--display);font-weight:700;font-size:1.8rem;color:var(--lbtnfg);background:var(--lbtn);box-shadow:0 10px 30px rgba(0,0,0,.18)}
.lha img{width:100%;height:100%;object-fit:cover}
.lh h1{font-family:var(--display);font-weight:700;font-size:1.45rem;letter-spacing:-.03em;line-height:1.2;text-align:center;margin-top:2px}
.bio{text-align:center;color:var(--lmu);font-size:14.5px;margin-top:-6px}
.bio.t{font-weight:600}
.acts{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.acts a{width:48px;height:48px;border-radius:15px;background:var(--lsur);color:var(--lin);display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.08);text-decoration:none}
.feats{display:grid;gap:8px}
.feats button{display:grid;justify-items:center;gap:5px;padding:13px 4px;border-radius:15px;background:var(--lsur);color:var(--lin);font-size:13px;font-weight:600}
.lb{text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:0 18px;border-radius:16px;background:var(--lbtn);color:var(--lbtnfg);font-weight:600;font-size:15.5px;text-align:center;transition:transform .15s;box-shadow:0 6px 18px rgba(0,0,0,.08)}
.lb:active{transform:scale(.98)}
.lb.sm{min-height:46px;font-size:14px;padding:0 12px}
.lh.b-out .lb{background:transparent;color:var(--lin);border:2px solid var(--lbtn);box-shadow:none}
.lh.b-pill .lb{border-radius:99px}
.soc{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-top:4px}
.soc a{color:var(--lmu);display:grid;place-items:center;width:40px;height:40px;text-decoration:none}
.soc a:hover{color:var(--lin)}
.soc svg{width:22px;height:22px}
.made{text-align:center;font-size:12px;color:var(--lmu);margin-top:10px}
.made a{color:inherit}
.empty{text-align:center;color:var(--lmu);font-size:14px}
.scrn{background:var(--lsur);border-radius:18px;padding:18px;display:grid;gap:10px}
.scrn>b{font-family:var(--display);font-weight:700;font-size:1.1rem}
.sub{color:var(--lmu);font-size:14px}
.sec{font-weight:700;font-size:14px;margin-top:8px}
.mi{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14.5px;padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--lin) 12%,transparent)}
.mi:last-child{border:0}
.mi>span:first-child{display:grid;gap:2px;min-width:0}
.mi small{color:var(--lmu);font-size:12.5px}
.mi strong{font-weight:700;white-space:nowrap}
.mi .r{text-align:right}
.mi input{min-width:0;width:12ch;text-align:right;border:0;background:transparent;font-weight:700;padding:0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.back{justify-self:start;font-size:14px;font-weight:600;color:var(--lac);min-height:40px}
:focus-visible{outline:2px solid var(--lac);outline-offset:2px}
</style>
</head>
<body>
<main class="${cls}"${customVars ? ` style="${customVars}"` : ""}>
<section class="lhv" data-screen="main">
<div class="lha">${photoSafe ? `<img src="${esc(photoSafe)}" alt="${name}">` : initials}</div>
<h1>${name}</h1>${title ? `<p class="bio t">${title}</p>` : ""}${bio ? `<p class="bio">${bio}</p>` : ""}
${acts.length ? `<div class="acts">${acts.join("")}</div>` : ""}
${feats.length ? `<div class="feats" style="grid-template-columns:repeat(${feats.length},1fr)">${feats.join("")}</div>` : ""}
${links || `<p class="empty">More links coming soon.</p>`}
${socials ? `<div class="soc">${socials}</div>` : ""}
<div class="made">Made with <a href="https://visionmakestudio.com" target="_blank" rel="noopener">VMS LinkHub</a></div>
</section>
${screens.join("\n")}
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
function showScreen(s){document.querySelectorAll('.lhv').forEach(v=>{v.hidden=v.dataset.screen!==s});window.scrollTo(0,0)}
document.querySelectorAll('[data-lhs]').forEach(b=>b.addEventListener('click',()=>{const s=b.dataset.lhs;showScreen(s);if(s==='main'){if(history.state&&history.state.lh)history.back()}else history.pushState({lh:s},'')}));
window.addEventListener('popstate',e=>showScreen(e.state&&e.state.lh||'main'));
const pass=document.getElementById('wifiPass');
document.getElementById('toggleWifi')?.addEventListener('click',e=>{if(!pass)return;const show=pass.type==='password';pass.type=show?'text':'password';e.currentTarget.querySelector('span').textContent=show?'Hide':'Show'});
document.getElementById('copyWifi')?.addEventListener('click',async e=>{if(!pass)return;const l=e.currentTarget.querySelector('span');try{await navigator.clipboard.writeText(pass.value);l.textContent='Copied';setTimeout(()=>l.textContent='Copy',1400)}catch{pass.type='text';pass.select()}});
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
