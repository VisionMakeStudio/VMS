import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(project,'dist');
const failures=[];const stats={html:0,links:0,scripts:0,protectedAdmin:0,protectedPortal:0};
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]})}
function stripScriptsStyles(s){return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')}
function existsLocal(base,raw){let ref=String(raw||'').trim();if(!ref||ref.startsWith('#')||/^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(ref)||ref.includes('${'))return true;ref=ref.split('#')[0].split('?')[0];if(!ref)return true;const target=ref.startsWith('/')?path.join(root,ref):path.resolve(path.dirname(base),ref);if(!fs.existsSync(target))return false;return !fs.statSync(target).isDirectory()||fs.existsSync(path.join(target,'index.html'))}
function scriptType(attrs){return String(attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]||'').trim().toLowerCase()}
function isClassicJs(type){return !type||['text/javascript','application/javascript','text/ecmascript','application/ecmascript'].includes(type)}
function scriptSrc(attrs){return attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]||''}
if(!fs.existsSync(root))failures.push('dist/ was not generated');
else for(const file of walk(root).filter(f=>f.endsWith('.html'))){
  stats.html++;const source=fs.readFileSync(file,'utf8'),clean=stripScriptsStyles(source);
  for(const m of clean.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)){stats.links++;if(!existsLocal(file,m[1]))failures.push(`${path.relative(root,file)} missing ${m[1]}`)}
  for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=m[1]||'',code=m[2]||'',src=scriptSrc(attrs);
    if(src){stats.links++;if(!existsLocal(file,src))failures.push(`${path.relative(root,file)} missing script ${src}`);continue}
    const type=scriptType(attrs);if(!isClassicJs(type)||!code.trim())continue;
    stats.scripts++;try{new vm.Script(code)}catch(e){failures.push(`${path.relative(root,file)} JS: ${e.message}`)}
  }
}

const required=['index.html','services.html','get-started.html','404.html','robots.txt','sitemap.xml','config.js','admin/index.html','admin/login.html','admin/service-catalog.html','admin/audit.html','admin/leads.html','admin/automations.html','admin/analytics.html','admin/marketing.html','admin/security.html','portal/index.html','portal/onboarding.html','portal/preferences.html','portal/qr.html','portal/schedule.html','assets/vms-catalog.js','assets/vms-core.js','assets/config.js'];
for(const item of required)if(!fs.existsSync(path.join(root,item)))failures.push(`dist missing ${item}`);

const protectedAdmin=['index.html','audit.html','qr.html','clients.html','service-catalog.html','billing.html','promotions.html','projects.html','files.html','activity.html','linkhub.html','leads.html','automations.html','analytics.html','marketing.html','security.html'];
for(const name of protectedAdmin){const file=path.join(root,'admin',name);if(!fs.existsSync(file))continue;stats.protectedAdmin++;const s=fs.readFileSync(file,'utf8');if(!s.includes('vms-auth-pending'))failures.push(`admin/${name}: privacy gate missing in dist`);if(!s.includes('vms-phase10-admin-nav'))failures.push(`admin/${name}: Phase 10 Admin navigation hardening missing`)}
const protectedPortal=['index.html','onboarding.html','preferences.html','qr.html','schedule.html'];
for(const name of protectedPortal){const file=path.join(root,'portal',name);if(!fs.existsSync(file))continue;stats.protectedPortal++;const s=fs.readFileSync(file,'utf8');if(!s.includes('vms-auth-pending'))failures.push(`portal/${name}: privacy gate missing in dist`)}

const home=fs.existsSync(path.join(root,'index.html'))?fs.readFileSync(path.join(root,'index.html'),'utf8'):'';
if(!home.includes('href="services.html"'))failures.push('published homepage is not linked to services.html');
if(!home.includes("btn.href='get-started.html?service='+encodeURIComponent(s.id)"))failures.push('published homepage selected-service Get Started hook missing');

for(const forbidden of ['README.md','package.json','supabase','scripts','types','qa'])if(fs.existsSync(path.join(root,forbidden)))failures.push(`private/source artifact leaked into dist: ${forbidden}`);
const report={ok:!failures.length,checkedAt:new Date().toISOString(),stats,failures};fs.mkdirSync(path.join(project,'qa'),{recursive:true});fs.writeFileSync(path.join(project,'qa','dist-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
