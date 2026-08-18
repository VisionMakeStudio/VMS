import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(project,'dist');
const failures=[];let html=0,links=0,scripts=0;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]})}
function stripScriptsStyles(s){return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')}
function existsLocal(base,raw){let ref=String(raw||'').trim();if(!ref||ref.startsWith('#')||/^(https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(ref)||ref.includes('${'))return true;ref=ref.split('#')[0].split('?')[0];if(!ref)return true;const target=ref.startsWith('/')?path.join(root,ref):path.resolve(path.dirname(base),ref);if(!fs.existsSync(target))return false;return !fs.statSync(target).isDirectory()||fs.existsSync(path.join(target,'index.html'))}
if(!fs.existsSync(root))failures.push('dist/ was not generated');
else for(const file of walk(root).filter(f=>f.endsWith('.html'))){html++;const source=fs.readFileSync(file,'utf8'),clean=stripScriptsStyles(source);for(const m of clean.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)){links++;if(!existsLocal(file,m[1]))failures.push(`${path.relative(root,file)} missing ${m[1]}`)}for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){const attrs=m[1]||'',code=m[2]||'';if(/\bsrc\s*=/.test(attrs)||/type\s*=\s*["'](?:application\/json|importmap)["']/i.test(attrs)||!code.trim())continue;scripts++;try{new vm.Script(code)}catch(e){failures.push(`${path.relative(root,file)} JS: ${e.message}`)}}}
for(const required of ['index.html','admin/index.html','admin/login.html','admin/service-catalog.html','admin/audit.html','portal/index.html','assets/vms-catalog.js','assets/vms-core.js'])if(!fs.existsSync(path.join(root,required)))failures.push(`dist missing ${required}`);
for(const forbidden of ['README.md','VMS-Launch-Guide.html','VMS-Full-Preview.html','supabase/schema.sql','scripts/validate-build.mjs'])if(fs.existsSync(path.join(root,forbidden)))failures.push(`private setup artifact leaked into dist: ${forbidden}`);
const report={ok:!failures.length,checkedAt:new Date().toISOString(),stats:{html,links,scripts},failures};fs.writeFileSync(path.join(project,'qa','dist-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
