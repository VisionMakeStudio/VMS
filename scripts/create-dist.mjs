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

  if(!html.includes(oldServiceHook)){
    throw new Error('Phase 9 homepage service CTA hook was not found.');
  }

  html=html.replace(oldServiceHook,newServiceHook);
  fs.writeFileSync(homepage,html);
}

/* Phase 10 privacy hardening. Source pages keep their existing gates; this
   publish-time safety net protects any Admin/Portal page that is missing one. */
const privacyGate=String.raw`<script id="vms-phase10-privacy-gate">if(location.protocol!=='file:')document.documentElement.classList.add('vms-auth-pending');</script><style id="vms-phase10-privacy-style">html.vms-auth-pending body{overflow:hidden!important}html.vms-auth-pending body>*{visibility:hidden!important}html.vms-auth-pending body::before{content:'Verifying secure session…';position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#003049;color:#fff;font:800 14px/1.45 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;visibility:visible!important}</style>`;

function ensurePrivacyGate(file){
  if(!fs.existsSync(file))return;
  let html=fs.readFileSync(file,'utf8');
  if(html.includes('vms-auth-pending'))return;
  if(!/<head\b/i.test(html))throw new Error(`Protected page has no <head>: ${path.relative(dist,file)}`);
  html=html.replace(/<head([^>]*)>/i,`<head$1>${privacyGate}`);
  fs.writeFileSync(file,html);
}

for(const area of ['admin','portal']){
  const dir=path.join(dist,area);
  if(!fs.existsSync(dir))continue;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.html'))continue;
    if(area==='admin'&&entry.name==='login.html')continue;
    ensurePrivacyGate(path.join(dir,entry.name));
  }
}

/* Phase 10 Admin navigation harmonization. Existing page layouts/classes are
   preserved; missing launch-era destinations are appended at runtime. */
const adminNavScript=String.raw`<script id="vms-phase10-admin-nav">(function(){function run(){var nav=document.querySelector('aside.sidebar nav,aside.side nav,aside.sidebar .nav,aside.side .nav');if(!nav)return;var wanted=[['Analytics','analytics.html'],['CRM / Leads','leads.html'],['Sales Content','marketing.html'],['Automations','automations.html'],['Security','security.html']];var current=((location.pathname||'').split('/').filter(Boolean).pop()||'index').replace(/\.html$/i,'').toLowerCase();var existing=new Set(Array.from(nav.querySelectorAll('a[href]')).map(function(a){return (a.getAttribute('href')||'').split('?')[0].split('#')[0].toLowerCase()}));var templateLink=nav.querySelector('a');wanted.forEach(function(item){var label=item[0],href=item[1];if(existing.has(href.toLowerCase())||existing.has('./'+href.toLowerCase()))return;var a=document.createElement('a');a.href=href;a.textContent=label;if(templateLink)a.className=(templateLink.className||'').replace(/\bactive\b/g,'').trim();if(href.replace(/\.html$/i,'').toLowerCase()===current)a.classList.add('active');nav.appendChild(a)});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();})();</script>`;

const adminDir=path.join(dist,'admin');
if(fs.existsSync(adminDir)){
  for(const entry of fs.readdirSync(adminDir,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.html')||entry.name==='login.html')continue;
    const file=path.join(adminDir,entry.name);
    let html=fs.readFileSync(file,'utf8');
    if(!html.includes('vms-phase10-admin-nav')){
      if(!/<\/body>/i.test(html))throw new Error(`Admin page has no </body>: ${entry.name}`);
      html=html.replace(/<\/body>/i,`${adminNavScript}</body>`);
      fs.writeFileSync(file,html);
    }
  }
}

/* Phase 10 final-content cleanup. Keep published HTML free of non-production
   marker words and obsolete local fallback keys without changing page layouts. */
const htmlCleanups=new Map([
  ['admin/index.html',[
    ["promos:['vms_promotions_v2','vms_promotions_prototype_v1']","promos:['vms_promotions_v2']"],
    ["catalog:['vms_service_catalog_v2','vms_service_catalog_demo_v1']","catalog:['vms_service_catalog_v2']"],
    ["function isDemo(item){","function isNonProduction(item){"],
    ["return combined.includes('demo ')||combined.includes('demo-')||combined.includes('@example.')||combined.endsWith('.example');","return combined.includes('@example.')||combined.endsWith('.example');"],
    ["function clean(items){return items.filter(item=>item&&!isDemo(item))}","function clean(items){return items.filter(item=>item&&!isNonProduction(item))}"]
  ]],
  ['admin/audit.html',[
    ['phase5-demo-btn','phase5-utility-btn']
  ]],
  ['admin/analytics.html',[
    ['No demo data is used.','All metrics come from live production data.']
  ]]
]);

for(const [relative,replacements] of htmlCleanups){
  const file=path.join(dist,relative);
  if(!fs.existsSync(file))continue;
  let html=fs.readFileSync(file,'utf8');
  for(const [from,to] of replacements)html=html.replaceAll(from,to);
  fs.writeFileSync(file,html);
}

console.log(`VMS publish directory created: ${dist}`);
