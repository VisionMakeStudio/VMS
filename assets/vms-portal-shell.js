/* canonical menu labels: Home, My Services, QR Codes, My LinkHub, Audits, Projects, Files, Notifications, Requests, Billing, Contact / Schedule; canonical root: /assets/vms-portal-shell.css */
/* VMS Phase 3 — canonical Client Portal shell. Mirrors the existing Portal controls instead of moving them. */
(()=>{
  'use strict';
  try{const t=localStorage.getItem('vms-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}
  if(window.__VMS_PORTAL_SHELL_V3__)return;
  window.__VMS_PORTAL_SHELL_V3__=true;
  const ITEMS=[
    ['home','Home','home',true],['services','Services','star',true],['qrs','QR and LinkHub','qr',true],
    ['billing','Billing','card',true],['contact','Schedule','cal',true],
    ['linkhub','My LinkHub','link',false],['audits','Audits','check',false],
    ['projects','Projects','cal',false],['files','Files','file',false],
    ['notifications','Notifications','bell',false],['requests','Requests','bolt',false],
  ];
  const VP_ICONS={home:'<path d="M3 12L12 4l9 8M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>',star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',qr:'<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="4" height="4" rx=".8"/><path d="M21 18v3M18 21h3"/>',card:'<rect x="1" y="4" width="22" height="16" rx="2.5"/><line x1="1" y1="10" x2="23" y2="10"/>',cal:'<rect x="3" y="4" width="18" height="18" rx="2.5"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',link:'<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',check:'<path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4 12 14.01l-3-3"/>',file:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',bell:'<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>',bolt:'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',moon:'<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',sun:'<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'}; 
  const vpIco=id=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" fill="none" d="'+VP_ICONS[id]+'"/></svg>';
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
    document.querySelectorAll('#vmsPortalTabBar button').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
    document.querySelectorAll('.vms-portal-nav button').forEach(b=>b.classList.toggle('active',b.dataset.section===section));

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
    aside.innerHTML='<div class="vp-brand"><img src="/assets/vms-logo-navy.png" alt="Vision Make Studio" onerror="this.src=\'/assets/vms-logo.png\'"><div><strong>Vision Make Studio</strong><span>CLIENT PORTAL</span></div></div><nav class="vms-portal-nav" aria-label="Client Portal sections"></nav><div class="vp-account"><div class="vp-account-inner"></div></div>';
    const nav=aside.querySelector('.vms-portal-nav');
    ITEMS.forEach(([section,label,iconId,_])=>{
      const b=document.createElement('button');b.type='button';b.dataset.section=section;
      b.innerHTML='<span class="vp-nav-icon">'+vpIco(iconId)+'</span><span>'+label+'</span><span class="vms-portal-badge-host" data-badge-section="'+section+'"></span>';
      b.addEventListener('click',()=>activate(section));
      nav.appendChild(b);
    });
    const acct=aside.querySelector('.vp-account-inner');
    const existing=document.querySelector('.side-foot,.side-client');
    if(existing&&acct)acct.appendChild(existing.cloneNode(true));
    const tBtn=document.createElement('button');tBtn.className='vp-theme-btn';tBtn.type='button';
    const effD2=()=>{const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches};
    const pT2=()=>{tBtn.innerHTML=vpIco(effD2()?'sun':'moon');tBtn.setAttribute('aria-label',effD2()?'Switch to light mode':'Switch to dark mode')};
    tBtn.addEventListener('click',()=>{const n=effD2()?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('vms-theme',n)}catch(e){}pT2()});
    if(acct)acct.appendChild(tBtn);pT2();
    let tabBar=document.getElementById('vmsPortalTabBar');
    if(!tabBar){tabBar=document.createElement('nav');tabBar.id='vmsPortalTabBar';tabBar.setAttribute('aria-label','Quick navigation');
      ITEMS.filter(x=>x[3]).forEach(([section,label,iconId])=>{
        const b=document.createElement('button');b.type='button';b.dataset.section=section;
        b.innerHTML=vpIco(iconId)+'<span>'+label+'</span><span class="tb-badge" data-tbbadge="'+section+'" hidden></span>';
        tabBar.appendChild(b);
      });
      ITEMS.filter(x=>x[3]).forEach(([section])=>{const b=tabBar.querySelector('[data-section="'+section+'"]');if(b)b.addEventListener('click',()=>activate(section))});
      document.body.appendChild(tabBar);
    }

    const top=document.createElement('header');top.id='vmsCanonicalPortalTopbar';
    top.innerHTML='<div class="vp-top-left"><button class="vp-menu-btn" type="button" aria-label="Open portal menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg></button><div class="vp-title"><small>CLIENT PORTAL</small><strong id="vmsCanonicalPortalTitle" role="heading" aria-level="1">'+(titleSource?.textContent?.trim()||'My VMS Workspace')+'</strong></div></div><div class="vp-top-actions"></div>';
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
