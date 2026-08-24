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
  const marker=source.match(/\b(?:demo|sample|testing)\b/i);if(marker)failures.push(`${path.relative(root,file)} contains non-production marker: ${marker[0]}`);
  for(const m of clean.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)){stats.links++;if(!existsLocal(file,m[1]))failures.push(`${path.relative(root,file)} missing ${m[1]}`)}
  for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=m[1]||'',code=m[2]||'',src=scriptSrc(attrs);
    if(src){stats.links++;if(!existsLocal(file,src))failures.push(`${path.relative(root,file)} missing script ${src}`);continue}
    const type=scriptType(attrs);if(!isClassicJs(type)||!code.trim())continue;
    stats.scripts++;try{new vm.Script(code)}catch(e){failures.push(`${path.relative(root,file)} JS: ${e.message}`)}
  }
}

const required=['index.html','services.html','get-started.html','audit-report.html','404.html','robots.txt','sitemap.xml','config.js','admin/index.html','admin/login.html','admin/service-catalog.html','admin/audit.html','admin/leads.html','admin/automations.html','admin/analytics.html','admin/marketing.html','admin/security.html','portal/index.html','portal/onboarding.html','portal/preferences.html','portal/qr.html','portal/schedule.html','assets/vms-catalog.js','assets/vms-core.js','assets/vms-auth-guard.js','assets/vms-admin-shell.css','assets/vms-admin-shell.js','assets/vms-portal-shell.css','assets/vms-portal-shell.js','assets/config.js'];
for(const item of required)if(!fs.existsSync(path.join(root,item)))failures.push(`dist missing ${item}`);

