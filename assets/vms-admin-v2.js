/* VMS Admin v2 shell — sidebar, top bar, phone tab bar + More sheet, theme, toast, sheet.
   Used by every rebuilt v2 Admin tool (<html data-vms-shell="v2">). Navigation, not data:
   each tool page owns its own content in <main id="v2Main">. */
(()=>{
'use strict';
const root=document.documentElement;
if(!['v2','portal-v2'].includes(root.dataset.vmsShell)||window.VMSv2)return;
const PORTAL=root.dataset.vmsShell==='portal-v2';
const IC={
home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7"/><path d="M18 14.6c1.9.7 3.2 2.5 3.6 5.4"/>',
star:'<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.8z"/>',
check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
audit:'<circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.8-5"/>',
qr:'<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.3"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.3"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.3"/><path d="M14 14h3v3h-3zM20.5 14v2.5M17 20.5h3.5M14 20.5h.01"/>',
link:'<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1"/>',
tag:'<path d="M3.5 12.6V4.5a1 1 0 011-1h8.1l8 8a1.5 1.5 0 010 2.1l-6.9 6.9a1.5 1.5 0 01-2.1 0z"/><circle cx="8" cy="8" r="1.4"/>',
bolt:'<path d="M13 2.5L4.5 13.5h6.5L10 21.5l8.5-11H12z"/>',
card:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
bell:'<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
folder:'<path d="M3 7.5a2 2 0 012-2h4.2l2 2.3H19a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
spark:'<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
file:'<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
chat:'<path d="M4 5.5h16v11H9l-5 4z"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
x:'<path d="M6 6l12 12M18 6L6 18"/>',
grip:'<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
map:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
filter:'<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
shield:'<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
device:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
eyeoff:'<path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 004.4-1.1"/>',
trash:'<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
dl:'<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
wifi:'<path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.7 16a5 5 0 016.6 0"/><circle cx="12" cy="19.5" r="1"/>',
menu:'<path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M16 3c-1.7 0-3 2.2-3 5.5S14.3 13 16 13v8"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
moon:'<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
burger:'<path d="M4 7h16M4 12h16M4 17h16"/>',
chev:'<path d="M6 9l6 6 6-6"/>',
arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
camera:'<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 011 1v9.5a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.6"/>',
house:'<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 9.8V20h13V9.8"/><path d="M9.5 20v-5.5h5V20"/>',
plan:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h8M11 3v13M11 16h3M17 12h4M14 12h.01"/>',
walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M8 12l2.5-4.5L14 9l2 3.5M12 15l-1-4"/>',
food:'<path d="M3 13h18a9 9 0 01-18 0z"/><path d="M12 4v4M8.5 5.5l1 2.5M15.5 5.5l-1 2.5"/>',
drag:'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v9A1.5 1.5 0 005 15.5h3.5"/>',
ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
send:'<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
ig:'<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8"/>',
fb:'<path d="M14 21v-7.5h3l.5-3.5H14V8c0-1 .4-1.7 1.8-1.7h1.8V3.2A22 22 0 0015 3c-2.7 0-4.4 1.6-4.4 4.6V10H7.5v3.5h3.1V21"/>',
tt:'<path d="M14 3v11.5a3.5 3.5 0 11-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.1A1.6 1.6 0 007.6 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 14H3a2 2 0 010-4h.1A1.6 1.6 0 004.6 7.6l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 3V3a2 2 0 014 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00.3 1.8"/>',
more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
inbox:'<path d="M3.5 13.5l2.5-8h12l2.5 8V19a1 1 0 01-1 1H4.5a1 1 0 01-1-1z"/><path d="M3.5 13.5H9l1 2h4l1-2h5.5"/>',
refresh:'<path d="M20 11a8 8 0 00-14.5-4.5L3 9M4 13a8 8 0 0014.5 4.5L21 15"/><path d="M3 4v5h5M21 20v-5h-5"/>'
};

Object.assign(IC,{out:'<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>',pause:'<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',play:'<path d="M7 5l12 7-12 7z"/>',archive:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9"/><path d="M10 13h4"/>',upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>',img:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',yt:'<rect x="2.8" y="6" width="18.4" height="12" rx="4"/><path d="M10 9.5l5 2.5-5 2.5z"/>',xx:'<path d="M4 4l16 16M20 4L4 20"/>',li:'<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 7.5v.01M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.4-2.6s2.1 1 2.1 2.6V16"/>',wa:'<path d="M20 11.7a8 8 0 01-11.8 7l-4 .9 1-3.9A8 8 0 1120 11.7z"/><path d="M9.5 9c.5 2.5 2.5 4.5 5 5"/>',up:'<path d="M12 19V5M6 11l6-6 6 6"/>',down:'<path d="M12 5v14M6 13l6 6 6-6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',report:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 17v-3M12 17v-6M15 17v-4"/>'});
const ic=(n,c)=>'<svg class="ico'+(c?' '+c:'')+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NAV=[['Workspace',[['home','Home','home','/admin/'],['leads','CRM / Leads','inbox','/admin/leads.html'],['clients','Clients','users','/admin/clients.html'],['audit','VMS Audit','audit','/admin/audit.html']]],
 ['Products',[['qr','QR Studio','qr','/admin/qr.html'],['linkhub','LinkHub Studio','link','/admin/linkhub.html'],['catalog','Service Catalog','tag','/admin/service-catalog.html'],['promos','Promotions','bolt','/admin/promotions.html']]],
 ['Money & System',[['billing','Billing','card','/admin/billing.html'],['auto','Automations','refresh','/admin/automations.html'],['security','Security & Access','lock','/admin/security.html'],['analytics','Analytics','chart','/admin/analytics.html'],['notif','Notifications','bell','/admin/activity.html'],['projects','Projects & Requests','cal','/admin/projects.html'],['files','Files & Assets','folder','/admin/files.html'],['sales','Sales Content','spark','/admin/marketing.html']]]];
const TABS=['home','leads','clients','qr'];
const ALL={};NAV.forEach(g=>g[1].forEach(n=>ALL[n[0]]=n));
const cur=root.dataset.vmsPage||'home',title=document.body.dataset.title||(ALL[cur]||[])[1]||'Admin';
const LOGO='<img class="logo-l" src="/assets/vms-logo-navy.png" alt="Vision Make Studio"><img class="logo-d" src="/assets/vms-logo-cream.png" alt="Vision Make Studio">';

function theme(){let t='dark';try{t=localStorage.getItem('vms-theme')||'dark'}catch(e){}return t==='light'?'light':'dark'}
function paintTheme(){const t=theme();root.dataset.theme=t;const b=document.getElementById('v2Theme');if(b){b.innerHTML=ic(t==='dark'?'sun':'moon');b.setAttribute('aria-label',t==='dark'?'Switch to light mode':'Switch to dark mode')}
  let m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}m.content=t==='dark'?'#00121C':'#F6F3EC'}
function setTheme(){const n=theme()==='dark'?'light':'dark';try{localStorage.setItem('vms-theme',n)}catch(e){}paintTheme()}

let tT;function toast(m,kind){const t=document.getElementById('v2Toast');if(!t)return;t.textContent=m;t.dataset.kind=kind||'';t.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),kind==='error'?4200:2600)}
function sheet(titleText,html,bind,opt){const d=document.getElementById('v2Sheet');d.classList.toggle('sm',!!(opt&&opt.size==='sm'));document.getElementById('v2ShT').textContent=titleText;const b=document.getElementById('v2ShB');b.innerHTML=html;bind&&bind(b,d);if(!d.open)d.showModal();return d}
function closeSheet(){const d=document.getElementById('v2Sheet');if(d&&d.open)d.close()}

async function session(){try{const sb=window.VMSAuth&&await VMSAuth.client();if(!sb)return null;const {data}=await sb.auth.getSession();return data&&data.session||null}catch(e){return null}}
async function api(path,opts){opts=opts||{};const s=await session();if(!s||!s.access_token)throw new Error(PORTAL?'Your session has expired. Please sign in again.':'Your Admin session has expired. Please sign in again.');
  const r=await fetch(path,{method:opts.method||'GET',headers:Object.assign({Authorization:'Bearer '+s.access_token},opts.body?{'Content-Type':'application/json'}:{}),body:opts.body?JSON.stringify(opts.body):undefined});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed ('+r.status+').');return d}
/* Cloud workspace state (vms-state.js): hydrate shared Admin tool data once, without a page reload. */
let stateP=null;function state(){if(PORTAL)return Promise.resolve({changed:false});if(stateP)return stateP;stateP=(async()=>{if(!window.VMSState||location.protocol==='file:')return {changed:false};try{const s=await session();if(!s||!s.user)return {changed:false};return await VMSState.start({scope:'admin',user:s.user,reload:false})}catch(e){return {changed:false}}})();return stateP}
function ready(){return new Promise(res=>{const tick=()=>{if(!root.classList.contains('vms-auth-pending')&&window.VMSAuth)return res();setTimeout(tick,60)};tick()})}

function more(){sheet('All tools','<div class="stack">'+NAV.map(g=>'<div><p class="v2-gl">'+g[0]+'</p><div class="list">'+g[1].map(n=>'<a class="li" href="'+n[3]+'"'+(n[0]===cur?' aria-current="page"':'')+'><span class="lic">'+ic(n[2])+'</span><span><b>'+n[1]+'</b></span>'+ic('arrow')+'</a>').join('')+'</div></div>').join('')+
  '<div class="row"><button type="button" class="btn gh sm" data-x="theme">'+ic('sun')+'Light / dark</button><span class="sp"></span><button type="button" class="btn ghost sm" data-x="out">'+ic('out')+'Sign out</button></div></div>',
  b=>b.onclick=e=>{const x=e.target.closest('[data-x]');if(!x)return;if(x.dataset.x==='theme')setTheme();if(x.dataset.x==='out')signOut()})}
function search(){sheet('Go to',`<input class="inp" id="v2Q" placeholder="Search tools" autocomplete="off"><div class="list" id="v2QL" style="margin-top:10px"></div>`,b=>{const q=b.querySelector('#v2Q'),l=b.querySelector('#v2QL');
  const draw=()=>{const v=q.value.trim().toLowerCase();l.innerHTML=Object.values(ALL).filter(n=>!v||n[1].toLowerCase().includes(v)).map(n=>'<a class="li" href="'+n[3]+'"><span class="lic">'+ic(n[2])+'</span><span><b>'+n[1]+'</b></span>'+ic('arrow')+'</a>').join('')||'<div class="empty">No tool matches.</div>'};
  q.oninput=draw;draw();setTimeout(()=>q.focus(),60)})}
async function signOut(){try{await window.VMSAuth?.signOut?.()}catch(e){}location.href=PORTAL?'/':'/admin/login.html'}


/* ── Client Portal chrome (<html data-vms-shell="portal-v2">): navy top bar, desktop nav, phone tab bar + More. ── */
const PNAV=[['home','Home','home'],['services','Services','star'],['qr','QR Codes','qr'],['linkhub','LinkHub','link'],['billing','Billing','card'],['schedule','Schedule','cal']];
const PMORE=[['billing','Billing','card'],['schedule','Schedule','cal'],['files','Files','folder'],['requests','Requests','inbox'],['audits','Audits','audit'],['notif','Notifications','bell']];
const PTABS=[['home','Home','home'],['services','Services','star'],['qr','QR','qr'],['linkhub','LinkHub','link']];
const PTITLE={home:'Home',services:'My services',qr:'QR Codes',linkhub:'LinkHub',billing:'Billing',schedule:'Schedule',files:'Files',requests:'Requests',audits:'Audits',notif:'Notifications'};
function moreBody(){return '<div class="list">'+PMORE.map(n=>'<a class="li" href="#'+n[0]+'"><span class="lic">'+ic(n[2])+'</span><span><b>'+n[1]+'</b></span>'+ic('arrow')+'</a>').join('')+'</div>'}
function closeMenu(){const m=document.getElementById('v2PMenu');if(m){m.hidden=true;const b=document.querySelector('.ptop [data-pmore]');b&&b.setAttribute('aria-expanded','false')}}
function portalMenu(btn){let m=document.getElementById('v2PMenu');if(!m){m=document.createElement('div');m.id='v2PMenu';m.className='pmenu';m.setAttribute('role','menu');m.hidden=true;document.getElementById('v2PTop').appendChild(m);
   m.addEventListener('click',e=>{if(e.target.closest('a'))return closeMenu();const x=e.target.closest('[data-x]');if(!x)return;if(x.dataset.x==='theme'){setTheme();closeMenu()}if(x.dataset.x==='out')signOut()})}
  if(!m.hidden)return closeMenu();
  m.innerHTML='<div class="pm-list">'+PMORE.filter(n=>!PNAV.some(x=>x[0]===n[0])).map(n=>'<a role="menuitem" href="#'+n[0]+'">'+ic(n[2])+'<span>'+n[1]+'</span></a>').join('')+'</div><div class="pm-foot"><button type="button" role="menuitem" data-x="theme">'+ic(theme()==='dark'?'sun':'moon')+'<span>'+(theme()==='dark'?'Light mode':'Dark mode')+'</span></button><button type="button" role="menuitem" data-x="out">'+ic('out')+'<span>Sign out</span></button></div>';
  const r=btn.getBoundingClientRect(),h=document.getElementById('v2PTop').getBoundingClientRect();m.style.left=Math.max(12,r.left-h.left-8)+'px';m.hidden=false;btn.setAttribute('aria-expanded','true');const f=m.querySelector('a,button');f&&f.focus({preventScroll:true})}
function portalMore(){sheet('More','<div class="list">'+PMORE.map(n=>'<a class="li" href="#'+n[0]+'"><span class="lic">'+ic(n[2])+'</span><span><b>'+n[1]+'</b></span>'+ic('arrow')+'</a>').join('')+'</div><div class="row" style="margin-top:14px"><button type="button" class="btn gh sm" data-x="theme">'+ic('sun')+'Light / dark</button><span class="sp"></span><button type="button" class="btn ghost sm" data-x="out">'+ic('out')+'Sign out</button></div>',
  b=>b.onclick=e=>{if(e.target.closest('a.li'))return closeSheet();const x=e.target.closest('[data-x]');if(!x)return;if(x.dataset.x==='theme')setTheme();if(x.dataset.x==='out')signOut()})}
function portalNav(v){const t=document.getElementById('v2PT');if(t)t.textContent=PTITLE[v]||'Portal';document.title=(PTITLE[v]||'Portal')+' · VMS Client Portal';
  document.querySelectorAll('[data-pv]').forEach(b=>{const k=b.dataset.pv,on=k===v||(k==='more'&&!PTABS.some(x=>x[0]===v)&&b.closest('.tabbar'))||(k==='more'&&!b.closest('.tabbar')&&!PNAV.some(x=>x[0]===v));on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')})}
function portalWho(name){const w=document.getElementById('v2Who'),a=document.getElementById('v2Av');if(w)w.textContent=name;if(a)a.textContent=String(name||'').replace(/[^A-Za-z0-9 ]+/g,' ').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'VM'}
function mountPortal(){
  if(document.getElementById('v2PTop'))return;
  document.body.insertAdjacentHTML('afterbegin','<svg width="0" height="0" style="position:absolute" aria-hidden="true">'+Object.entries(IC).map(([k,v])=>'<symbol id="i-'+k+'" viewBox="0 0 24 24">'+v+'</symbol>').join('')+'</svg>');
  const main=document.getElementById('v2Main');main.classList.add('view','pview');
  main.insertAdjacentHTML('beforebegin','<header class="ptop" id="v2PTop"><a class="plogo" href="#home"><img src="/assets/vms-logo-cream.png" alt="Vision Make Studio"></a><span class="ptitle" id="v2PT">Home</span><nav aria-label="Portal">'+PNAV.map(n=>'<a href="#'+n[0]+'" data-pv="'+n[0]+'">'+n[1]+'</a>').join('')+'<button type="button" data-pv="more" data-pmore>More</button></nav><button type="button" class="ib pib" id="v2Theme"></button><div class="who"><span class="av sm" id="v2Av">VM</span><span id="v2Who">Your business</span></div></header>');
  document.body.insertAdjacentHTML('beforeend','<nav class="tabbar portab" aria-label="Portal">'+PTABS.map(t=>'<a href="#'+t[0]+'" data-pv="'+t[0]+'">'+ic(t[2])+t[1]+'</a>').join('')+'<button type="button" data-pv="more" data-pmore>'+ic('more')+'More</button></nav>'+
    '<dialog class="sheet" id="v2Sheet" aria-labelledby="v2ShT"><div class="shc"><div class="grab"></div><div class="hd"><h3 id="v2ShT"></h3><button type="button" class="ib" data-close aria-label="Close">'+ic('x')+'</button></div><div id="v2ShB"></div></div></dialog><div class="toast" id="v2Toast" role="status" aria-live="polite"></div>');
  document.addEventListener('click',e=>{const t=e.target;const pm=t.closest('[data-pmore]');if(pm){if(pm.closest('.ptop')&&matchMedia('(min-width:1000px)').matches)return portalMenu(pm);return portalMore()}if(!t.closest('#v2PMenu'))closeMenu();if(t.closest('#v2Theme'))return setTheme();if(t.closest('[data-out]'))return signOut();if(t.closest('#v2Sheet [data-close]'))return closeSheet();
    const d=document.getElementById('v2Sheet');if(t===d)closeSheet()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.getElementById('v2PMenu');if(m&&!m.hidden){closeMenu();const b=document.querySelector('.ptop [data-pmore]');b&&b.focus()}}});addEventListener('hashchange',closeMenu);addEventListener('resize',closeMenu);
  paintTheme();
}

function mount(){
  if(PORTAL)return mountPortal();
  if(document.getElementById('v2Side'))return;
  document.body.insertAdjacentHTML('afterbegin','<svg width="0" height="0" style="position:absolute" aria-hidden="true">'+Object.entries(IC).map(([k,v])=>'<symbol id="i-'+k+'" viewBox="0 0 24 24">'+v+'</symbol>').join('')+'</svg>');
  const main=document.getElementById('v2Main');
  const wrap=document.createElement('div');wrap.className='adm';
  wrap.innerHTML='<aside class="side" id="v2Side" aria-label="Admin navigation"><a class="brand" href="/admin/">'+LOGO+'</a>'+NAV.map(g=>'<h4>'+g[0]+'</h4>'+g[1].map(n=>'<a class="nv" href="'+n[3]+'"'+(n[0]===cur?' aria-current="page"':'')+'>'+ic(n[2])+'<span>'+n[1]+'</span></a>').join('')).join('')+
    '<div class="me" style="margin-top:18px"><span class="av sm" id="v2Av">VMS</span><div style="min-width:0"><b id="v2Who">Vision Make Studio</b><span>Admin</span></div><button type="button" class="ib" style="margin-left:auto;width:38px;height:38px" data-out aria-label="Sign out">'+ic('out')+'</button></div></aside>'+
    '<div class="admc"><header class="atop"><button type="button" class="ib mmenu" data-more aria-label="Open menu">'+ic('burger')+'</button><h2>'+esc(title)+'</h2><span id="v2Act" class="v2act"></span><button type="button" class="ib" data-search aria-label="Search tools">'+ic('search')+'</button><button type="button" class="ib" id="v2Theme"></button></header></div>';
  main.parentNode.insertBefore(wrap,main);wrap.querySelector('.admc').appendChild(main);main.classList.add('view');
  document.body.insertAdjacentHTML('beforeend','<nav class="tabbar admtab" aria-label="Admin">'+TABS.map(k=>{const n=ALL[k];return '<a href="'+n[3]+'"'+(k===cur?' aria-current="page"':'')+'>'+ic(n[2])+(k==='leads'?'Leads':n[1].replace(' Studio','').replace('CRM / ',''))+'</a>'}).join('')+'<button type="button" data-more'+(TABS.includes(cur)?'':' aria-current="page"')+'>'+ic('more')+'More</button></nav>'+
    '<dialog class="sheet" id="v2Sheet" aria-labelledby="v2ShT"><div class="shc"><div class="grab"></div><div class="hd"><h3 id="v2ShT"></h3><button type="button" class="ib" data-close aria-label="Close">'+ic('x')+'</button></div><div id="v2ShB"></div></div></dialog><div class="toast" id="v2Toast" role="status" aria-live="polite"></div>');
  document.addEventListener('click',e=>{const t=e.target;if(t.closest('[data-more]'))return more();if(t.closest('[data-search]'))return search();if(t.closest('#v2Theme'))return setTheme();if(t.closest('[data-out]'))return signOut();if(t.closest('#v2Sheet [data-close]'))return closeSheet();
    const d=document.getElementById('v2Sheet');if(t===d)closeSheet()});
  paintTheme();
  ready().then(session).then(s=>{const e=s&&s.user&&s.user.email;if(!e)return;document.getElementById('v2Who').textContent=e;document.getElementById('v2Av').textContent=e.slice(0,2).toUpperCase()});
}
paintTheme();
const money=(n,dec)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:dec===0?0:2,maximumFractionDigits:dec===0?0:2}).format(Number(n)||0);
const num=n=>new Intl.NumberFormat('en-US').format(Number(n)||0);
const ago=v=>{const d=new Date(v);if(!v||isNaN(d))return'';const m=Math.round((Date.now()-d)/6e4);if(m<1)return'Just now';if(m<60)return m+' min ago';const h=Math.round(m/60);if(h<24)return h+(h===1?' hour ago':' hours ago');const dd=Math.round(h/24);if(dd===1)return'Yesterday';if(dd<7)return dd+' days ago';return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})};
const date=(v,time)=>{const d=new Date(v);if(!v||isNaN(d))return'—';return d.toLocaleString('en-US',time?{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',year:'numeric'})};
function spark(a){a=(a||[]).map(Number);if(a.length<2||a.every(v=>v===a[0]))return'';const mx=Math.max(...a),mn=Math.min(...a),w=100,h=28;const d=a.map((p,i)=>`${i?'L':'M'}${(i/(a.length-1)*w).toFixed(1)} ${(h-2-(p-mn)/((mx-mn)||1)*(h-4)).toFixed(1)}`).join(' ');return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`}
function kpi(l,v,d,dl,pts,href){const tag=href?'a':'div';return `<${tag} class="kpi"${href?` href="${esc(href)}" style="text-decoration:none;color:inherit"`:''}><span class="l">${esc(l)}</span><span class="v">${v}</span>${spark(pts)}<span class="d"><b>${d||''}</b><span>${dl||''}</span></span></${tag}>`}
function actions(html){const a=document.getElementById('v2Act');if(a)a.innerHTML=html||'';else document.addEventListener('DOMContentLoaded',()=>actions(html),{once:true})}
function confirmSheet(title,body,yes,danger){return new Promise(res=>{sheet(title,`<p class="muted">${body}</p><div class="row" style="margin-top:16px"><button class="btn ${danger?'acc':'pri'}" type="button" data-cy>${esc(yes||'Confirm')}</button><button class="btn gh" type="button" data-cn>Cancel</button></div>`,b=>b.onclick=e=>{if(e.target.closest('[data-cy]')){closeSheet();res(true)}if(e.target.closest('[data-cn]')){closeSheet();res(false)}},{size:'sm'});const d=document.getElementById('v2Sheet');d.addEventListener('close',()=>res(false),{once:true})})}
function sel(id,opts,val){return opts.map(o=>{const v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return `<option value="${esc(v)}"${String(v)===String(val)?' selected':''}>${esc(l)}</option>`}).join('')}
window.VMSv2={ic,esc,toast,sheet,closeSheet,api,ready,session,state,portalNav,portalWho,signOut,setTheme,money,num,ago,date,spark,kpi,actions,confirmSheet,sel};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
