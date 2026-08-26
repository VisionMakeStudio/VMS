/* VMS Phase 3 — canonical Client Portal shell. Mirrors the existing Portal controls instead of moving them. */
(()=>{
  'use strict';
  if(window.__VMS_PORTAL_SHELL_V3__)return;
  window.__VMS_PORTAL_SHELL_V3__=true;
  const ITEMS=[['home','Home','home'],['services','My Services','services'],['qrs','QR Codes','qr'],['linkhub','My LinkHub','link'],['audits','Audits','audit'],['projects','Projects','projects'],['files','Files','files'],['notifications','Notifications','activity'],['requests','Requests','requests'],['billing','Billing','billing'],['contact','Contact / Schedule','contact']];
  const ICON_PATHS={
    home:'<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-6h6v6"/>',
    services:'<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="18" cy="18" r="2.5"/>',
    qr:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 14h2v2M19 19h2v2M14 19h2v2"/>',
    link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    audit:'<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/><path d="m8.5 11 1.7 1.7 3.6-4"/>',
    projects:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v4H9zM8 12l2 2 4-4M8 18h8"/>',
    files:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/>',
    activity:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    requests:'<path d="M4 5h16v12H8l-4 4z"/><path d="M8 9h8M8 13h5"/>',
    billing:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    contact:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><circle cx="16" cy="16" r="2.5"/><path d="M16 14.7V16l1 1"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'
  };
  const iconSvg=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]||ICON_PATHS.home}</svg>`;
  const VALID=new Set(ITEMS.map(([section])=>section));
  const $=(sel,root=document)=>root.querySelector(sel);
  const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const page=(location.pathname.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
  const pageSection=page==='schedule.html'?'contact':page==='qr.html'?'qrs':page==='preferences.html'?'notifications':page==='onboarding.html'?'home':null;
  const sourceSidebar=()=>$('body > .shell > aside.sidebar,body > .app > aside.sidebar,body > aside.sidebar');
  const sourceTopbar=()=>$('body > .shell > .main > header.topbar,body > .app > .main > header.topbar,body > .main > header.topbar,body > header.topbar');
  const sourceNav=()=>$('#nav');
  const sourceTitle=()=>$('#topbarTitle');
  function ensureStylesheet(){
    const canonicalPath='/assets/vms-portal-shell.css';
    const existing=Array.from(document.querySelectorAll('link[rel~="stylesheet"][href*="vms-portal-shell.css"]'))
      .find(link=>{
        try{return new URL(link.getAttribute('href')||'',location.href).pathname===canonicalPath;}
        catch{return false;}
      });
    if(existing){
      existing.id=existing.id||'vmsCanonicalPortalShellCss';
      return;
    }
    const link=document.createElement('link');
    link.id='vmsCanonicalPortalShellCss';
    link.rel='stylesheet';
    link.href=canonicalPath+'?v=20260824-portal-shell-recovery2';
    link.dataset.vmsPortalShellCss='1';
    document.head.appendChild(link);
  }
  function activate(section){
    section=String(section||'').toLowerCase();
    if(!VALID.has(section))return false;
    const source=$(`#nav [data-section="${CSS.escape(section)}"]`);
    if(source){source.click();return true}
    if(page!=='index.html'){location.href=`index.html?section=${encodeURIComponent(section)}`;return true}
    return false;
  }
  function install(){
    ensureStylesheet();
    if($('#vmsCanonicalPortalSidebar'))return;
    document.body.classList.add('vms-portal-canonical');
    const side=sourceSidebar(), topSource=sourceTopbar(), navSource=sourceNav(), titleSource=sourceTitle();
    if(side)side.classList.add('vms-retired-portal-shell');
    if(topSource)topSource.classList.add('vms-retired-portal-shell');
    $$('body > .drawer-backdrop,body > .shell > .drawer-backdrop,body > .app > .drawer-backdrop').forEach(x=>x.classList.add('vms-retired-portal-shell'));

    const aside=document.createElement('aside');
    aside.id='vmsCanonicalPortalSidebar';aside.setAttribute('aria-label','VMS Client Portal');
    const sourceLogo=side?.querySelector('.brand img');
    const logo=sourceLogo?sourceLogo.cloneNode(true):null;
    aside.innerHTML=`<div class="vms-portal-brand"><div class="vms-portal-logo-host"></div><div class="vms-portal-brand-copy"><strong>Vision Make Studio</strong><span>CLIENT PORTAL</span></div></div><nav class="vms-portal-nav" aria-label="Client Portal sections"></nav><div class="vms-portal-account"></div>`;
    if(logo){logo.src='/assets/vms-logo.png';aside.querySelector('.vms-portal-logo-host').appendChild(logo);}
    const account=side?.querySelector('.side-foot');if(account)aside.querySelector('.vms-portal-account').appendChild(account.cloneNode(true));
    const nav=aside.querySelector('.vms-portal-nav');
    ITEMS.forEach(([section,label,icon])=>{const b=document.createElement('button');b.type='button';b.dataset.section=section;b.innerHTML=`<span class="vms-portal-nav-main"><span class="vms-portal-nav-icon">${iconSvg(icon)}</span><span class="vms-portal-nav-label">${label}</span></span><span class="vms-portal-badge-host"></span>`;b.addEventListener('click',()=>activate(section));nav.appendChild(b)});

    const top=document.createElement('header');top.id='vmsCanonicalPortalTopbar';
    top.innerHTML=`<div class="vms-portal-top-left"><button class="vms-portal-menu-btn" type="button" aria-label="Open Client Portal menu" aria-expanded="false">${iconSvg('menu')}</button><div class="vms-portal-page-title"><small>VMS CLIENT PORTAL</small><strong id="vmsCanonicalPortalTitle">${titleSource?.textContent?.trim()||'My VMS Workspace'}</strong></div></div><div class="vms-portal-top-actions"></div>`;
    const sourceActions=topSource?.querySelector('.topbar-actions,.top-actions,.actions');
    /* Move the real action group rather than cloning it so existing click handlers and IDs stay alive. */
    if(sourceActions)top.querySelector('.vms-portal-top-actions').appendChild(sourceActions);

    const shade=document.createElement('div');shade.id='vmsCanonicalPortalBackdrop';
    document.body.prepend(shade);document.body.prepend(top);document.body.prepend(aside);
    const menuBtn=top.querySelector('.vms-portal-menu-btn');
    const close=()=>{aside.classList.remove('open');shade.classList.remove('show');menuBtn.setAttribute('aria-expanded','false');document.body.classList.remove('vms-portal-drawer-open')};
    const open=()=>{aside.classList.add('open');shade.classList.add('show');menuBtn.setAttribute('aria-expanded','true');document.body.classList.add('vms-portal-drawer-open')};
    menuBtn.addEventListener('click',()=>aside.classList.contains('open')?close():open());shade.addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

    function sync(){
      const title=titleSource?.textContent?.trim();if(title)$('#vmsCanonicalPortalTitle').textContent=title;
      ITEMS.forEach(([section])=>{
        const src=$(`#nav [data-section="${CSS.escape(section)}"]`), dst=$(`#vmsCanonicalPortalSidebar [data-section="${CSS.escape(section)}"]`);
        if(!dst)return;
        dst.classList.toggle('active',!!src?.classList.contains('active'));
        dst.setAttribute('aria-current',src?.classList.contains('active')?'page':'false');
        const pill=src?.querySelector('.pill');const host=dst.querySelector('.vms-portal-badge-host');
        if(host)host.innerHTML=pill?pill.outerHTML:'';
      });
    }
    sync();
    if(navSource)new MutationObserver(sync).observe(navSource,{subtree:true,childList:true,attributes:true,characterData:true,attributeFilter:['class']});
    if(titleSource)new MutationObserver(sync).observe(titleSource,{subtree:true,childList:true,characterData:true});
    document.addEventListener('click',e=>{if(e.target.closest('[data-section-jump]'))setTimeout(sync,0)});
    window.addEventListener('resize',()=>{if(innerWidth>820)close()},{passive:true});
    const querySection=String(new URLSearchParams(location.search).get('section')||'').toLowerCase();
    const hashSection=String(location.hash.replace(/^#/,'')||'').toLowerCase();
    const requested=VALID.has(querySection)?querySection:VALID.has(hashSection)?hashSection:pageSection;
    if(requested)requestAnimationFrame(()=>{activate(requested);setTimeout(sync,0)});
  }
  ensureStylesheet();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
