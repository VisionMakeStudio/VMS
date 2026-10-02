/* canonical menu labels: Home, VMS Audit, QR Tools, Clients, Service Catalog, Billing / Subscriptions, Promotions, Projects & Requests, Files & Assets, Notifications & Activity, VMS LinkHub, Analytics, CRM / Leads, Sales Content, Automations, Security & Access */
/* Vision Make Studio — Phase 2 canonical Admin shell
   One shared sidebar, one shared mobile drawer, one shared topbar. */
(()=>{
  'use strict';
  if(window.__VMS_ADMIN_SHELL_PHASE2__)return;
  window.__VMS_ADMIN_SHELL_PHASE2__=true;

  const path=(location.pathname||'/').toLowerCase();
  if(!/(^|\/)admin\//.test(path)||/\/admin\/login(?:\.html)?\/?$/.test(path))return;

  const NAV=[
    // [href, label, iconId, group]
    ['/admin/','Home','home','Workspace'],
    ['/admin/leads.html','Leads','people','Workspace'],
    ['/admin/clients.html','Clients','star','Workspace'],
    ['/admin/audit.html','Audits','check','Workspace'],
    ['/admin/qr.html','QR and LinkHub','qr','Products'],
    ['/admin/service-catalog.html','Service Catalog','file','Products'],
    ['/admin/promotions.html','Promotions','spark','Products'],
    ['/admin/billing.html','Billing','card','Money and system'],
    ['/admin/automations.html','Automations','bolt','Money and system'],
    ['/admin/security.html','Security','lock','Money and system'],
    ['/admin/analytics.html','Analytics','chart','Money and system'],
    ['/admin/activity.html','Activity','bell','Money and system'],
    ['/admin/projects.html','Projects','cal','Money and system'],
    ['/admin/files.html','Files','file','Money and system'],
    ['/admin/marketing.html','Sales Content','spark','Money and system'],
    ['/admin/linkhub.html','LinkHub Manager','link','Money and system'],
  ];
  const NAV_GROUPS=['Workspace','Products','Money and system'];
  const ICONS={home:'<path d="M3 12L12 4l9 8M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>',people:'<circle cx="9" cy="7" r="3.5"/><path d="M1 21c0-4 3.6-7 8-7s8 3 8 7"/><path d="M16 3.5a3.5 3.5 0 110 7M22 21c0-3.5-2.6-6.4-6-7"/>',star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',check:'<path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4 12 14.01l-3-3"/>',qr:'<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="4" height="4" rx=".8"/><path d="M21 18v3M18 21h3"/>',file:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',spark:'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',card:'<rect x="1" y="4" width="22" height="16" rx="2.5"/><line x1="1" y1="10" x2="23" y2="10"/>',bolt:'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',lock:'<rect x="3" y="11" width="18" height="11" rx="2.5"/><path d="M7 11V7a5 5 0 0110 0v4"/>',chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',bell:'<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>',cal:'<rect x="3" y="4" width="18" height="18" rx="2.5"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',link:'<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',sun:'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',moon:'<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'};
  const ico=id=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" fill="none" d="'+ICONS[id]+'"/></svg>';

  const normalize=value=>{
    const s=String(value||'').split('?')[0].split('#')[0];
    let leaf=(s.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
    if(leaf==='admin')leaf='index.html';
    else if(!leaf.includes('.'))leaf+='.html';
    return leaf;
  };
  const current=normalize(location.pathname);
  const title=(NAV.find(([href])=>normalize(href)===current)||[null,'VMS Admin'])[1];
  const route=current.replace(/\.html$/,'')||'index';

  function ensureStylesheet(){
    const canonicalPath='/assets/vms-admin-shell.css';
    const existing=Array.from(document.querySelectorAll('link[rel~="stylesheet"][href*="vms-admin-shell.css"]'))
      .find(link=>{
        try{return new URL(link.getAttribute('href')||'',location.href).pathname===canonicalPath;}
        catch{return false;}
      });
    if(existing){
      existing.id=existing.id||'vmsCanonicalAdminShellCss';
      return;
    }
    const link=document.createElement('link');
    link.id='vmsCanonicalAdminShellCss';
    link.rel='stylesheet';
    link.href=canonicalPath+'?v=20260824-admin-shell-recovery2';
    link.dataset.vmsAdminShellCss='1';
    document.head.appendChild(link);
  }

  function looksLikeAdminNav(aside){
    const text=(aside?.textContent||'').toLowerCase();
    let score=0;
    for(const label of ['home','vms audit','qr tools','clients','service catalog','billing','promotions']){
      if(text.includes(label))score++;
    }
    return score>=3;
  }

  function oldTopbars(){
    const selectors=[
      'body > .app > .main > header.topbar','body > .shell > .main > header.topbar','body > .main > header.topbar','body > header.topbar',
      'body > .app > .main > .topbar','body > .shell > .main > .topbar','body > .main > .topbar',
      'body > .app > .main > header.header','body > .shell > .main > header.header','body > .main > header.header','body > header.header'
    ];
    return Array.from(document.querySelectorAll(selectors.join(',')));
  }

  function findActionNode(topbars){
    for(const oldTop of topbars){
      const preferred=oldTop.querySelector('.top-actions,.topbar-actions,.actions,.header-actions');
      if(preferred)return preferred;
      const kids=Array.from(oldTop.children||[]);
      if(kids.length>1){
        const candidate=kids[kids.length-1];
        if(candidate.querySelector?.('button,a')||/actions/i.test(candidate.className||''))return candidate;
      }
    }
    return null;
  }

  function retireLegacyChrome(){
    document.querySelectorAll('aside').forEach(aside=>{
      if(aside.id==='vmsCanonicalAdminSidebar')return;
      if(looksLikeAdminNav(aside))aside.classList.add('vms-retired-admin-shell');
    });
    oldTopbars().forEach(el=>el.classList.add('vms-retired-admin-shell'));
    document.querySelectorAll('.mobile-head,.mobile-drawer,.mobile-admin-menu,.mobile-sidebar').forEach(el=>{
      if(looksLikeAdminNav(el))el.classList.add('vms-retired-admin-shell');
    });
    document.querySelectorAll('body > .drawer-backdrop,body > .app > .drawer-backdrop,body > .shell > .drawer-backdrop,#drawerBackdrop').forEach(el=>{
      if(el.id!=='vmsCanonicalAdminBackdrop')el.classList.add('vms-retired-admin-shell');
    });
  }

  function install(){
    try{const t=localStorage.getItem('vms-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}
  ensureStylesheet();
    if(document.getElementById('vmsCanonicalAdminSidebar'))return;

    const tops=oldTopbars();
    const actionNode=findActionNode(tops);
    document.body.classList.add('vms-admin-canonical');
    document.body.dataset.vmsAdminRoute=route;
    retireLegacyChrome();

    const aside=document.createElement('aside');
    aside.id='vmsCanonicalAdminSidebar';
    aside.setAttribute('aria-label','VMS Admin tools');
    aside.innerHTML=`
      <div class="vms-admin-brand">
        <img src="/assets/vms-logo-navy.png" alt="Vision Make Studio" onerror="this.src='/assets/vms-logo.png'">
        <div class="vms-admin-brand-copy"><strong>Vision Make Studio</strong><span>ADMIN</span></div>
      </div>
      <nav class="vms-admin-nav" aria-label="Admin navigation">
        ${NAV_GROUPS.map(g=>{
          const links=NAV.filter(n=>n[3]===g);
          return '<div class="vms-admin-nav-label">'+g+'</div>'+
            links.map(([href,label,iconId])=>'<a href="'+href+'"'+(normalize(href)===current?' class="active" aria-current="page"':'')+
              '><span class="vms-nav-icon">'+ico(iconId)+'</span><span class="vms-nav-label">'+label+'</span></a>').join('');
        }).join('')}
      </nav>
      <div class="vms-admin-foot">
        <div class="vms-admin-external"><a href="/portal/">Client Portal</a><a href="/">Website</a></div>
        <small>VMS Admin · Private workspace</small>
      </div>`;
  const top=document.createElement('header');
    top.id='vmsCanonicalAdminTopbar';
    top.innerHTML=`
      <div class="vms-admin-top-left">
        <button class="vms-admin-menu-btn" type="button" aria-label="Open Admin menu" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
        </button>
        <div class="vms-admin-page-title"><small>VMS ADMIN</small><strong role="heading" aria-level="1">${title}</strong></div>
      </div>
      <div class="vms-admin-top-actions"></div>`;
  const actionHost=top.querySelector('.vms-admin-top-actions');
    if(actionNode){
      actionNode.classList.remove('vms-retired-admin-shell');
      actionHost.appendChild(actionNode);
    }

    const shade=document.createElement('div');
    shade.id='vmsCanonicalAdminBackdrop';
    shade.setAttribute('aria-hidden','true');

    document.body.prepend(shade);
    document.body.prepend(top);
    document.body.prepend(aside);

    const btn=top.querySelector('.vms-admin-menu-btn');
    const close=()=>{
      aside.classList.remove('open');
      shade.classList.remove('show');
      btn.setAttribute('aria-expanded','false');
      shade.setAttribute('aria-hidden','true');
      document.body.classList.remove('vms-admin-drawer-open');
    };
    const open=()=>{
      aside.classList.add('open');
      shade.classList.add('show');
      btn.setAttribute('aria-expanded','true');
      shade.setAttribute('aria-hidden','false');
      document.body.classList.add('vms-admin-drawer-open');
    };

    // theme toggle
    const themeBtn=document.createElement('button');themeBtn.className='vms-admin-theme-btn';themeBtn.type='button';
    const effD=()=>{const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches};
    const paintT=()=>{themeBtn.innerHTML=effD()?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><use href="#sun"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';themeBtn.setAttribute('aria-label',effD()?'Switch to light mode':'Switch to dark mode')};
    themeBtn.addEventListener('click',()=>{const n=effD()?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('vms-theme',n)}catch(e){}paintT()});
    const topActs=top.querySelector('.vms-admin-top-actions');if(topActs)topActs.appendChild(themeBtn);paintT();
    btn.addEventListener('click',()=>aside.classList.contains('open')?close():open());
    shade.addEventListener('click',close);
    aside.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

    // Old pages occasionally recreate their own chrome after render. Retire it without rebuilding the canonical shell.
    let timer;
    const observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(retireLegacyChrome,80);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  ensureStylesheet();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();

/* VMS readability floor
   - No visible text smaller than 11px.
   - Faint grey text that fails the standard 4.5:1 contrast check is darkened
     (or lightened on dark backgrounds) just enough to pass.
   Fixes are applied with data attributes + CSS variables, so hover/active
   styles written by each page still win. */
(function(){
  if(window.__vmsReadability)return;window.__vmsReadability=true;
  const MIN=11, SKIP='script,style,noscript,svg,canvas,textarea,[data-vms-keep]';
  const done=new WeakSet();
  const parse=c=>{const m=c&&c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};
  const lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
  const lum=c=>0.2126*lin(c.r)+0.7152*lin(c.g)+0.0722*lin(c.b);
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
  const mix=(a,b,t)=>({r:a.r+(b.r-a.r)*t,g:a.g+(b.g-a.g)*t,b:a.b+(b.b-a.b)*t});
  const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
  function backdrop(el){
    const stack=[];let n=el,img=false;
    while(n&&n.nodeType===1){
      const cs=getComputedStyle(n);
      if(cs.backgroundImage&&cs.backgroundImage!=='none')img=true;
      const c=parse(cs.backgroundColor);
      if(c&&c.a>0){stack.push(c);if(c.a>=1)break}
      n=n.parentElement;
    }
    if(img)return null;
    let base={r:255,g:255,b:255};
    for(let i=stack.length-1;i>=0;i--){const t=stack[i];base={r:t.r*t.a+base.r*(1-t.a),g:t.g*t.a+base.g*(1-t.a),b:t.b*t.a+base.b*(1-t.a)}}
    return base;
  }
  function check(el){
    if(done.has(el))return;
    if(el.closest(SKIP)){done.add(el);return}
    const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
    const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return;
    done.add(el);
    const fs=parseFloat(cs.fontSize);
    if(fs&&fs<MIN)el.setAttribute('data-vms-fs','1');
    const fg=parse(cs.color);if(!fg||fg.a<1)return;
    const bg=backdrop(el);if(!bg)return;
    const size=Math.max(fs||0,MIN),large=size>=18||(size>=14&&parseInt(cs.fontWeight,10)>=700);
    const need=large?3:4.5;
    if(ratio(fg,bg)>=need)return;
    const light=lum(bg)>0.4, target=light?{r:0,g:36,b:58}:{r:255,g:255,b:255};
    let out=fg;
    for(let t=0.08;t<=1.001;t+=0.06){out=mix(fg,target,t);if(ratio(out,bg)>=need+0.15)break}
    el.setAttribute('data-vms-cf','1');el.style.setProperty('--vms-cf',hex(out));
  }
  function scan(root){
    const w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT);
    const list=[];let n;
    while(n=w.nextNode()){if(n.nodeValue.trim().length>1&&n.parentElement)list.push(n.parentElement)}
    let i=0;
    (function chunk(){
      const end=Math.min(i+300,list.length);
      for(;i<end;i++)check(list[i]);
      if(i<list.length)setTimeout(chunk,0);
    })();
  }
  let timer=null;
  function later(){if(timer)return;timer=setTimeout(()=>{timer=null;scan()},250)}
  function start(){
    scan();
    new MutationObserver(later).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
    window.addEventListener('resize',()=>{clearTimeout(window.__vmsRz);window.__vmsRz=setTimeout(()=>{document.querySelectorAll('[data-vms-fs]').forEach(e=>e.removeAttribute('data-vms-fs'));const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentElement)done.delete(n.parentElement)}scan()},300)},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
