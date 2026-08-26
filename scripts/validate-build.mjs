import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];const warnings=[];const stats={html:0,links:0,scripts:0,adminPages:0,portalPages:0};
const skipDirs=new Set(['node_modules','.netlify','.git','dist']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(skipDirs.has(e.name))return[];const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]})}
const files=walk(root),htmlFiles=files.filter(f=>f.endsWith('.html'));
const rel=f=>path.relative(root,f).split(path.sep).join('/');
function existsLocal(base,raw){
  let ref=String(raw||'').trim();
  if(!ref||ref.startsWith('#')||/^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(ref)||ref.includes('${'))return true;
  ref=ref.split('#')[0].split('?')[0];if(!ref)return true;
  const target=ref.startsWith('/')?path.join(root,ref):path.resolve(path.dirname(base),ref);
  try{if(fs.existsSync(target)){if(fs.statSync(target).isDirectory())return fs.existsSync(path.join(target,'index.html'));return true}}catch{}
  return false;
}
function stripScriptsStyles(s){return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')}
function scriptType(attrs){return String(attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]||'').trim().toLowerCase()}
function isClassicJs(type){return !type||['text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type)}
function scriptSrc(attrs){return attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]||''}

for(const file of htmlFiles){
  stats.html++;
  const source=fs.readFileSync(file,'utf8'),clean=stripScriptsStyles(source);
  for(const m of clean.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)){
    stats.links++;if(!existsLocal(file,m[1]))failures.push(`${rel(file)}: missing local reference ${m[1]}`);
  }
  for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=m[1]||'',code=m[2]||'',src=scriptSrc(attrs);
    if(src){stats.links++;if(!existsLocal(file,src))failures.push(`${rel(file)}: missing local script ${src}`);continue}
    const type=scriptType(attrs);if(!isClassicJs(type)||!code.trim())continue;
    stats.scripts++;
    try{new vm.Script(code,{filename:rel(file)})}catch(e){failures.push(`${rel(file)}: inline JS syntax error: ${e.message}`)}
  }
  const ids=[...clean.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
  const sourceIdSet=new Set([...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]).filter(id=>!id.includes('${')));
  const duplicateIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  if(duplicateIds.length)failures.push(`${rel(file)}: duplicate HTML id(s): ${duplicateIds.join(', ')}`);
  for(const m of source.matchAll(/\$\(\s*["']#([A-Za-z_][A-Za-z0-9_:.-]*)["']\s*\)/g)){
    const id=m[1];if(!sourceIdSet.has(id))failures.push(`${rel(file)}: script references missing element id via $(): #${id}`);
  }
}

const protectedAdmin=['index.html','audit.html','qr.html','clients.html','service-catalog.html','billing.html','promotions.html','projects.html','files.html','activity.html','linkhub.html','leads.html','automations.html','analytics.html','marketing.html','security.html'];
const shellAdmin=new Set(protectedAdmin.filter(x=>x!=='security.html'));
for(const name of protectedAdmin){
  const file=path.join(root,'admin',name);if(!fs.existsSync(file)){failures.push(`admin/${name}: missing`);continue}stats.adminPages++;
  const s=fs.readFileSync(file,'utf8');
  if(shellAdmin.has(name)){
    if(!s.includes('vms-admin-shell.css'))failures.push(`admin/${name}: shared Admin shell CSS missing`);
    if(!s.includes('vms-admin-shell.js'))failures.push(`admin/${name}: shared Admin shell JS missing`);
  }
  if(!s.includes('vms-auth-pending'))warnings.push(`admin/${name}: source privacy gate missing; Phase 10 publish gate will be injected`);
}
if(!fs.existsSync(path.join(root,'admin','login.html')))failures.push('admin/login.html: missing');

const portalPages=['index.html','onboarding.html','preferences.html','qr.html','schedule.html'];
for(const name of portalPages){
  const file=path.join(root,'portal',name);if(!fs.existsSync(file)){failures.push(`portal/${name}: missing`);continue}stats.portalPages++;
  const s=fs.readFileSync(file,'utf8');
  if(!s.includes('vms-auth-pending'))warnings.push(`portal/${name}: source privacy gate missing; Phase 10 publish gate will be injected`);
}

for(const required of ['index.html','services.html','get-started.html','404.html','robots.txt','sitemap.xml','config.js','assets/config.js','assets/vms-core.js','assets/vms-catalog.js']){
  if(!fs.existsSync(path.join(root,required)))failures.push(`required launch file missing: ${required}`);
}

const catalog=fs.readFileSync(path.join(root,'assets','vms-catalog.js'),'utf8');
const requiredPricing=[["linkhub-core",'5.99'],["linkhub-wifi",'6.99'],["linkhub-menu",'49.99'],["linkhub-pro",'19.99'],["vms-activation-fee",'4.99'],["smart-qr",'14.99']];
for(const [key,price] of requiredPricing){const idx=catalog.indexOf(`id:'${key}'`);if(idx<0){failures.push(`catalog missing ${key}`);continue}const chunk=catalog.slice(idx,idx+1200);if(!chunk.includes(price))failures.push(`catalog ${key} does not contain expected ${price}`)}
if(/smart-qr[^\n]{0,900}(setupPrice|setup:99|recurringPrice\s*:\s*19(?![\d.]))/i.test(catalog))failures.push('Smart QR still contains legacy setup/monthly pricing in central catalog');
if(!catalog.includes("name:'VMS LinkHub Pro'")||!catalog.includes('Smart Scan Activity'))failures.push('LinkHub Pro entitlements incomplete');

const schema=fs.readFileSync(path.join(root,'supabase','schema.sql'),'utf8');
for(const needle of ['workspace_state','vms-client-files','smart-qr','linkhub-core','linkhub-pro','linkhub-menu','linkhub-wifi'])if(!schema.includes(needle))failures.push(`Supabase schema missing ${needle}`);
if(fs.existsSync(path.join(root,'supabase','    migrations')))warnings.push('Legacy malformed migration folder still exists: supabase/    migrations');
if(!fs.existsSync(path.join(root,'supabase','migrations','20260820_phase9_public_sales_marketing.sql')))failures.push('Phase 9 migration history missing from correct supabase/migrations path');
if(!fs.existsSync(path.join(root,'supabase','migrations','20260820_phase10_launch_hardening.sql')))failures.push('Phase 10 migration history missing from correct supabase/migrations path');

const clientsPage=fs.readFileSync(path.join(root,'admin','clients.html'),'utf8');
for(const needle of ['../assets/vms-catalog.js','profilePortalInviteBtn','/api/client-account','VMS_CLIENT_CLOUD_SYNC'])if(!clientsPage.includes(needle))failures.push(`Clients production bridge missing ${needle}`);
const billingPage=fs.readFileSync(path.join(root,'admin','billing.html'),'utf8');
for(const forbidden of ['secure-checkout://prototype','Simulate Paid','richDemoData','loadDemoData'])if(billingPage.includes(forbidden))failures.push(`Billing still contains prototype checkout behavior: ${forbidden}`);
if(!billingPage.includes('Online Checkout · Connect Provider')||!billingPage.includes("let posPaymentPath='manual'"))failures.push('Billing must default to manual payment until a real payment provider is connected');
const allProductText=[catalog,schema,clientsPage,billingPage,fs.readFileSync(path.join(root,'admin','linkhub.html'),'utf8'),fs.readFileSync(path.join(root,'portal','index.html'),'utf8')].join('\n');
for(const forbidden of ['Smart QR monthly','setupPrice:99'])if(allProductText.includes(forbidden))failures.push(`Legacy product pricing remains: ${forbidden}`);

const funcs=['ai-audit.mts','analytics.mts','analytics-snapshot.mts','audits.mts','automation-events-runner.mts','automation-runner.mts','automations.mts','billing-account.mts','billing-checkout.mts','client-account.mts','client-event.mts','health.mts','intake.mts','leads.mts','linkhub.mts','marketing-content.mts','notification-preferences.mts','notify.mts','onboarding.mts','public-sales.mts','qr.mts','qr-redirect.mts','requests.mts','review-lookup.mts','schedule.mts','service-page.mts','stripe-webhook.mts'];
for(const f of funcs)if(!fs.existsSync(path.join(root,'netlify','functions',f)))failures.push(`Netlify function missing ${f}`);
const linkhubFunction=fs.readFileSync(path.join(root,'netlify','functions','linkhub.mts'),'utf8');
for(const needle of ['/api/linkhub-event','linkhub_view','linkhub_click','activity_events'])if(!linkhubFunction.includes(needle))failures.push(`LinkHub real analytics bridge missing ${needle}`);
const portalSource=fs.readFileSync(path.join(root,'portal','index.html'),'utf8');
if(/id="linkHubViews">1,284|id="linkHubClicks">63/.test(portalSource))failures.push('Portal LinkHub still exposes placeholder analytics totals');
const adminLinkHubSource=fs.readFileSync(path.join(root,'admin','linkhub.html'),'utf8');
for(const needle of ['<summary>Actions</summary>','linkhub-phone-screen public-page','linkhub-phone-island','row-actions-menu'])if(!adminLinkHubSource.includes(needle))failures.push(`Admin LinkHub parity repair missing ${needle}`);
if(adminLinkHubSource.includes('data-link-action="up" type="button"')&&!adminLinkHubSource.includes('Move up</button>'))failures.push('Admin LinkHub still exposes separate row action buttons');
for(const needle of ['id="publishQr"','../assets/vms-qrcode.js','vms-linkhub-admin-cloud'])if(!adminLinkHubSource.includes(needle))failures.push(`Admin LinkHub live-state repair missing ${needle}`);
if(adminLinkHubSource.includes("$('hubWifiEnabled').checked=true")||adminLinkHubSource.includes("$('hubMenuEnabled').checked=true"))failures.push('Admin LinkHub plan rules still force optional public features on');
const linkHubPhase4=fs.readFileSync(path.join(root,'assets','vms-linkhub-phase4.js'),'utf8');
for(const needle of ['vms-linkhub-style','pendingStyle=null'])if(!linkHubPhase4.includes(needle))failures.push(`LinkHub appearance state repair missing ${needle}`);
if(linkHubPhase4.includes("attributes:true,attributeFilter:['class','style']"))failures.push('LinkHub observer still resets the Admin modal while scrolling');
if(!portalSource.includes('save();renderLinkHub();renderActivity();renderNotifications()'))failures.push('Portal LinkHub publish still performs an unsafe full-page redraw');
for(const needle of ['client-linkhub-workspace','data-client-linkhub-tab="profile"','data-client-linkhub-tab="appearance"','setClientLinkHubPane','closeClientLinkHubWorkspace','toggleClientLinkHubPreviewBtn','setClientLinkHubMobilePreview','mobile-preview-open'])if(!portalSource.includes(needle))failures.push(`Client LinkHub floating workspace missing ${needle}`);
if(!portalSource.includes('linkhub-phone-island'))failures.push('Client LinkHub iPhone shell marker is missing');
const finalPolish=fs.readFileSync(path.join(root,'assets','vms-final-polish.css'),'utf8');
for(const needle of ['aspect-ratio:9/19.5','linkhub-phone-island','outline:3px solid #6f7a80'])if(!finalPolish.includes(needle))failures.push(`Shared LinkHub iPhone shell repair missing ${needle}`);
if(!linkhubFunction.includes('linear-gradient(${gradientDir},${gradientA},${gradientB})'))failures.push('Public LinkHub gradient renderer is missing');
for(const needle of ['const pageColor = gradientA && gradientB ? gradientA','--pageBg:${pageColor}','min-height:100dvh','env(safe-area-inset-bottom)','body:before'])if(!linkhubFunction.includes(needle))failures.push(`Public LinkHub full-viewport background repair missing ${needle}`);
if(linkhubFunction.includes('<meta name="theme-color" content="${bg}"'))failures.push('Public LinkHub is sending an invalid gradient as the mobile browser theme color');
const legacyPublicLinkhub=fs.readFileSync(path.join(root,'netlify','functions','public-linkhub.mts'),'utf8');
for(const needle of ['themeColor=hasGradient','--page-bg:${themeColor}','min-height:100dvh','env(safe-area-inset-bottom)','body:before'])if(!legacyPublicLinkhub.includes(needle))failures.push(`Fallback public LinkHub full-viewport repair missing ${needle}`);
const authCore=fs.readFileSync(path.join(root,'assets','vms-core.js'),'utf8');
for(const needle of ['capturePortalAuthCallback','finishPortalAuthCallback','verifyOtp({token_hash:callback.tokenHash','exchangeCodeForSession(callback.code)','setSession({'])if(!authCore.includes(needle))failures.push(`Portal mobile magic-link recovery missing ${needle}`);
const memberMagicLink=fs.readFileSync(path.join(root,'netlify','functions','member-magic-link.mts'),'utf8');
for(const needle of ['hashedToken','token_hash','auth_callback'])if(!memberMagicLink.includes(needle))failures.push(`Member magic-link first-party callback missing ${needle}`);

for(const accidental of ['promotions.html','marketing.html','intake.mts','marketing-content.mts','public-sales.mts','public-sales (1).mts','service-page.mts','20260820_phase9_public_sales_marketing.sql'])if(fs.existsSync(path.join(root,accidental)))failures.push(`accidental root upload remains: ${accidental}`);

const toml=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');
if(!/command\s*=\s*["']npm run build["']/.test(toml))failures.push('netlify.toml build command is not npm run build');
if(!/functions\s*=\s*["']netlify\/functions["']/.test(toml))failures.push('netlify.toml functions directory missing');
if(!/publish\s*=\s*["']dist["']/.test(toml))failures.push('netlify.toml publish directory must be dist');
for(const header of ['X-Frame-Options','Strict-Transport-Security','Content-Security-Policy'])if(!toml.includes(header))failures.push(`netlify.toml launch security header missing: ${header}`);

const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');
if(!robots.includes('Disallow: /admin/')||!robots.includes('Disallow: /portal/')||!robots.includes('Sitemap: https://visionmakestudio.com/sitemap.xml'))failures.push('robots.txt launch rules incomplete');
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
if(!sitemap.includes('https://visionmakestudio.com/')||!sitemap.includes('https://visionmakestudio.com/services.html'))failures.push('sitemap.xml launch URLs incomplete');

const report={ok:failures.length===0,checkedAt:new Date().toISOString(),stats,failures,warnings};
fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa','final-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
