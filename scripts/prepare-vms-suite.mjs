import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDir = path.resolve(projectDir, "../..");
const approvedDir = path.join(workspaceDir, "preview-client-portal");
const libraryQr = path.join(workspaceDir, "library-downloads", "vms_qr_tools_FINAL_MOBILE_FIXED.html");
const publicDir = path.join(projectDir, "public");
const adminDir = path.join(publicDir, "admin");
const portalDir = path.join(publicDir, "portal");

const adminFiles = [
  "dashboard.html",
  "VMS-Audit.html",
  "Client-Directory.html",
  "Service-Catalog.html",
  "Billing&Subscriptions.html",
  "Promotions.html",
  "Projects&Request.html",
  "Files&Assets.html",
  "Notification&Activities.html",
  "VMS-LinkHub.html",
];

const noIndexMeta = '<meta name="robots" content="noindex,nofollow,noarchive">';
const adminDeploymentStyle = `
<style id="vms-deployment-auth-style">
  .vms-signout-form{margin-top:10px}
  .vms-signout-btn{width:100%;min-height:34px;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:7px 10px;color:#d7e6ed;background:rgba(255,255,255,.07);font:inherit;font-weight:800;cursor:pointer}
  .vms-signout-btn:hover{background:rgba(255,255,255,.13);color:#fff}
</style>`;
const adminSignout = `
<form class="vms-signout-form" method="post" action="/api/admin/logout">
  <button class="vms-signout-btn" type="submit">Sign out of VMS Admin</button>
</form>`;

const portalGateHead = `
${noIndexMeta}
<style id="vms-portal-gate-style">
  html.vms-portal-locked{background:#003049}
  html.vms-portal-locked body{overflow:hidden!important}
  html.vms-portal-locked body>*:not(#vmsPortalGate){visibility:hidden!important}
  #vmsPortalGate{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;padding:20px;background:linear-gradient(145deg,#002238,#003049);font-family:Inter,Arial,sans-serif;color:#08364b}
  #vmsPortalGate[hidden]{display:none}
  .vms-portal-gate-card{width:min(470px,100%);border-radius:22px;padding:36px;background:#fff;box-shadow:0 30px 80px rgba(0,18,31,.38);text-align:center}
  .vms-portal-gate-mark{display:grid;width:58px;height:58px;margin:0 auto 18px;place-items:center;border-radius:50%;color:#176a97;background:#e7f1f7;font-size:28px;font-weight:900}
  .vms-portal-gate-card small{display:block;margin-bottom:9px;color:#56809a;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
  .vms-portal-gate-card h1{margin:0 0 12px;color:#003049;font-size:clamp(28px,7vw,42px);line-height:1.02}
  .vms-portal-gate-card p{margin:0 0 22px;color:#60747d;line-height:1.6}
  .vms-portal-gate-card a{display:inline-flex;min-height:52px;align-items:center;justify-content:center;border-radius:12px;padding:0 22px;color:#fff;background:#c1121f;font-weight:850;text-decoration:none}
  @media(max-width:560px){#vmsPortalGate{align-items:end;padding:12px}.vms-portal-gate-card{border-radius:22px 22px 14px 14px;padding:32px 23px 26px}}
</style>
<script>document.documentElement.classList.add('vms-portal-locked');</script>`;

const portalGateBody = `
<div id="vmsPortalGate" role="status" aria-live="polite">
  <div class="vms-portal-gate-card">
    <div class="vms-portal-gate-mark" aria-hidden="true">✓</div>
    <small>VMS Client Portal</small>
    <h1 id="vmsPortalGateTitle">Checking your secure link…</h1>
    <p id="vmsPortalGateMessage">Please wait while Vision Make Studio verifies your client session.</p>
    <a id="vmsPortalGateAction" href="/#member-portal" hidden>Request a new sign-in link</a>
  </div>
</div>
<script>
(function(){
  const gate=document.getElementById('vmsPortalGate');
  const title=document.getElementById('vmsPortalGateTitle');
  const message=document.getElementById('vmsPortalGateMessage');
  const action=document.getElementById('vmsPortalGateAction');
  const showLogin=()=>{
    title.textContent='A secure sign-in link is required.';
    message.textContent='Return to the Vision Make Studio website and request a fresh link using the email connected to your client account.';
    action.hidden=false;
    gate.setAttribute('role','alert');
  };
  const unlock=(user)=>{
    document.documentElement.classList.remove('vms-portal-locked');
    gate.hidden=true;
    window.VMS_PORTAL_SESSION=user||null;
    window.dispatchEvent(new CustomEvent('vms:portal-ready',{detail:user||null}));
  };
  const requestSession=async(method,body)=>{
    const response=await fetch('/api/portal/session',{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
    if(!response.ok)throw new Error('session');
    return response.json();
  };
  (async()=>{
    try{
      const hash=new URLSearchParams(location.hash.replace(/^#/,''));
      const accessToken=hash.get('access_token');
      let result;
      if(accessToken){
        result=await requestSession('POST',{accessToken});
        history.replaceState(null,'',location.pathname+location.search);
      }else{
        result=await requestSession('GET');
      }
      unlock(result.user);
    }catch(error){
      showLogin();
    }
  })();
})();
</script>`;

