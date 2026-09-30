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
    top.innerHTML=`<div class="vms-portal-top-left"><button class="vms-portal-menu-btn" type="button" aria-label="Open Client Portal menu" aria-expanded="false">☰</button><div class="vms-portal-page-title"><small>VMS CLIENT PORTAL</small><strong id="vmsCanonicalPortalTitle" role="heading" aria-level="1">${titleSource?.textContent?.trim()||'My VMS Workspace'}</strong></div></div><div class="vms-portal-top-actions"></div>`;
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
