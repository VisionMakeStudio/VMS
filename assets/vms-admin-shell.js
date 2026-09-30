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
        ${NAV.map(([href,label,icon])=>`<a href="${href}"${normalize(href)===current?' class="active" aria-current="page"':''}><span class="vms-nav-icon" aria-hidden="true">${icon}</span><span class="vms-nav-label">${label}</span></a>`).join('')}
      </nav>
      <div class="vms-admin-foot">
        <div class="vms-admin-external"><a href="/portal/">Client Portal</a><a href="/">Public Website</a></div>
        VMS Admin · Private workspace
      </div>`;

    const top=document.createElement('header');
    top.id='vmsCanonicalAdminTopbar';
    top.innerHTML=`
      <div class="vms-admin-top-left">
        <button class="vms-admin-menu-btn" type="button" aria-label="Open Admin menu" aria-expanded="false">☰</button>
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