const protectedAdmin=['index.html','audit.html','qr.html','clients.html','service-catalog.html','billing.html','promotions.html','projects.html','files.html','activity.html','linkhub.html','leads.html','automations.html','analytics.html','marketing.html','security.html'];
for(const name of protectedAdmin){
  const file=path.join(root,'admin',name);if(!fs.existsSync(file))continue;stats.protectedAdmin++;const s=fs.readFileSync(file,'utf8');
  if(!s.includes('vms-auth-pending'))failures.push(`admin/${name}: privacy gate missing in dist`);
  const hasShellCss=/<link\b(?=[^>]*\brel=["'][^"']*stylesheet[^"']*["'])(?=[^>]*\bhref=["']\/assets\/vms-admin-shell\.css(?:\?[^"']*)?["'])[^>]*>/i.test(s);
  const hasShellJs=/<script\b(?=[^>]*\bsrc=["']\/assets\/vms-admin-shell\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/i.test(s);
  const hasConfig=/<script\b(?=[^>]*\bsrc=["']\/config\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/i.test(s);
  const coreTags=s.match(/<script\b(?=[^>]*\bsrc=["']\/assets\/vms-core\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi)||[];
  const guardTags=s.match(/<script\b(?=[^>]*\bsrc=["']\/assets\/vms-auth-guard\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi)||[];
  const legacyAuth=/<script\b(?![^>]*\bsrc=)[^>]*>\s*(?:if\s*\(\s*window\.VMSAuth\s*\)\s*)?(?:window\.)?VMSAuth(?:\?\.|\.)requireSession\([\s\S]*?\)\s*;?\s*<\/script>/i.test(s);
  if(!hasShellCss)failures.push(`admin/${name}: canonical root Admin shell CSS link missing`);if(!hasShellJs)failures.push(`admin/${name}: canonical root Admin shell JS script missing`);if(!hasConfig)failures.push(`admin/${name}: protected config bootstrap missing`);
  if(coreTags.length!==1)failures.push(`admin/${name}: expected exactly one canonical VMS auth core, found ${coreTags.length}`);
  if(guardTags.length!==1)failures.push(`admin/${name}: expected exactly one centralized auth guard, found ${guardTags.length}`);
  if(legacyAuth)failures.push(`admin/${name}: legacy page-level requireSession bridge leaked into dist`);
  if(s.includes('vms-phase10-admin-nav'))failures.push(`admin/${name}: retired Phase 10 per-page navigation injector leaked into dist`);if(/Verifying secure session/i.test(s))failures.push(`admin/${name}: visible verification message leaked into dist`)
}

/* Phase 4 canonical-shell assertions. */
const shellCssFile=path.join(root,'assets','vms-admin-shell.css');
if(fs.existsSync(shellCssFile)){
  const css=fs.readFileSync(shellCssFile,'utf8');
  if(!css.includes('#vmsCanonicalAdminSidebar'))failures.push('assets/vms-admin-shell.css: canonical sidebar rules missing');
  if(!css.includes('scrollbar-width:none'))failures.push('assets/vms-admin-shell.css: hidden sidebar scrollbar rule missing');
  if(/#vmsCanonicalAdminSidebar[^}]*overflow\s*:\s*auto/i.test(css))failures.push('assets/vms-admin-shell.css: outer Admin sidebar must not use overflow:auto');
}
const shellJsFile=path.join(root,'assets','vms-admin-shell.js');
if(fs.existsSync(shellJsFile)){
  const js=fs.readFileSync(shellJsFile,'utf8');
  for(const label of ['Home','VMS Audit','QR Tools','Clients','Service Catalog','Billing / Subscriptions','Promotions','Projects & Requests','Files & Assets','Notifications & Activity','VMS LinkHub','Analytics','CRM / Leads','Sales Content','Automations','Security & Access'])
    if(!js.includes(label))failures.push(`assets/vms-admin-shell.js: canonical menu item missing ${label}`);
}

const protectedPortal=['index.html','onboarding.html','preferences.html','qr.html','schedule.html'];
for(const name of protectedPortal){
  const file=path.join(root,'portal',name);if(!fs.existsSync(file))continue;stats.protectedPortal++;const s=fs.readFileSync(file,'utf8');
  if(!s.includes('vms-auth-pending'))failures.push(`portal/${name}: privacy gate missing in dist`);
  const hasShellCss=/<link\b(?=[^>]*\brel=["'][^"']*stylesheet[^"']*["'])(?=[^>]*\bhref=["']\/assets\/vms-portal-shell\.css(?:\?[^"']*)?["'])[^>]*>/i.test(s);
  const hasShellJs=/<script\b(?=[^>]*\bsrc=["']\/assets\/vms-portal-shell\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/i.test(s);
  const hasConfig=/<script\b(?=[^>]*\bsrc=["']\/config\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/i.test(s);
  const coreTags=s.match(/<script\b(?=[^>]*\bsrc=["']\/assets\/vms-core\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi)||[];
  const guardTags=s.match(/<script\b(?=[^>]*\bsrc=["']\/assets\/vms-auth-guard\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi)||[];
  const legacyAuth=/<script\b(?![^>]*\bsrc=)[^>]*>\s*(?:if\s*\(\s*window\.VMSAuth\s*\)\s*)?(?:window\.)?VMSAuth(?:\?\.|\.)requireSession\([\s\S]*?\)\s*;?\s*<\/script>/i.test(s);
  if(!hasShellCss)failures.push(`portal/${name}: canonical root Portal shell CSS link missing`);
  if(!hasShellJs)failures.push(`portal/${name}: canonical root Portal shell JS script missing`);
  if(!hasConfig)failures.push(`portal/${name}: protected config bootstrap missing`);
  if(coreTags.length!==1)failures.push(`portal/${name}: expected exactly one canonical VMS auth core, found ${coreTags.length}`);
  if(guardTags.length!==1)failures.push(`portal/${name}: expected exactly one centralized auth guard, found ${guardTags.length}`);
  if(legacyAuth)failures.push(`portal/${name}: legacy page-level requireSession bridge leaked into dist`);
}

const portalShellCssFile=path.join(root,'assets','vms-portal-shell.css');
if(fs.existsSync(portalShellCssFile)){
  const css=fs.readFileSync(portalShellCssFile,'utf8');
  if(!css.includes('#vmsCanonicalPortalSidebar'))failures.push('assets/vms-portal-shell.css: canonical Portal sidebar rules missing');
  if(!css.includes('scrollbar-width:none'))failures.push('assets/vms-portal-shell.css: hidden Portal scrollbar rule missing');
  if(/#vmsCanonicalPortalSidebar[^}]*overflow\s*:\s*auto/i.test(css))failures.push('assets/vms-portal-shell.css: outer Portal sidebar must not use overflow:auto');
}
const portalShellJsFile=path.join(root,'assets','vms-portal-shell.js');
if(fs.existsSync(portalShellJsFile)){
  const js=fs.readFileSync(portalShellJsFile,'utf8');
  if(!js.includes('/assets/vms-portal-shell.css'))failures.push('assets/vms-portal-shell.js: root Portal stylesheet rescue missing');
  for(const label of ['Home','My Services','QR Codes','My LinkHub','Audits','Projects','Files','Notifications','Requests','Billing','Contact / Schedule'])
    if(!js.includes(label))failures.push(`assets/vms-portal-shell.js: canonical menu item missing ${label}`);
}
const coreFile=path.join(root,'assets','vms-core.js');
if(fs.existsSync(coreFile)){
  const js=fs.readFileSync(coreFile,'utf8');
  if(!js.includes('getSessionWithNavigationGrace'))failures.push('assets/vms-core.js: internal Admin navigation session grace missing');
  if(!js.includes('currentAdminFastNav'))failures.push('assets/vms-core.js: fast-navigation destination verification missing');
}

const authGuardFile=path.join(root,'assets','vms-auth-guard.js');
if(fs.existsSync(authGuardFile)){
  const js=fs.readFileSync(authGuardFile,'utf8');
  if(!js.includes("requireSession(kind)"))failures.push('assets/vms-auth-guard.js: centralized requireSession call missing');
  if(!js.includes('repairPortalAuthUrl'))failures.push('assets/vms-auth-guard.js: Portal magic-link recovery missing');
  if(!js.includes('vmsAuthChecking'))failures.push('assets/vms-auth-guard.js: duplicate-auth protection missing');
}

const home=fs.existsSync(path.join(root,'index.html'))?fs.readFileSync(path.join(root,'index.html'),'utf8'):'';
if(!home.includes('href="services.html"'))failures.push('published homepage is not linked to services.html');
if(!home.includes("btn.href='get-started.html?service='+encodeURIComponent(s.id)"))failures.push('published homepage selected-service Get Started hook missing');

for(const forbidden of ['README.md','package.json','supabase','scripts','types','qa'])if(fs.existsSync(path.join(root,forbidden)))failures.push(`private/source artifact leaked into dist: ${forbidden}`);

/* Phase 12E launch assertions: published Admin config must never bypass
   the privacy gate before VMSAuth finishes the real session/role/MFA check. */
for(const relative of ['config.js','assets/config.js']){
  const file=path.join(root,relative);
  if(!fs.existsSync(file))continue;
  const code=fs.readFileSync(file,'utf8');
  if(code.includes('vms_admin_visual_trust_until'))failures.push(`${relative}: Admin trusted-tab early-unhide shortcut leaked into production`);
}
const publishedState=path.join(root,'assets','vms-state.js');
if(fs.existsSync(publishedState)&&fs.readFileSync(publishedState,'utf8').includes('vms_service_catalog_demo_v1'))failures.push('assets/vms-state.js: retired demo catalog state key leaked into production');



/* Final Polish Phase 6 integration assertions. */
function readRequired(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Phase 6 missing ${relative}`);return ''}return fs.readFileSync(file,'utf8')}
const phase6Portal=readRequired('portal/index.html');
for(const marker of ['vms-phase11-portal-payments','vms-portal-phase3','vms-portal-linkhub-phase4','vms-portal-qr-phase4'])
  if(phase6Portal&&!phase6Portal.includes(marker))failures.push(`portal/index.html: Phase 6 marker missing ${marker}`);
const phase6Audit=readRequired('admin/audit.html');
for(const marker of ['vms-admin-phase2','vms-audit-ai-live','vms-phase11-audit-cleanup'])
  if(phase6Audit&&!phase6Audit.includes(marker))failures.push(`admin/audit.html: Phase 6 marker missing ${marker}`);
if(phase6Audit&&!phase6Audit.includes('/assets/vms-audit-desktop-fix.js?v=20260824-phase3-audit-layout'))failures.push('admin/audit.html: Phase 3 desktop layout repair is missing');
const phase3AuditFix=path.join(root,'assets','vms-audit-desktop-fix.js');
if(!fs.existsSync(phase3AuditFix))failures.push('assets/vms-audit-desktop-fix.js: Phase 3 Audit layout asset missing');
else{const js=fs.readFileSync(phase3AuditFix,'utf8');if(!js.includes('__VMS_AUDIT_DESKTOP_PHASE3__'))failures.push('assets/vms-audit-desktop-fix.js: Phase 3 Audit layout marker missing');}
const phase6Clients=readRequired('admin/clients.html');
if(phase6Clients&&!phase6Clients.includes('vms-phase11-clients-live'))failures.push('admin/clients.html: Clients live layer missing');
const phase6Billing=readRequired('admin/billing.html');
if(phase6Billing&&!phase6Billing.includes('vms-phase11-billing-live'))failures.push('admin/billing.html: Billing live layer missing');
const phase6Report=readRequired('audit-report.html');
if(phase6Report&&/vms-admin-sidebar|vms-admin-topbar|VMS ADMIN/i.test(phase6Report))failures.push('audit-report.html: Admin chrome leaked into client report');
if(phase6Report&&!phase6Report.includes('/api/public-audit-report'))failures.push('audit-report.html: public report resolver missing');
for(const relative of ['index.html','services.html','get-started.html','audit-report.html']){
  const file=path.join(root,relative);if(!fs.existsSync(file))continue;const html=fs.readFileSync(file,'utf8');
  if(html.includes('link.visionmakestudio.com'))failures.push(`${relative}: retired LinkHub host leaked into production`);
  if(/(?:localhost|127\.0\.0\.1)/i.test(html))failures.push(`${relative}: local-only URL leaked into production`);
}
for(const secretPattern of [/sk_(?:live|test)_[A-Za-z0-9]{16,}/g,/whsec_[A-Za-z0-9]{16,}/g,/sb_secret_[A-Za-z0-9._-]{12,}/g]){
  for(const file of walk(root).filter(f=>/\.(?:html|js|mjs|json|txt|css)$/i.test(f))){
    const hit=fs.readFileSync(file,'utf8').match(secretPattern);if(hit)failures.push(`${path.relative(root,file)}: secret-like credential leaked into dist`);
  }
}

const report={ok:!failures.length,checkedAt:new Date().toISOString(),stats,failures};fs.mkdirSync(path.join(project,'qa'),{recursive:true});fs.writeFileSync(path.join(project,'qa','dist-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
