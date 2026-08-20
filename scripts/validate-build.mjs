import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];const warnings=[];const stats={html:0,links:0,scripts:0,adminPages:0};
const skipDirs=new Set(['node_modules','.netlify','.git','dist']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(skipDirs.has(e.name))return[];const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]})}
const files=walk(root),htmlFiles=files.filter(f=>f.endsWith('.html'));
const rel=f=>path.relative(root,f).split(path.sep).join('/');
function existsLocal(base,raw){
  let ref=String(raw||'').trim();
  if(!ref||ref.startsWith('#')||/^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(ref)||ref.includes('${'))return true;
  ref=ref.split('#')[0].split('?')[0];if(!ref)return true;
  let target=ref.startsWith('/')?path.join(root,ref):path.resolve(path.dirname(base),ref);
  try{if(fs.existsSync(target)){if(fs.statSync(target).isDirectory())return fs.existsSync(path.join(target,'index.html'));return true}}catch{}
  return false;
}
function stripScriptsStyles(s){return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')}
for(const file of htmlFiles){
  stats.html++;const source=fs.readFileSync(file,'utf8');const clean=stripScriptsStyles(source);
  for(const m of clean.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)){
    stats.links++;if(!existsLocal(file,m[1]))failures.push(`${rel(file)}: missing local reference ${m[1]}`);
  }
  for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=m[1]||'',code=m[2]||'';if(/\bsrc\s*=/.test(attrs)||/type\s*=\s*["'](?:application\/json|importmap)["']/i.test(attrs)||!code.trim())continue;
    stats.scripts++;
    try{new vm.Script(code,{filename:rel(file)})}catch(e){failures.push(`${rel(file)}: inline JS syntax error: ${e.message}`)}
  }
  // Catch common runtime wiring errors that a syntax-only pass cannot see.
  const ids=[...clean.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
  const idSet=new Set(ids);
  const sourceIdSet=new Set([...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]).filter(id=>!id.includes('${')));
  const duplicateIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  if(duplicateIds.length)failures.push(`${rel(file)}: duplicate HTML id(s): ${duplicateIds.join(', ')}`);
  // Only treat a simple #id selector passed to $() as an ID lookup.
  // The previous validator compared '#tracked' directly with the HTML id 'tracked',
  // causing false failures on valid selectors and compound selectors.
  for(const m of source.matchAll(/\$\(\s*["']#([A-Za-z_][A-Za-z0-9_:.-]*)["']\s*\)/g)){
    const id=m[1];
    if(!sourceIdSet.has(id))failures.push(`${rel(file)}: script references missing element id via $(): #${id}`);
  }
}

const adminPages=['index.html','audit.html','qr.html','clients.html','service-catalog.html','billing.html','promotions.html','projects.html','files.html','activity.html','linkhub.html'];
const menuLabels=['Home','VMS Audit','QR Tools','Clients','Service Catalog','Billing / Subscriptions','Promotions','Projects & Requests','Files & Assets','Notifications & Activity','VMS LinkHub'];
for(const name of adminPages){
  const file=path.join(root,'admin',name);if(!fs.existsSync(file)){failures.push(`admin/${name}: missing`);continue}stats.adminPages++;
  const s=fs.readFileSync(file,'utf8');
  if(!s.includes('vms-admin-shell.css'))failures.push(`admin/${name}: shared Admin shell CSS missing`);
  if(!s.includes('vms-admin-shell.js'))failures.push(`admin/${name}: shared Admin shell JS missing`);
  for(const label of menuLabels)if(!s.includes(label))failures.push(`admin/${name}: Admin menu label missing: ${label}`);
}

const catalog=fs.readFileSync(path.join(root,'assets','vms-catalog.js'),'utf8');
const requiredPricing=[
  ["linkhub-core",'5.99'],["linkhub-wifi",'6.99'],["linkhub-menu",'49.99'],["linkhub-pro",'19.99'],["vms-activation-fee",'4.99'],["smart-qr",'14.99']
];
for(const [key,price] of requiredPricing){
  const idx=catalog.indexOf(`id:'${key}'`);if(idx<0){failures.push(`catalog missing ${key}`);continue}
  const chunk=catalog.slice(idx,idx+1200);if(!chunk.includes(price))failures.push(`catalog ${key} does not contain expected ${price}`);
}
if(/smart-qr[^\n]{0,900}(setupPrice|setup:99|recurringPrice\s*:\s*19(?![\d.]))/i.test(catalog))failures.push('Smart QR still contains legacy setup/monthly pricing in central catalog');
if(!catalog.includes("name:'VMS LinkHub Pro'")||!catalog.includes('Smart Scan Activity'))failures.push('LinkHub Pro entitlements incomplete');

const schema=fs.readFileSync(path.join(root,'supabase','schema.sql'),'utf8');
for(const needle of ['workspace_state','vms-client-files','smart-qr','linkhub-core','linkhub-pro','linkhub-menu','linkhub-wifi'])if(!schema.includes(needle))failures.push(`Supabase schema missing ${needle}`);

const clientsPage=fs.readFileSync(path.join(root,'admin','clients.html'),'utf8');
for(const needle of ['../assets/vms-catalog.js','profilePortalInviteBtn','/api/client-account','VMS_CLIENT_CLOUD_SYNC'])if(!clientsPage.includes(needle))failures.push(`Clients production bridge missing ${needle}`);
const billingPage=fs.readFileSync(path.join(root,'admin','billing.html'),'utf8');
for(const forbidden of ['secure-checkout://prototype','Simulate Paid','richDemoData','loadDemoData'])if(billingPage.includes(forbidden))failures.push(`Billing still contains prototype checkout behavior: ${forbidden}`);
if(!billingPage.includes('Online Checkout · Connect Provider')||!billingPage.includes("let posPaymentPath='manual'"))failures.push('Billing must default to manual payment until a real payment provider is connected');
const allProductText=[catalog,schema,clientsPage,billingPage,fs.readFileSync(path.join(root,'admin','linkhub.html'),'utf8'),fs.readFileSync(path.join(root,'portal','index.html'),'utf8')].join('\n');
for(const forbidden of ['Smart QR monthly','setupPrice:99'])if(allProductText.includes(forbidden))failures.push(`Legacy product pricing remains: ${forbidden}`);

const funcs=['health.mts','intake.mts','ai-audit.mts','requests.mts','audits.mts','review-lookup.mts','client-event.mts','client-account.mts'];
for(const f of funcs)if(!fs.existsSync(path.join(root,'netlify','functions',f)))failures.push(`Netlify function missing ${f}`);

const toml=fs.readFileSync(path.join(root,'netlify.toml'),'utf8');
if(!/command\s*=\s*["']npm run build["']/.test(toml))failures.push('netlify.toml build command is not npm run build');
if(!/functions\s*=\s*["']netlify\/functions["']/.test(toml))failures.push('netlify.toml functions directory missing');
if(!/publish\s*=\s*["']dist["']/.test(toml))failures.push('netlify.toml publish directory must be dist');

const report={ok:failures.length===0,checkedAt:new Date().toISOString(),stats,failures,warnings};
fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa','final-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
