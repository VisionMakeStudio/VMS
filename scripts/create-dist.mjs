import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');

fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});

for(const item of ['index.html','services.html','get-started.html','audit-report.html','privacy.html','terms.html','refund-cancellation.html','404.html','robots.txt','sitemap.xml','config.js','assets','admin','portal']){
  const src=path.join(root,item),dst=path.join(dist,item);
  if(!fs.existsSync(src))throw new Error(`Required publish input is missing: ${item}`);
  fs.cpSync(src,dst,{recursive:true});
}

/* Phase 9: connect the existing homepage to the public sales flow without
   changing the source homepage layout or visual design. */
const homepage=path.join(dist,'index.html');
if(fs.existsSync(homepage)){
  let html=fs.readFileSync(homepage,'utf8');
  html=html.replaceAll('href="#services"','href="services.html"');
  const oldServiceHook="const btn=document.getElementById('serviceRequestBtn');btn.textContent=s.salesMode==='Buy Now'?'Get Started':'Request This Service';serviceModal.classList.add('show')";
  const newServiceHook="const btn=document.getElementById('serviceRequestBtn');btn.textContent=s.salesMode==='Buy Now'?'Get Started':'Request This Service';btn.href='get-started.html?service='+encodeURIComponent(s.id);serviceModal.classList.add('show')";
  if(!html.includes(oldServiceHook))throw new Error('Phase 9 homepage service CTA hook was not found.');
  html=html.replace(oldServiceHook,newServiceHook);
  fs.writeFileSync(homepage,html);
}

/* Phase 4 production privacy hardening.
   Protected content remains hidden until VMSAuth verifies the session, role and MFA,
   but the old full-screen verification copy is intentionally gone. */
