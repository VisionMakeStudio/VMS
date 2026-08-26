/* Vision Make Studio — Phase 2 canonical Admin shell
   One shared sidebar, one shared mobile drawer, one shared topbar. */
(()=>{
  'use strict';
  if(window.__VMS_ADMIN_SHELL_PHASE2__)return;
  window.__VMS_ADMIN_SHELL_PHASE2__=true;

  const path=(location.pathname||'/').toLowerCase();
  if(!/(^|\/)admin\//.test(path)||/\/admin\/login(?:\.html)?\/?$/.test(path))return;

  const NAV=[
    ['/admin/','Home','home'],
    ['/admin/audit.html','VMS Audit','audit'],
    ['/admin/qr.html','QR Tools','qr'],
    ['/admin/clients.html','Clients','users'],
    ['/admin/service-catalog.html','Service Catalog','catalog'],
    ['/admin/billing.html','Billing / Subscriptions','billing'],
    ['/admin/promotions.html','Promotions','tag'],
    ['/admin/projects.html','Projects & Requests','projects'],
    ['/admin/files.html','Files & Assets','files'],
    ['/admin/activity.html','Notifications & Activity','activity'],
    ['/admin/linkhub.html','VMS LinkHub','link'],
    ['/admin/analytics.html','Analytics','analytics'],
    ['/admin/leads.html','CRM / Leads','leads'],
    ['/admin/marketing.html','Sales Content','marketing'],
    ['/admin/automations.html','Automations','automation'],
    ['/admin/security.html','Security & Access','security']
  ];

  const ICON_PATHS={
    home:'<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-6h6v6"/>',
    audit:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/><path d="m8.5 11 1.7 1.7 3.6-4"/>',
    qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 14h2v2M19 19h2v2M14 19h2v2"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    catalog:'<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="5" rx="1.5"/><rect x="14" y="15" width="7" height="5" rx="1.5"/>',
    billing:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    tag:'<path d="M20.5 13.5 13.5 20.5a2 2 0 0 1-2.8 0L3.5 13.3V4h9.3l7.7 7.7a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.5"/>',
    projects:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v4H9zM8 12l2 2 4-4M8 18h8"/>',
    files:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/>',
    activity:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    analytics:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    leads:'<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
    marketing:'<path d="m3 11 14-5v12L3 13z"/><path d="M7 14v5a2 2 0 0 0 2 2h1M20 9a4 4 0 0 1 0 6"/>',
    automation:'<path d="M4 6h5l2 3h9M4 18h5l2-3h9"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="9" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="15" r="1.5"/>',
    security:'<path d="M12 3 20 6v5c0 5.2-3.3 8.2-8 10-4.7-1.8-8-4.8-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'
  };

  const iconSvg=(name,cls='')=>`<svg${cls?` class="${cls}"`:''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]||ICON_PATHS.home}</svg>`;

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
        <img src="/assets/vms-logo.png" alt="Vision Make Studio" onerror="this.style.display='none'">
        <div class="vms-admin-brand-copy"><strong>Vision Make Studio</strong><span>ADMIN</span></div>
      </div>
      <nav class="vms-admin-nav" aria-label="Admin navigation">
        ${NAV.map(([href,label,icon])=>`<a href="${href}"${normalize(href)===current?' class="active" aria-current="page"':''}><span class="vms-nav-icon" aria-hidden="true">${iconSvg(icon)}</span><span class="vms-nav-label">${label}</span></a>`).join('')}
      </nav>
      <div class="vms-admin-foot">
        <div class="vms-admin-external"><a href="/portal/">Client Portal</a><a href="/">Public Website</a></div>
        VMS Admin · Private workspace
      </div>`;

    const top=document.createElement('header');
    top.id='vmsCanonicalAdminTopbar';
    top.innerHTML=`
      <div class="vms-admin-top-left">
        <button class="vms-admin-menu-btn" type="button" aria-label="Open Admin menu" aria-expanded="false">${iconSvg('menu')}</button>
        <div class="vms-admin-page-title"><small>VMS ADMIN</small><strong>${title}</strong></div>
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
