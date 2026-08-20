import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');

fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});

for(const item of ['index.html','services.html','get-started.html','404.html','robots.txt','sitemap.xml','config.js','assets','admin','portal']){
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

/* Phase 10 privacy hardening. */
const privacyGate=String.raw`<script id="vms-phase10-privacy-gate">if(location.protocol!=='file:')document.documentElement.classList.add('vms-auth-pending');</script><style id="vms-phase10-privacy-style">html.vms-auth-pending body{overflow:hidden!important}html.vms-auth-pending body>*{visibility:hidden!important}html.vms-auth-pending body::before{content:'Verifying secure session…';position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#003049;color:#fff;font:800 14px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;visibility:visible!important}</style>`;
function ensurePrivacyGate(file){if(!fs.existsSync(file))return;let html=fs.readFileSync(file,'utf8');if(html.includes('vms-auth-pending'))return;if(!/<head\b/i.test(html))throw new Error(`Protected page has no <head>: ${path.relative(dist,file)}`);html=html.replace(/<head([^>]*)>/i,`<head$1>${privacyGate}`);fs.writeFileSync(file,html)}
for(const area of ['admin','portal']){const dir=path.join(dist,area);if(!fs.existsSync(dir))continue;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(!entry.isFile()||!entry.name.endsWith('.html'))continue;if(area==='admin'&&entry.name==='login.html')continue;ensurePrivacyGate(path.join(dir,entry.name))}}

/* Phase 10 Admin navigation harmonization. */
const adminNavScript=String.raw`<script id="vms-phase10-admin-nav">(function(){function run(){var nav=document.querySelector('aside.sidebar nav,aside.side nav,aside.sidebar .nav,aside.side .nav');if(!nav)return;var wanted=[['Analytics','analytics.html'],['CRM / Leads','leads.html'],['Sales Content','marketing.html'],['Automations','automations.html'],['Security','security.html']];var current=((location.pathname||'').split('/').filter(Boolean).pop()||'index').replace(/\.html$/i,'').toLowerCase();var existing=new Set(Array.from(nav.querySelectorAll('a[href]')).map(function(a){return (a.getAttribute('href')||'').split('?')[0].split('#')[0].toLowerCase()}));var templateLink=nav.querySelector('a');wanted.forEach(function(item){var label=item[0],href=item[1];if(existing.has(href.toLowerCase())||existing.has('./'+href.toLowerCase()))return;var a=document.createElement('a');a.href=href;a.textContent=label;if(templateLink)a.className=(templateLink.className||'').replace(/\bactive\b/g,'').trim();if(href.replace(/\.html$/i,'').toLowerCase()===current)a.classList.add('active');nav.appendChild(a)});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();})();</script>`;
const adminDir=path.join(dist,'admin');
if(fs.existsSync(adminDir)){for(const entry of fs.readdirSync(adminDir,{withFileTypes:true})){if(!entry.isFile()||!entry.name.endsWith('.html')||entry.name==='login.html')continue;const file=path.join(adminDir,entry.name);let html=fs.readFileSync(file,'utf8');if(!html.includes('vms-phase10-admin-nav')){if(!/<\/body>/i.test(html))throw new Error(`Admin page has no </body>: ${entry.name}`);html=html.replace(/<\/body>/i,`${adminNavScript}</body>`);fs.writeFileSync(file,html)}}}

/* Phase 11: inject the production repair layers without replacing the user's
   approved source-page layouts. These scripts make Clients/Billing database-first,
   add Portal payment activation, repair Audit desktop navigation, and add safe Admin cleanup controls. */
const phase11Assets=['vms-audit-desktop-fix.js','vms-audit-ai-live.js','vms-admin-clients-live.js','vms-admin-billing-live.js','vms-portal-payments.js','vms-admin-cleanup.js','vms-get-started-url.js'];
for(const name of phase11Assets){if(!fs.existsSync(path.join(dist,'assets',name)))throw new Error(`Phase 11 repair asset is missing: assets/${name}`)}
function injectRepair(relative,src,id){const file=path.join(dist,relative);if(!fs.existsSync(file))throw new Error(`Phase 11 target is missing: ${relative}`);let html=fs.readFileSync(file,'utf8');if(html.includes(`id="${id}"`))return;if(!/<\/body>/i.test(html))throw new Error(`Phase 11 target has no </body>: ${relative}`);html=html.replace(/<\/body>/i,`<script id="${id}" src="${src}" defer></script></body>`);fs.writeFileSync(file,html)}
injectRepair('admin/audit.html','../assets/vms-audit-desktop-fix.js','vms-phase11-audit-fix');
injectRepair('admin/audit.html','../assets/vms-audit-ai-live.js','vms-audit-ai-live');
injectRepair('admin/clients.html','../assets/vms-admin-clients-live.js','vms-phase11-clients-live');
injectRepair('admin/billing.html','../assets/vms-admin-billing-live.js','vms-phase11-billing-live');
injectRepair('portal/index.html','../assets/vms-portal-payments.js','vms-phase11-portal-payments');
injectRepair('admin/leads.html','../assets/vms-admin-cleanup.js','vms-phase11-admin-cleanup');
injectRepair('admin/audit.html','../assets/vms-admin-cleanup.js','vms-phase11-audit-cleanup');
injectRepair('get-started.html','assets/vms-get-started-url.js','vms-phase11-get-started-url');

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

console.log(`VMS publish directory created: ${dist}`);