const privacyGate=String.raw`<script id="vms-phase10-privacy-gate">(function(){if(location.protocol==='file:')return;var root=document.documentElement;root.classList.add('vms-auth-pending');try{if(location.pathname.indexOf('/admin/')===0){var raw=sessionStorage.getItem('vms_admin_fast_nav');if(raw){var data=JSON.parse(raw),leaf=(location.pathname||'/').replace(/\/index(?:\.html)?$/i,'/').replace(/\.html$/i,'').replace(/\/+$/,'')||'/';if(data&&data.until>Date.now()&&data.to===leaf)root.classList.add('vms-admin-fast-nav');}}}catch(e){}})();</script><style id="vms-phase10-privacy-style">html.vms-auth-pending body{overflow:hidden!important}html.vms-auth-pending body>*{visibility:hidden!important}html.vms-auth-pending body::before{content:''!important;position:fixed;inset:0;z-index:2147483647;display:block;background:#f4f8f9;visibility:visible!important}html.vms-auth-pending body::after{content:''!important;position:fixed;left:0;right:0;top:0;height:64px;z-index:2147483647;background:#fff;border-bottom:1px solid #d8e4e8;visibility:visible!important}html.vms-auth-pending.vms-admin-surface body::before,html.vms-auth-pending.vms-admin-fast-nav body::before{background:linear-gradient(90deg,#003049 0 236px,#f4f8f9 236px)!important}@media(max-width:820px){html.vms-auth-pending.vms-admin-surface body::before,html.vms-auth-pending.vms-admin-fast-nav body::before{background:#f4f8f9!important}}</style>`;
function ensurePrivacyGate(file){if(!fs.existsSync(file))return;let html=fs.readFileSync(file,'utf8');html=html.replace(/<script\b[^>]*id=["']vms-phase10-privacy-gate["'][^>]*>[\s\S]*?<\/script>\s*<style\b[^>]*id=["']vms-phase10-privacy-style["'][^>]*>[\s\S]*?<\/style>/i,'');if(!/<head\b/i.test(html))throw new Error(`Protected page has no <head>: ${path.relative(dist,file)}`);html=html.replace(/<head([^>]*)>/i,`<head$1>${privacyGate}`);fs.writeFileSync(file,html)}
for(const area of ['admin','portal']){const dir=path.join(dist,area);if(!fs.existsSync(dir))continue;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(!entry.isFile()||!entry.name.endsWith('.html'))continue;if(area==='admin'&&entry.name==='login.html')continue;ensurePrivacyGate(path.join(dir,entry.name))}}

/* Recovery 2: one protected-page runtime for every Admin + Portal page.
   Legacy pages such as QR Tools, Service Catalog and the original Portal did not
   call VMSAuth.requireSession(), which left vms-auth-pending on <html> forever.
   Config is loaded in <head>; vms-core + the guard are guaranteed before </body>. */
for(const asset of ['vms-core.js','vms-auth-guard.js']){
  if(!fs.existsSync(path.join(dist,'assets',asset)))throw new Error(`Protected auth runtime missing: assets/${asset}`);
}
function ensureProtectedRuntime(file,kind){
  let html=fs.readFileSync(file,'utf8');
  if(!/<\/head>/i.test(html)||!/<\/body>/i.test(html))throw new Error(`Protected page is missing head/body: ${path.relative(dist,file)}`);

  /* Billing and a few legacy Admin sources used to carry their own vms-core +
     requireSession bridge. Running that bridge beside the centralized guard can
     briefly redirect a valid internal Admin navigation through login.html.
     Production now owns auth bootstrap in exactly one place on every protected page. */
  html=html.replace(/<script\b[^>]*\bsrc=["'][^"']*config\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi,'');
  html=html.replace(/<script\b[^>]*\bsrc=["'][^"']*vms-core\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi,'');
  html=html.replace(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,(whole,code)=>{
    const compact=String(code||'').trim().replace(/\s+/g,' ');
    const legacy=/^(?:if\s*\(\s*window\.VMSAuth\s*\)\s*)?(?:window\.)?VMSAuth(?:\?\.|\.)requireSession\([\s\S]*?\)\s*;?$/.test(compact);
    return legacy?'':whole;
  });
  html=html.replace(/<script\b[^>]*id=["']vms-protected-auth-guard["'][^>]*>[\s\S]*?<\/script>/gi,'');

  const bootstrap='<script id="vms-protected-config" src="/config.js?v=20260824-billing-auth-fix"></script>'+ 
    '<script id="vms-protected-core" src="/assets/vms-core.js?v=20260824-billing-auth-fix"></script>';
  html=html.replace(/<\/head>/i,bootstrap+'</head>');

  const guard=`<script id="vms-protected-auth-guard" src="/assets/vms-auth-guard.js?v=20260824-billing-auth-fix" data-vms-auth-kind="${kind}"></script>`;
  html=html.replace(/<\/body>/i,guard+'</body>');
  fs.writeFileSync(file,html);
}
for(const area of ['admin','portal']){
  const dir=path.join(dist,area);if(!fs.existsSync(dir))continue;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
    if(area==='admin'&&entry.name==='login.html')continue;
    ensureProtectedRuntime(path.join(dir,entry.name),area==='admin'?'admin':'client');
  }
}

/* Phase 4 canonical Admin shell.
   The build no longer appends links into whatever legacy sidebar a page happens to have.
   Every protected Admin tool receives the exact same shared shell CSS + JS. */
for(const asset of ['vms-admin-shell.css','vms-admin-shell.js']){
  if(!fs.existsSync(path.join(dist,'assets',asset)))throw new Error(`Canonical Admin shell asset missing: assets/${asset}`);
}
const adminDir=path.join(dist,'admin');
function ensureCanonicalAdminShell(file){
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<script\b[^>]*id=["']vms-phase10-admin-nav["'][^>]*>[\s\S]*?<\/script>/gi,'');
  html=html.replace(/<script\b[^>]*id=["']vms-review-shell["'][^>]*>[\s\S]*?<\/script>/gi,'');

  /* Never treat a filename mentioned in comments/JavaScript as a loaded stylesheet.
     Remove stale shell tags and write one root-absolute canonical CSS + JS reference. */
  html=html.replace(/<link\b[^>]*\bhref=["'][^"']*vms-admin-shell\.css[^"']*["'][^>]*>/gi,'');
  html=html.replace(/<script\b[^>]*\bsrc=["'][^"']*vms-admin-shell\.js[^"']*["'][^>]*>\s*<\/script>/gi,'');

  if(!/<\/head>/i.test(html))throw new Error(`Admin page has no </head>: ${path.basename(file)}`);
  html=html.replace(/<\/head>/i,'<link id="vms-phase4-admin-shell-css" rel="stylesheet" href="/assets/vms-admin-shell.css?v=20260824-phase3-admin-shell"></head>');

  if(!/<\/body>/i.test(html))throw new Error(`Admin page has no </body>: ${path.basename(file)}`);
  html=html.replace(/<\/body>/i,'<script id="vms-phase4-admin-shell" src="/assets/vms-admin-shell.js?v=20260824-phase3-admin-shell" defer></script></body>');
  fs.writeFileSync(file,html);
}
if(fs.existsSync(adminDir))for(const entry of fs.readdirSync(adminDir,{withFileTypes:true})){
  if(!entry.isFile()||!entry.name.endsWith('.html')||entry.name==='login.html')continue;
  ensureCanonicalAdminShell(path.join(adminDir,entry.name));
}

/* Phase 4 canonical Client Portal shell.
   Portal pages use the same root-absolute rescue strategy as Admin so a clean
   Netlify URL can never strand the Portal with raw, unstyled shell markup. */
for(const asset of ['vms-portal-shell.css','vms-portal-shell.js']){
  if(!fs.existsSync(path.join(dist,'assets',asset)))throw new Error(`Canonical Portal shell asset missing: assets/${asset}`);
}
const canonicalPortalDir=path.join(dist,'portal');
function ensureCanonicalPortalShell(file){
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<link\b[^>]*\bhref=["'][^"']*vms-portal-shell\.css[^"']*["'][^>]*>/gi,'');
  html=html.replace(/<script\b[^>]*\bsrc=["'][^"']*vms-portal-shell\.js[^"']*["'][^>]*>\s*<\/script>/gi,'');
  if(!/<\/head>/i.test(html))throw new Error(`Portal page has no </head>: ${path.basename(file)}`);
  html=html.replace(/<\/head>/i,'<link id="vms-phase4-portal-shell-css" rel="stylesheet" href="/assets/vms-portal-shell.css?v=20260824-phase3-portal-shell"></head>');
  if(!/<\/body>/i.test(html))throw new Error(`Portal page has no </body>: ${path.basename(file)}`);
  html=html.replace(/<\/body>/i,'<script id="vms-phase4-portal-shell" src="/assets/vms-portal-shell.js?v=20260824-phase3-portal-shell" defer></script></body>');
  fs.writeFileSync(file,html);
}
if(fs.existsSync(canonicalPortalDir))for(const entry of fs.readdirSync(canonicalPortalDir,{withFileTypes:true})){
  if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
  ensureCanonicalPortalShell(path.join(canonicalPortalDir,entry.name));
}

/* Phase 11: inject the production repair layers without replacing the user's
   approved source-page layouts. These scripts make Clients/Billing database-first,
   add Portal payment activation, repair Audit desktop navigation, and add safe Admin cleanup controls. */
const phase11Assets=['vms-audit-desktop-fix.js','vms-audit-ai-live.js','vms-admin-clients-live.js','vms-admin-billing-live.js','vms-portal-payments.js','vms-admin-cleanup.js','vms-get-started-url.js'];
for(const name of phase11Assets){if(!fs.existsSync(path.join(dist,'assets',name)))throw new Error(`Phase 11 repair asset is missing: assets/${name}`)}
function injectRepair(relative,src,id){const file=path.join(dist,relative);if(!fs.existsSync(file))throw new Error(`Phase 11 target is missing: ${relative}`);let html=fs.readFileSync(file,'utf8');const idNeedle=`id="${id}"`;if(html.includes(idNeedle)){const re=new RegExp(`<script([^>]*\\s)id=["']${id}["']([^>]*)><\\/script>`,`i`);html=html.replace(re,(tag)=>{if(/\bsrc=["'][^"']*["']/i.test(tag))return tag.replace(/\bsrc=["'][^"']*["']/i,`src="${src}"`);return tag.replace(/<script/i,`<script src="${src}"`)});fs.writeFileSync(file,html);return}if(!/<\/body>/i.test(html))throw new Error(`Phase 11 target has no </body>: ${relative}`);html=html.replace(/<\/body>/i,`<script id="${id}" src="${src}" defer></script></body>`);fs.writeFileSync(file,html)}
injectRepair('admin/audit.html','/assets/vms-audit-desktop-fix.js?v=20260824-phase3-audit-layout','vms-phase11-audit-fix');
injectRepair('admin/audit.html','../assets/vms-audit-ai-live.js?v=20260821-phase5','vms-audit-ai-live');
injectRepair('admin/clients.html','../assets/vms-admin-clients-live.js','vms-phase11-clients-live');
injectRepair('admin/billing.html','../assets/vms-admin-billing-live.js','vms-phase11-billing-live');
injectRepair('portal/index.html','../assets/vms-portal-payments.js','vms-phase11-portal-payments');
injectRepair('admin/leads.html','../assets/vms-admin-cleanup.js','vms-phase11-admin-cleanup');
injectRepair('admin/audit.html','../assets/vms-admin-cleanup.js','vms-phase11-audit-cleanup');
injectRepair('get-started.html','assets/vms-get-started-url.js','vms-phase11-get-started-url');


/* Phase 13: VMS Audit page polish. Keep the internal category key `google`
   for backward compatibility with saved audits/API payloads, while the
   customer/admin-facing product name is Local Presence everywhere. */
const auditPolishFile=path.join(dist,'admin','audit.html');
if(!fs.existsSync(auditPolishFile))throw new Error('Audit polish target missing: admin/audit.html');
let auditHtml=fs.readFileSync(auditPolishFile,'utf8');
for(const [from,to] of [
  ['Google Presence Audit','Local Presence Audit'],
  ['Google Presence','Local Presence'],
  ['Google Business Profile setup','Primary local profile setup'],
  ['Google matches website/business info','Listings match website/business info'],
  ['Prioritize Google Business Profile improvements.','Prioritize Local Presence and listing consistency improvements.'],
  ['data-view="google">Google</button>','data-view="google">Local Presence</button>'],
  ['<span>Google</span>','<span>Local Presence</span>']
]) auditHtml=auditHtml.replaceAll(from,to);
fs.writeFileSync(auditPolishFile,auditHtml);

/* Phase 10 final-content cleanup. */
const htmlCleanups=new Map([
  ['admin/index.html',[
    ["promos:['vms_promotions_v2','vms_promotions_prototype_v1']","promos:['vms_promotions_v2']"],
    ["catalog:['vms_service_catalog_v2','vms_service_catalog_demo_v1']","catalog:['vms_service_catalog_v2']"],
    ["function isDemo(item){","function isNonProduction(item){"],
    ["return combined.includes('demo ')||combined.includes('demo-')||combined.includes('@example.')||combined.endsWith('.example');","return combined.includes('@example.')||combined.endsWith('.example');"],
    ["function clean(items){return items.filter(item=>item&&!isDemo(item))}","function clean(items){return items.filter(item=>item&&!isNonProduction(item))}"]
  ]],
  ['admin/audit.html',[["phase5-demo-btn","phase5-utility-btn"]]],
  ['admin/analytics.html',[["No demo data is used.","All metrics come from live production data."]]]
]);
for(const [relative,replacements] of htmlCleanups){const file=path.join(dist,relative);if(!fs.existsSync(file))continue;let html=fs.readFileSync(file,'utf8');for(const [from,to] of replacements)html=html.replaceAll(from,to);fs.writeFileSync(file,html)}

/* Phase 12E: final Admin privacy + stale production-state cleanup.
   The source config previously contained a trusted-tab visual shortcut that could
   remove vms-auth-pending before Supabase re-verified Admin role/MFA. Production
   must stay privacy-gated until VMSAuth.requireSession() finishes successfully. */
for(const relative of ['config.js','assets/config.js']){
  const file=path.join(dist,relative);
  if(!fs.existsSync(file))throw new Error(`Phase 12E config target missing: ${relative}`);
  let code=fs.readFileSync(file,'utf8');
  const startMarker='/*\n  VMS Admin trusted-tab visual gate';
  const endMarker='/* LinkHub live publishing/share/social-icon layer. */';
  const start=code.indexOf(startMarker);
  const end=code.indexOf(endMarker);
  if(start>=0&&end>start)code=code.slice(0,start)+code.slice(end);
  if(code.includes('vms_admin_visual_trust_until'))throw new Error(`Phase 12E failed to remove Admin trusted-tab shortcut from ${relative}`);
  fs.writeFileSync(file,code);
}

/* Stop syncing the retired demo catalog state key into production cloud state.
   This does not delete or alter the live service catalog. */
const stateFile=path.join(dist,'assets','vms-state.js');
if(!fs.existsSync(stateFile))throw new Error('Phase 12E state bridge target missing: assets/vms-state.js');
let stateCode=fs.readFileSync(stateFile,'utf8');
stateCode=stateCode.replaceAll(",'vms_service_catalog_demo_v1'","");
if(stateCode.includes('vms_service_catalog_demo_v1'))throw new Error('Phase 12E failed to remove retired demo catalog state key');
fs.writeFileSync(stateFile,stateCode);



/* Final Polish Phase 1 + Phase 2: load the shared responsive foundation and
   the canonical Admin repair layer without replacing approved page layouts. */
for(const asset of ['vms-final-polish.css','vms-admin-phase2.js']){
  if(!fs.existsSync(path.join(dist,'assets',asset)))throw new Error(`Final polish asset is missing: assets/${asset}`);
}
function injectFinalPolish(relative,{admin=false}={}){
  const file=path.join(dist,relative);
  if(!fs.existsSync(file))return;
  let html=fs.readFileSync(file,'utf8');
  const prefix=relative.startsWith('admin/')||relative.startsWith('portal/')?'../':'';
  const css=`<link id="vms-final-polish-css" rel="stylesheet" href="${prefix}assets/vms-final-polish.css?v=20260826-linkhub-recovery2">`;
  if(!html.includes('id="vms-final-polish-css"')){
    if(!/<\/head>/i.test(html))throw new Error(`Final polish target has no </head>: ${relative}`);
    html=html.replace(/<\/head>/i,css+'</head>');
  }
  if(admin&&!html.includes('id="vms-admin-phase2"')){
    if(!/<\/body>/i.test(html))throw new Error(`Admin Phase 2 target has no </body>: ${relative}`);
    html=html.replace(/<\/body>/i,'<script id="vms-admin-phase2" src="../assets/vms-admin-phase2.js?v=20260821-phase2" defer></script></body>');
  }
  fs.writeFileSync(file,html);
}
for(const relative of ['index.html','services.html','get-started.html'])injectFinalPolish(relative);
for(const area of ['admin','portal']){
  const dir=path.join(dist,area);if(!fs.existsSync(dir))continue;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
    injectFinalPolish(`${area}/${entry.name}`,{admin:area==='admin'&&entry.name!=='login.html'});
  }
}

/* Final Polish Phase 3: keep every client tool inside one Portal shell.
   The index gets the stable section router/settings layer. Legacy standalone
   portal pages redirect before paint to the matching internal section. */
const phase3PortalAsset=path.join(dist,'assets','vms-portal-phase3.js');
if(!fs.existsSync(phase3PortalAsset))throw new Error('Phase 3 Portal asset is missing: assets/vms-portal-phase3.js');
injectRepair('portal/index.html','../assets/vms-portal-phase3.js?v=20260821-phase3','vms-portal-phase3');
const portalRouteMap=[
  [/notification/i,'notifications'],[/schedul|appointment|contact/i,'contact'],[/billing|subscription|invoice/i,'billing'],
  [/link.?hub/i,'linkhub'],[/qr/i,'qrs'],[/audit|report/i,'audits'],[/project/i,'projects'],[/file|asset/i,'files'],[/request/i,'requests'],[/service/i,'services']
];
const portalDir=path.join(dist,'portal');
for(const entry of fs.readdirSync(portalDir,{withFileTypes:true})){
  if(!entry.isFile()||!entry.name.endsWith('.html')||entry.name.toLowerCase()==='index.html')continue;
  const found=portalRouteMap.find(([re])=>re.test(entry.name));
  if(!found)continue;
  const [,section]=found;
  const file=path.join(portalDir,entry.name);
  let html=fs.readFileSync(file,'utf8');
  if(html.includes('id="vms-phase3-portal-redirect"')||html.includes("id='vms-phase3-portal-redirect'"))continue;
  if(!/<head\b/i.test(html))continue;
  const early=`<script id="vms-phase3-portal-redirect">location.replace('/portal/#${section}');</script><style id="vms-phase3-portal-redirect-style">html{background:#f4f7f8}body{visibility:hidden!important}</style>`;
  html=html.replace(/<head([^>]*)>/i,`<head$1>${early}`);
  fs.writeFileSync(file,html);
}

/* Final Polish Phase 4: LinkHub + QR + client service/subscription integration.
   Keep the approved source layouts and add the cloud/entitlement repair layers. */
for(const asset of ['vms-linkhub-phase4.js','vms-qr-phase4.js','vms-portal-payments.js']){
  if(!fs.existsSync(path.join(dist,'assets',asset)))throw new Error(`Phase 4 asset is missing: assets/${asset}`);
}
function firstExisting(candidates){return candidates.find(relative=>fs.existsSync(path.join(dist,relative)))||null}
const p4Linkhub=firstExisting(['admin/linkhub.html','admin/VMS-LinkHub.html','admin/vms-linkhub.html']);
const p4Qr=firstExisting(['admin/qr.html','admin/vms_qr_tools_FINAL_MOBILE_FIXED.html','admin/qr-tools.html']);
if(!p4Linkhub)throw new Error('Phase 4 could not find the Admin LinkHub page.');
if(!p4Qr)throw new Error('Phase 4 could not find the Admin QR Tools page.');
injectRepair(p4Linkhub,'../assets/vms-linkhub-phase4.js?v=20260826-linkhub-recovery2','vms-linkhub-phase4');
/* The legacy prototype used an unconfigured link.visionmakestudio.com host.
   Production uses the working Netlify function route under the primary domain. */
{
  const file=path.join(dist,p4Linkhub);
  let html=fs.readFileSync(file,'utf8');
  html=html.replaceAll('https://link.visionmakestudio.com/','https://visionmakestudio.com/link/');
  fs.writeFileSync(file,html);
}

injectRepair(p4Qr,'../assets/vms-qr-phase4.js?v=20260821-phase4','vms-qr-phase4');
injectRepair('portal/index.html','../assets/vms-linkhub-phase4.js?v=20260826-linkhub-recovery2','vms-portal-linkhub-phase4');
injectRepair('portal/index.html','../assets/vms-qr-phase4.js?v=20260821-phase4','vms-portal-qr-phase4');

/* QR branding is mandatory in VMS Phase 4. Older saved records that explicitly
   disabled it are normalized to branded output as they are opened/exported. */
{
  const file=path.join(dist,p4Qr);let html=fs.readFileSync(file,'utf8');
  html=html.replace(/showVms=item\.showVms!==false;/g,'showVms=true;');
  html=html.replace(/if\(item\.showVms!==false\)\{/g,'if(true){');
  html=html.replace(/clientCardVms\.style\.display=item\.showVms===false\?'none':'block';/g,"clientCardVms.style.display='block';");
  html=html.replace(/showVms=!showVms;\s*vmsToggle\.classList\.toggle\('active',showVms\);\s*vmsToggle\.setAttribute\('aria-pressed',showVms\?'true':'false'\);\s*syncPreview\(\);/g,"showVms=true;vmsToggle.classList.add('active');vmsToggle.setAttribute('aria-pressed','true');syncPreview();");
  fs.writeFileSync(file,html);
}

/* Phase 4 public LinkHub is a real server-rendered route at /link/:slug.
   The Netlify function is copied with the rest of netlify/functions by the repo,
   so no static public page or admin shell can leak into the client LinkHub. */


/* Final Polish Phase 5: Audit AI + client-safe report sharing/printing. */
{
  const reportFile=path.join(dist,'audit-report.html');
  if(!fs.existsSync(reportFile))throw new Error('Phase 5 public Audit report page is missing.');
  const reportHtml=fs.readFileSync(reportFile,'utf8');
  if(/vms-admin-sidebar|vms-admin-topbar|VMS ADMIN/i.test(reportHtml))throw new Error('Phase 5 client Audit report must not contain Admin chrome.');
  if(!reportHtml.includes('/api/public-audit-report'))throw new Error('Phase 5 report token resolver is missing from audit-report.html.');
  const auditFile=path.join(dist,'admin','audit.html');
  if(!fs.existsSync(auditFile))throw new Error('Phase 5 Admin Audit target is missing.');
  let html=fs.readFileSync(auditFile,'utf8');
  if(!html.includes('vms-audit-ai-live.js?v=20260821-phase5')){
    html=html.replace(/vms-audit-ai-live\.js(?:\?[^"']*)?/i,'vms-audit-ai-live.js?v=20260821-phase5');
    fs.writeFileSync(auditFile,html);
  }
}

/* Final Polish Phase 6: final integration + launch QA guards.
   This is intentionally fail-closed: the publish build must stop rather than
   ship an incomplete Admin/Portal/Public integration. */
{
  const requireDist=(relative)=>{
    const file=path.join(dist,relative);
    if(!fs.existsSync(file))throw new Error(`Phase 6 required publish file is missing: ${relative}`);
    return file;
  };
  const readDist=(relative)=>fs.readFileSync(requireDist(relative),'utf8');

  for(const relative of [
    'index.html','services.html','get-started.html','audit-report.html',
    'admin/index.html','admin/audit.html','admin/clients.html','admin/billing.html',
    'portal/index.html',
    'assets/vms-core.js','assets/vms-auth-guard.js','assets/vms-final-polish.css','assets/vms-admin-phase2.js','assets/vms-admin-shell.css','assets/vms-admin-shell.js','assets/vms-portal-shell.css','assets/vms-portal-shell.js',
    'assets/vms-portal-phase3.js','assets/vms-linkhub-phase4.js','assets/vms-qr-phase4.js',
    'assets/vms-audit-ai-live.js','assets/vms-portal-payments.js'
  ]) requireDist(relative);

  const portal=readDist('portal/index.html');
  for(const marker of [
    'vms-phase11-portal-payments','vms-portal-phase3',
    'vms-portal-linkhub-phase4','vms-portal-qr-phase4'
  ]) if(!portal.includes(marker))throw new Error(`Phase 6 Portal integration marker missing: ${marker}`);

  const audit=readDist('admin/audit.html');
  for(const marker of ['vms-admin-phase2','vms-audit-ai-live','vms-phase11-audit-cleanup'])
    if(!audit.includes(marker))throw new Error(`Phase 6 Audit integration marker missing: ${marker}`);

  const clients=readDist('admin/clients.html');
  if(!clients.includes('vms-phase11-clients-live'))throw new Error('Phase 6 Clients database repair layer is missing.');
  const billing=readDist('admin/billing.html');
  if(!billing.includes('vms-phase11-billing-live'))throw new Error('Phase 6 Billing database repair layer is missing.');

  const publicReport=readDist('audit-report.html');
  if(/vms-admin-sidebar|vms-admin-topbar|VMS ADMIN/i.test(publicReport))
    throw new Error('Phase 6 public Audit report leaked Admin chrome.');
  if(!publicReport.includes('/api/public-audit-report'))
    throw new Error('Phase 6 public Audit report token resolver is missing.');

  const rootHtml=['index.html','services.html','get-started.html','audit-report.html'];
  const htmlFiles=[...rootHtml.map(requireDist)];
  for(const area of ['admin','portal']){
    const dir=path.join(dist,area);
    for(const entry of fs.readdirSync(dir,{withFileTypes:true}))
      if(entry.isFile()&&entry.name.endsWith('.html'))htmlFiles.push(path.join(dir,entry.name));
  }
  for(const file of htmlFiles){
    const html=fs.readFileSync(file,'utf8');
    const relative=path.relative(dist,file);
    const marker=html.match(/\b(?:demo|sample|testing)\b/i);
    if(marker)throw new Error(`Phase 6 non-production marker in ${relative}: ${marker[0]}`);
    if(html.includes('link.visionmakestudio.com'))throw new Error(`Phase 6 retired LinkHub host leaked into ${relative}`);
    if(/(?:localhost|127\.0\.0\.1)/i.test(html))throw new Error(`Phase 6 local-only URL leaked into ${relative}`);
  }
}

console.log(`VMS Phase 6 publish directory created and integration guards passed: ${dist}`);
