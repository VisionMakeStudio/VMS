/* VMS Phase 3 — canonical Client Portal shell. Mirrors the existing Portal controls instead of moving them. */
(()=>{
  'use strict';
  if(window.__VMS_PORTAL_SHELL_V3__)return;
  window.__VMS_PORTAL_SHELL_V3__=true;
  const ITEMS=[['home','Home'],['services','My Services'],['qrs','QR Codes'],['linkhub','My LinkHub'],['audits','Audits'],['projects','Projects'],['files','Files'],['notifications','Notifications'],['requests','Requests'],['billing','Billing'],['contact','Contact / Schedule']];
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
    ITEMS.forEach(([section,label])=>{const b=document.createElement('button');b.type='button';b.dataset.section=section;b.innerHTML=`<span>${label}</span><span class="vms-portal-badge-host"></span>`;b.addEventListener('click',()=>activate(section));nav.appendChild(b)});

    const top=document.createElement('header');top.id='vmsCanonicalPortalTopbar';
    top.innerHTML=`<div class="vms-portal-top-left"><button class="vms-portal-menu-btn" type="button" aria-label="Open Client Portal menu" aria-expanded="false">☰</button><div class="vms-portal-page-title"><small>VMS CLIENT PORTAL</small><strong id="vmsCanonicalPortalTitle">${titleSource?.textContent?.trim()||'My VMS Workspace'}</strong></div></div><div class="vms-portal-top-actions"></div>`;
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
        if(host){host.textContent='';if(pill){const copy=pill.cloneNode(true);copy.removeAttribute('id');host.appendChild(copy)}}
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
