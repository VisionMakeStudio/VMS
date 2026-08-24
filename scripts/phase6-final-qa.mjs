import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];const warnings=[];const stats={js:0,mts:0,htmlInlineScripts:0,textFiles:0};
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]});
const rel=(f)=>path.relative(root,f).replaceAll('\\','/');
const files=walk(root).filter(f=>!f.includes(`${path.sep}dist${path.sep}`));

for(const f of files.filter(f=>/\.(?:js|mjs)$/i.test(f))){
  stats.js++;const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0)failures.push(`${rel(f)}: JavaScript syntax failed: ${(r.stderr||r.stdout||'').trim()}`);
}

let ts=null;
try{const require=createRequire(import.meta.url);ts=require('typescript')}catch{}
for(const f of files.filter(f=>/\.mts$/i.test(f))){
  stats.mts++;
  if(!ts)continue;
  const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:f});
  for(const d of (out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error))
    failures.push(`${rel(f)}: TypeScript parse failed: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
}
if(!ts)warnings.push('TypeScript package not available locally; .mts parsing is delegated to the Netlify build.');

for(const f of files.filter(f=>/\.html$/i.test(f))){
  const src=fs.readFileSync(f,'utf8');
  for(const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=m[1]||'',code=m[2]||'';
    if(/\bsrc\s*=/.test(attrs)||!code.trim()||/\btype\s*=\s*["'](?:module|application\/ld\+json)/i.test(attrs))continue;
    stats.htmlInlineScripts++;try{new vm.Script(code,{filename:rel(f)})}catch(e){failures.push(`${rel(f)}: inline JavaScript syntax failed: ${e.message}`)}
  }
  if(['services.html','get-started.html','audit-report.html'].includes(path.basename(f))){
    const marker=src.match(/\b(?:demo|sample|testing)\b/i);if(marker)failures.push(`${rel(f)}: non-production HTML marker: ${marker[0]}`);
    if(/(?:localhost|127\.0\.0\.1|link\.visionmakestudio\.com)/i.test(src))failures.push(`${rel(f)}: local/retired production URL found`);
  }
}

const textExt=/\.(?:html|js|mjs|mts|css|sql|txt|md|json)$/i;
for(const f of files.filter(f=>textExt.test(f))){
  stats.textFiles++;const src=fs.readFileSync(f,'utf8');
  if(/^(?:<{7}|={7}|>{7})/m.test(src))failures.push(`${rel(f)}: unresolved merge-conflict marker`);
  for(const re of [/sk_(?:live|test)_[A-Za-z0-9]{16,}/g,/whsec_[A-Za-z0-9]{16,}/g,/sb_secret_[A-Za-z0-9._-]{12,}/g])
    if(re.test(src))failures.push(`${rel(f)}: secret-like credential detected`);
}

/* Phase 4 source-shell checks. */
{
  const cssFile=path.join(root,'assets','vms-admin-shell.css');
  const jsFile=path.join(root,'assets','vms-admin-shell.js');
  if(fs.existsSync(cssFile)){
    const css=fs.readFileSync(cssFile,'utf8');
    if(/#vmsCanonicalAdminSidebar[^}]*overflow\s*:\s*auto/i.test(css))failures.push('assets/vms-admin-shell.css: outer Admin sidebar uses overflow:auto');
    if(!css.includes('scrollbar-width:none'))failures.push('assets/vms-admin-shell.css: hidden nav scrollbar rule missing');
  }
  if(fs.existsSync(jsFile)){
    const js=fs.readFileSync(jsFile,'utf8');
    for(const label of ['Home','VMS Audit','QR Tools','Clients','Service Catalog','Billing / Subscriptions','Promotions','Projects & Requests','Files & Assets','Notifications & Activity','VMS LinkHub','Analytics','CRM / Leads','Sales Content','Automations','Security & Access'])
      if(!js.includes(label))failures.push(`assets/vms-admin-shell.js: menu item missing ${label}`);
  }
  const createDist=path.join(root,'scripts','create-dist.mjs');
  if(fs.existsSync(createDist)&&/Verifying secure session/i.test(fs.readFileSync(createDist,'utf8')))failures.push('scripts/create-dist.mjs: visible Admin verification copy returned');
}

for(const required of [
  'assets/vms-core.js','assets/vms-final-polish.css','assets/vms-admin-phase2.js','assets/vms-admin-shell.css','assets/vms-admin-shell.js','assets/vms-portal-phase3.js',
  'assets/vms-linkhub-phase4.js','assets/vms-qr-phase4.js','assets/vms-audit-ai-live.js','assets/vms-portal-payments.js',
  'netlify/functions/member-magic-link.mts','netlify/functions/client-billing.mts','netlify/functions/billing-checkout.mts',
  'netlify/functions/stripe-webhook.mts','netlify/functions/public-linkhub.mts','netlify/functions/ai-audit.mts',
  'netlify/functions/audit-report-links.mts','netlify/functions/public-audit-report.mts',
  'audit-report.html','services.html','get-started.html','scripts/create-dist.mjs','scripts/validate-dist.mjs'
]) if(!fs.existsSync(path.join(root,required)))failures.push(`Required Phase 6 overlay file missing: ${required}`);

let fullBuildRan=false,fullBuildPassed=false;
const fullRepoInputs=['index.html','404.html','robots.txt','sitemap.xml','config.js','admin','portal'];
if(fullRepoInputs.every(x=>fs.existsSync(path.join(root,x)))){
  fullBuildRan=true;
  const build=spawnSync(process.execPath,[path.join(root,'scripts','create-dist.mjs')],{cwd:root,encoding:'utf8'});
  if(build.status!==0)failures.push(`create-dist failed: ${(build.stderr||build.stdout||'').trim()}`);
  else{
    const validate=spawnSync(process.execPath,[path.join(root,'scripts','validate-dist.mjs')],{cwd:root,encoding:'utf8'});
    if(validate.status!==0)failures.push(`validate-dist failed: ${(validate.stderr||validate.stdout||'').trim()}`);
    else fullBuildPassed=true;
  }
}else warnings.push('Checkpoint package is an overlay; full create-dist/validate-dist will run after these files are merged into the complete GitHub repository.');

const report={ok:failures.length===0,checkedAt:new Date().toISOString(),stats,fullBuildRan,fullBuildPassed,warnings,failures};
fs.writeFileSync(path.join(root,'PHASE6_SOURCE_QA.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