function injectBefore(html, marker, content) {
  const index = html.toLowerCase().lastIndexOf(marker.toLowerCase());
  if (index < 0) throw new Error(`Could not find ${marker} while preparing HTML.`);
  return `${html.slice(0, index)}${content}\n${html.slice(index)}`;
}

function addMarkupButtonTypes(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<button\b[^>]*>/gi, (match) => {
    if (/^<script/i.test(match) || /\btype\s*=/.test(match)) return match;
    return match.replace(/^<button/i, '<button type="button"');
  });
}

function prepareAdminHtml(source) {
  let html = source
    .replaceAll('href="clients.html"', 'href="Client-Directory.html"')
    .replaceAll("href='clients.html'", "href='Client-Directory.html'")
    .replaceAll('href="Client-Portal.html"', 'href="/portal/"')
    .replaceAll("href='Client-Portal.html'", "href='/portal/'")
    .replaceAll('href="VMS-Homepage.html"', 'href="/"')
    .replaceAll("href='VMS-Homepage.html'", "href='/'")
    .replaceAll('href="admin.html"', 'href="dashboard.html"')
    .replaceAll("href='admin.html'", "href='dashboard.html'")
    .replaceAll('href="audit.html"', 'href="VMS-Audit.html"')
    .replaceAll("href='audit.html'", "href='VMS-Audit.html'")
    .replaceAll('href="qr.html"', 'href="vms_qr_tools_FINAL_MOBILE_FIXED.html"')
    .replaceAll("href='qr.html'", "href='vms_qr_tools_FINAL_MOBILE_FIXED.html'");

  html = injectBefore(html, "</head>", `\n${noIndexMeta}\n${adminDeploymentStyle}`);
  if (html.includes('<div class="sidebar-foot">')) {
    html = html.replace(/(<div class="sidebar-foot">[\s\S]*?<div class="external-links">[\s\S]*?<\/div>)/, `$1${adminSignout}`);
  } else {
    html = injectBefore(html, "</body>", adminSignout);
  }
  return addMarkupButtonTypes(html);
}

function preparePortalHtml(source) {
  let html = source
    .replaceAll('href="VMS-Homepage.html"', 'href="/"')
    .replaceAll("href='VMS-Homepage.html'", "href='/'");
  html = injectBefore(html, "</head>", portalGateHead);
  html = injectBefore(html, "</body>", portalGateBody);
  return addMarkupButtonTypes(html);
}

await access(approvedDir);
await rm(adminDir, { recursive: true, force: true });
await rm(portalDir, { recursive: true, force: true });
await mkdir(adminDir, { recursive: true });
await mkdir(portalDir, { recursive: true });

for (const file of adminFiles) {
  const source = await readFile(path.join(approvedDir, file), "utf8");
  const output = prepareAdminHtml(source);
  await writeFile(path.join(adminDir, file), output, "utf8");
  if (file === "dashboard.html") await writeFile(path.join(adminDir, "index.html"), output, "utf8");
}

const qrSource = await readFile(libraryQr, "utf8");
await writeFile(path.join(adminDir, "vms_qr_tools_FINAL_MOBILE_FIXED.html"), prepareAdminHtml(qrSource), "utf8");

const portalSource = await readFile(path.join(approvedDir, "Client-Portal.html"), "utf8");
const preparedPortal = preparePortalHtml(portalSource);
await writeFile(path.join(portalDir, "index.html"), preparedPortal, "utf8");
await writeFile(path.join(portalDir, "Client-Portal.html"), preparedPortal, "utf8");

console.log(`Prepared ${adminFiles.length + 2} protected Admin files and the Client Portal deployment copy.`);
