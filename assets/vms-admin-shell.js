/* Vision Make Studio — Phase 2 canonical Admin shell
   One shared sidebar, one shared mobile drawer, one shared topbar. */
(()=>{
  'use strict';
  if(window.__VMS_ADMIN_SHELL_PHASE2__)return;
  window.__VMS_ADMIN_SHELL_PHASE2__=true;

  const path=(location.pathname||'/').toLowerCase();
  if(!/(^|\/)admin\//.test(path)||/\/admin\/login(?:\.html)?\/?$/.test(path))return;

  const NAV=[
    ['/admin/','Home','⌂'],
    ['/admin/audit.html','VMS Audit','✦'],
    ['/admin/qr.html','QR Tools','▦'],
    ['/admin/clients.html','Clients','◎'],
    ['/admin/service-catalog.html','Service Catalog','◇'],
    ['/admin/billing.html','Billing / Subscriptions','$'],
    ['/admin/promotions.html','Promotions','%'],
    ['/admin/projects.html','Projects & Requests','✓'],
    ['/admin/files.html','Files & Assets','▤'],
    ['/admin/activity.html','Notifications & Activity','●'],
    ['/admin/linkhub.html','VMS LinkHub','↗'],
    ['/admin/analytics.html','Analytics','◫'],
    ['/admin/leads.html','CRM / Leads','◉'],
    ['/admin/marketing.html','Sales Content','◆'],
    ['/admin/automations.html','Automations','⚡'],
    ['/admin/security.html','Security & Access','⌾']
  ];

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
    link.href=canonicalPath+'?v=20260824-admin-shell-rescue1';
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
        ${NAV.map(([href,label,icon])=>`<a href="${href}"${normalize(href)===current?' class="active" aria-current="page"':''}><span class="vms-nav-icon" aria-hidden="true">${icon}</span><span class="vms-nav-label">${label}</span></a>`).join('')}
      </nav>
      <div class="vms-admin-foot">
        <div class="vms-admin-external"><a href="../portal/">Client Portal</a><a href="../">Public Website</a></div>
        VMS Admin · Private workspace
      </div>`;

    const top=document.createElement('header');
    top.id='vmsCanonicalAdminTopbar';
    top.innerHTML=`
      <div class="vms-admin-top-left">
        <button class="vms-admin-menu-btn" type="button" aria-label="Open Admin menu" aria-expanded="false">☰</button>
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
