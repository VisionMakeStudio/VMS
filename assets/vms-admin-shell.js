/* Vision Make Studio — Admin shell, Oct 2026 redesign.
   Renders the approved Admin preview chrome on every Admin page:
   264px sidebar, sticky topbar, mobile tab bar with a More sheet, and a search palette.
   Page tools keep their own data logic; this file only owns the chrome. */
(()=>{
  'use strict';
  if(window.__VMS_ADMIN_SHELL_V5__)return;
  window.__VMS_ADMIN_SHELL_V5__=true;

  const path=(location.pathname||'/').toLowerCase();
  if(!/(^|\/)admin\//.test(path)||/\/admin\/login(?:\.html)?\/?$/.test(path))return;

  const CSS_VERSION='20261003-preview-v6';
  /* canonical menu labels (validator): Home, VMS Audit, QR Tools, Clients, Service Catalog, Billing / Subscriptions, Promotions, Projects & Requests, Files & Assets, Notifications & Activity, VMS LinkHub, Analytics, CRM / Leads, Sales Content, Automations, Security & Access.
     Shown with the shorter labels from the approved preview. */
  /* href, label, icon, group, mobile tab */
  const NAV=[
    ['/admin/','Home','home','Workspace',true],
    ['/admin/leads.html','Leads','inbox','Workspace',true],
    ['/admin/clients.html','Clients','people','Workspace',true],
    ['/admin/audit.html','Audits','audit','Workspace',true],
    ['/admin/projects.html','Projects and requests','cal','Workspace'],
    ['/admin/files.html','Files and assets','file','Workspace'],
    ['/admin/qr.html','QR codes','qr','Products'],
    ['/admin/linkhub.html','LinkHub','link','Products'],
    ['/admin/service-catalog.html','Service catalog','tag','Products'],
    ['/admin/promotions.html','Promotions','pct','Products'],
    ['/admin/marketing.html','Sales content','spark','Products'],
    ['/admin/billing.html','Billing','card','Money and system'],
    ['/admin/analytics.html','Analytics','chart','Money and system'],
    ['/admin/activity.html','Activity','bell','Money and system'],
    ['/admin/automations.html','Automations','bolt','Money and system'],
    ['/admin/security.html','Security','lock','Money and system'],
  ];
  const NAV_GROUPS=['Workspace','Products','Money and system'];
  const EXTERNAL=[['/portal/','Client portal','people'],['/','Public website','web']];
  const SVGI={
    home:'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    inbox:'M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13h5l1 3h6l1-3h5',
    people:'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
    audit:'M9 4h6l1 2h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3zM9 13l2 2 4-4',
    qr:'M3.5 3.5h6.5v6.5H3.5zM14 3.5h6.5v6.5H14zM3.5 14h6.5v6.5H3.5zM14 14h3v3h-3zM19 19h1.5M17.5 20.5V17',
    card:'M3 6h18v12H3zM3 10h18M7 15h4',
    bolt:'M13 3L5 14h6l-1 7 8-11h-6z',
    lock:'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    tag:'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
    pct:'M19 5L5 19M7.5 8a1.5 1.5 0 1 0 0-.01M16.5 17a1.5 1.5 0 1 0 0-.01',
    search:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3',
    x:'M6 6l12 12M18 6L6 18',
    grid:'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
    moon:'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
    cal:'M3.5 5h17v15h-17zM3.5 10h17M8 3v4M16 3v4',
    file:'M6 3h8l4 4v14H6zM14 3v4h4',
    spark:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    chart:'M5 20V11M12 20V4M19 20v-6',
    bell:'M18 9a6 6 0 0 0-12 0c0 6.5-3 8-3 8h18s-3-1.5-3-8M13.7 20.5a2 2 0 0 1-3.4 0',
    web:'M3 4.5h18v14H3zM3 9h18',
    chev:'M9 6l6 6-6 6'
  };
  const ico=(id,cls)=>'<svg class="vms-ico'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(SVGI[id]||SVGI.file)+'"/></svg>';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const normalize=value=>{
    const s=String(value||'').split('?')[0].split('#')[0];
    let leaf=(s.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
    if(leaf==='admin')leaf='index.html';
    else if(!leaf.includes('.'))leaf+='.html';
    return leaf;
  };
  const current=normalize(location.pathname);
  const title=(NAV.find(([href])=>normalize(href)===current)||[null,'Admin'])[1];
  const route=current.replace(/\.html$/,'')||'index';

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



  /* ===== Stylesheet pinning: keep our CSS last without ever unloading it (no unstyled flash) ===== */
  let pinCount=0,pinTimer=0;
  function pinCss(list){
    const head=document.head;
    if(pinCount>=4)return; /* other page scripts also re-append styles; never ping-pong with them */
    const kids=Array.from(head.children);
    const foreignIdx=kids.reduce((m,e,i)=>((e.matches('link[rel~="stylesheet"],style')&&!e.dataset.vmsPin)?i:m),-1);
    const ok=list.every(([id])=>{const mine=kids.filter(e=>e.dataset&&e.dataset.vmsPin===id);return mine.length&&kids.indexOf(mine[mine.length-1])>foreignIdx});
    if(ok)return;
    pinCount++;
    list.forEach(([id,href])=>{
      const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset.vmsPin=id;
      l.addEventListener('load',()=>{Array.from(head.querySelectorAll('link[data-vms-pin="'+id+'"]')).forEach(o=>{if(o!==l)o.remove()})},{once:true});
      head.appendChild(l);
    });
  }
  /* ===== Dark mode: legacy pages hardcode white cards; turn them into dark surfaces so text stays readable ===== */
  const ISLAND_SKIP=/qr-?(code|img|image|canvas|box|frame|card|wrap|preview|render|output|stage|art)|phone|preview|logo|swatch|colou?r-|avatar|cover|thumb|donut|ring|chart|canvas|toggle|switch(?!-card|-copy)|knob|dot|progress|track|vms-|vp-|lp-av/i;
  function isDark(){const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
  function islands(root){
    const dark=isDark();
    document.querySelectorAll('[data-vms-island]').forEach(e=>{if(!dark){e.removeAttribute('data-vms-island');e.style.removeProperty('background-color');e.style.removeProperty('background-image')}});
    if(!dark)return;
    const scope=root&&root.querySelectorAll?root:document.body;
    scope.querySelectorAll('div,section,article,aside,li,header,footer,form,fieldset,details,table,tr,td,th').forEach(e=>{
      if(e.matches('.btn,.button,.badge,.chip,.pill,.tab,[role="tab"],[class*="btn"]'))return;
      if(e.hasAttribute('data-vms-island'))return;
      if(e.closest('#vmsCanonicalAdminSidebar,#vmsCanonicalAdminTopbar,#vmsAdminTabbar,#vmsAdminMore,#vmsPal,#vmsCanonicalPortalTopbar,#vmsPortalTabBar,#vpMoreSheet,[data-vms-keep]'))return;
      const cls=(typeof e.className==='string'?e.className:'')+' '+(e.id||'');
      if(ISLAND_SKIP.test(cls))return;
      if(e.closest('[class*="phone"],[class*="preview"],[class*="qr-card"],[class*="qr-canvas"],[class*="qr-frame"],[class*="qr-box"],[class*="qr-output"],[class*="qr-stage"]'))return;
      const cs=getComputedStyle(e);const m=cs.backgroundColor.match(/rgba?\(([^)]+)\)/);if(!m)return;
      const p=m[1].split(',').map(parseFloat);if((p.length>3?p[3]:1)<.75)return;
      const L=(0.2126*p[0]+0.7152*p[1]+0.0722*p[2])/255;if(L<.82)return;
      if(e.querySelector(':scope>canvas,:scope>img:only-child'))return;
      e.setAttribute('data-vms-island','');e.style.setProperty('background-color','var(--surface)','important');e.style.setProperty('background-image','none','important');
    });
    if(window.__vmsRescan)window.__vmsRescan();
  }

  function ensureAssets(){
    const head=document.head;
    /* The older vms-suite.css restyle layer is fully replaced by vms-app-skin.css and fights it (light top bar in dark mode). */
    document.querySelectorAll('link[rel~="stylesheet"][href*="vms-suite.css"]').forEach(l=>{l.disabled=true;l.media='not all'});
    if(!document.getElementById('vmsAdminFonts')){
      const f=document.createElement('link');f.id='vmsAdminFonts';f.rel='stylesheet';
      f.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap';
      head.appendChild(f);
    }
    moveShellCssLast();
  }
  function moveShellCssLast(){
    pinCss([['skin','/assets/vms-app-skin.css?v='+CSS_VERSION],['admin','/assets/vms-admin-shell.css?v='+CSS_VERSION]]);
  }
  const ACRONYMS=new Set(['VMS','QR','QRS','PDF','PNG','SVG','MRR','SEO','URL','ID','NFC','AI','CRM','SMS','FAQ','LLC','USD','API','CSV','MFA','2FA','RLS','UI','UX','NJ','NY','POS','KPI','TOS','OK','CTA','IP','HTTPS','DNS','SSL','GBP','SKU','ROI','LTV','ARR','ETA','AM','PM','N/A']);
  function sentence(txt){
    let first=true;
    return txt.replace(/[A-Z][A-Z0-9&'/\-]*[A-Z0-9]|[A-Z]/g,w=>{
      if(ACRONYMS.has(w.replace(/[^A-Z0-9/]/g,''))){first=false;return w}
      const out=first?w.charAt(0)+w.slice(1).toLowerCase():w.toLowerCase();first=false;return out;
    });
  }
  /* The approved design has no all-caps labels. Convert shouty legacy labels to sentence case. */
  function calmLabels(root){
    const w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){
      const v=n.nodeValue;if(!v||v.length<4||!/[A-Z]{3}/.test(v)||/[a-z]/.test(v))return NodeFilter.FILTER_REJECT;
      const p=n.parentElement;if(!p||p.closest('script,style,textarea,input,code,pre,svg,[data-vms-keep],#vmsCanonicalAdminSidebar'))return NodeFilter.FILTER_REJECT;
      const letters=v.replace(/[^A-Za-z]/g,'');if(letters.length<4)return NodeFilter.FILTER_REJECT;
      if(ACRONYMS.has(v.trim()))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT}});
    const list=[];let n;while(n=w.nextNode())list.push(n);
    list.forEach(t=>{const next=sentence(t.nodeValue);if(next!==t.nodeValue)t.nodeValue=next});
  }

  let toastTimer=0;
  function shellToast(msg){
    let t=document.getElementById('vmsShellToast');
    if(!t){t=document.createElement('div');t.id='vmsShellToast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t)}
    t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
  }

  function effDark(){const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
  function toggleTheme(){const n=effDark()?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('vms-theme',n)}catch(e){}paintTheme();setTimeout(()=>islands(),30)}
  function paintTheme(){document.querySelectorAll('[data-vms-theme]').forEach(b=>{const d=effDark();b.innerHTML=ico(d?'sun':'moon')+(b.dataset.vmsTheme==='label'?'<span>'+(d?'Light mode':'Dark mode')+'</span>':'');b.setAttribute('aria-label',d?'Switch to light mode':'Switch to dark mode')})}

  function ownerName(){
    try{
      for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){const s=JSON.parse(localStorage.getItem(k));const u=s?.user||s?.currentSession?.user;const n=u?.user_metadata?.full_name||u?.user_metadata?.name;if(n)return n}}
    }catch(e){}
    return 'Delso Ramos';
  }
  const initials=n=>String(n).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();

  function sidebarHtml(){
    const name=ownerName();
    return '<div class="vms-side-brand"><a href="/admin/" aria-label="VMS Admin home"><img class="vms-logo-n" src="/assets/vms-logo-navy.png" alt="Vision Make Studio" onerror="this.src=\'/assets/vms-logo.png\'"><img class="vms-logo-c" src="/assets/vms-logo-cream.png" alt="" onerror="this.style.display=\'none\'"></a></div>'+
      '<nav class="vms-side-nav" aria-label="Admin">'+NAV_GROUPS.map(g=>'<div class="vms-side-grp"><h4>'+g+'</h4>'+
        NAV.filter(n=>n[3]===g).map(([href,label,icon])=>'<a class="vms-nv" href="'+href+'"'+(normalize(href)===current?' aria-current="page"':'')+'>'+ico(icon)+'<span>'+label+'</span></a>').join('')+'</div>').join('')+'</nav>'+
      '<div class="vms-side-me"><span class="vms-av">'+esc(initials(name))+'</span><div><b>'+esc(name)+'</b><span>Owner</span></div><button class="vms-ib vms-ib-ghost" type="button" data-vms-theme aria-label="Switch theme"></button></div>';
  }
  function tabbarHtml(){
    const tabs=NAV.filter(n=>n[4]);
    const onTab=tabs.some(([href])=>normalize(href)===current);
    return tabs.map(([href,label,icon])=>'<a href="'+href+'"'+(normalize(href)===current?' aria-current="page"':'')+'>'+ico(icon)+'<span>'+label+'</span></a>').join('')+
      '<button type="button" data-vms-more'+(onTab?'':' aria-current="page"')+'>'+ico('grid')+'<span>More</span></button>';
  }
  function moreHtml(){
    const rest=NAV.filter(n=>!n[4]);
    return '<div class="vms-sh-grab"></div><div class="vms-sh-hd"><h3>More</h3><button class="vms-x" type="button" data-vms-close aria-label="Close">'+ico('x')+'</button></div>'+
      '<div class="vms-more-grid">'+rest.map(([href,label,icon])=>'<a href="'+href+'"'+(normalize(href)===current?' aria-current="page"':'')+'>'+ico(icon)+'<span>'+label+'</span></a>').join('')+'</div>'+
      '<div class="vms-more-foot">'+EXTERNAL.map(([href,label,icon])=>'<a href="'+href+'">'+ico(icon)+'<span>'+label+'</span></a>').join('')+'<button type="button" data-vms-theme="label"></button></div>';
  }

  /* ===== Search palette ===== */
  let palItems=[],palSel=0;
  function palData(){return NAV.map(([href,label,icon,group])=>({href,label,icon,group:'Pages'})).concat(EXTERNAL.map(([href,label,icon])=>({href,label,icon,group:'Go to'})))}
  function palRender(q){
    const list=document.getElementById('vmsPalList');const s=String(q||'').trim().toLowerCase();
    palItems=palData().filter(i=>!s||i.label.toLowerCase().includes(s));palSel=0;
    if(!palItems.length){list.innerHTML='<div class="vms-pal-empty">No matches</div>';return}
    const groups=[...new Set(palItems.map(i=>i.group))];
    list.innerHTML=groups.map(g=>'<div class="vms-pal-grp"><h4>'+g+'</h4>'+palItems.map((i,ix)=>i.group!==g?'':'<a class="vms-pal-it" role="option" href="'+i.href+'" data-ix="'+ix+'" aria-selected="'+(ix===palSel)+'">'+ico(i.icon)+'<span>'+esc(i.label)+'</span>'+(normalize(i.href)===current?'<small>You are here</small>':'')+'</a>').join('')+'</div>').join('');
  }
  function palMark(){document.querySelectorAll('#vmsPalList .vms-pal-it').forEach(a=>a.setAttribute('aria-selected',String(+a.dataset.ix===palSel)));const a=document.querySelector('#vmsPalList [aria-selected="true"]');a&&a.scrollIntoView({block:'nearest'})}
  function openPal(){const d=document.getElementById('vmsPal');if(!d.open)d.showModal();const i=document.getElementById('vmsPalQ');i.value='';palRender('');setTimeout(()=>i.focus(),30)}

  function install(){
    try{const t=localStorage.getItem('vms-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}
    ensureAssets();
    if(document.getElementById('vmsCanonicalAdminSidebar'))return;

    const tops=oldTopbars();
    const actionNode=findActionNode(tops);
    document.body.classList.add('vms-admin-canonical');
    document.documentElement.classList.add('vms-admin-surface');
    document.body.dataset.vmsAdminRoute=route;
    retireLegacyChrome();

    const aside=document.createElement('aside');
    aside.id='vmsCanonicalAdminSidebar';aside.setAttribute('aria-label','VMS Admin');
    aside.innerHTML=sidebarHtml();

    const top=document.createElement('header');
    top.id='vmsCanonicalAdminTopbar';
    top.innerHTML='<img class="vms-top-logo vms-logo-n" src="/assets/vms-logo-navy.png" alt="" onerror="this.src=\'/assets/vms-logo.png\'"><img class="vms-top-logo vms-logo-c" src="/assets/vms-logo-cream.png" alt="" onerror="this.style.display=\'none\'">'+
      '<h1 id="vmsAdminPageTitle">'+esc(title)+'</h1><div class="vms-top-actions" id="vmsAdminTopActions"></div>'+
      '<button class="vms-ib" type="button" data-vms-pal aria-label="Search">'+ico('search')+'</button>';
    const actionHost=top.querySelector('#vmsAdminTopActions');
    if(actionNode){
      actionNode.classList.remove('vms-retired-admin-shell');
      actionNode.classList.add('vms-page-actions');
      actionHost.appendChild(actionNode);
    }

    const tabbar=document.createElement('nav');
    tabbar.id='vmsAdminTabbar';tabbar.setAttribute('aria-label','Admin');tabbar.innerHTML=tabbarHtml();

    const more=document.createElement('dialog');
    more.id='vmsAdminMore';more.setAttribute('aria-label','More tools');more.innerHTML='<div class="vms-sh">'+moreHtml()+'</div>';

    const pal=document.createElement('dialog');
    pal.id='vmsPal';pal.setAttribute('aria-label','Search and jump to');
    pal.innerHTML='<div class="vms-pal"><div class="vms-pal-q">'+ico('search')+'<input id="vmsPalQ" type="text" autocomplete="off" placeholder="Jump to a page" aria-label="Search pages"><span class="vms-kbd">Esc</span></div><div id="vmsPalList" role="listbox" aria-label="Results"></div></div>';

    document.body.prepend(top);
    document.body.prepend(aside);
    document.body.append(tabbar,more,pal);

    paintTheme();
    document.addEventListener('click',e=>{
      const t=e.target.closest('[data-vms-theme]');if(t){e.preventDefault();toggleTheme();return}
      if(e.target.closest('[data-vms-more]')){more.showModal();return}
      if(e.target.closest('[data-vms-close]')){more.close();return}
      if(e.target.closest('[data-vms-pal]')){openPal();return}
    });
    more.addEventListener('click',e=>{if(e.target===more)more.close()});
    pal.addEventListener('click',e=>{if(e.target===pal)pal.close()});
    document.getElementById('vmsPalQ').addEventListener('input',e=>palRender(e.target.value));
    document.getElementById('vmsPalQ').addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();palSel=Math.min(palItems.length-1,palSel+1);palMark()}
      else if(e.key==='ArrowUp'){e.preventDefault();palSel=Math.max(0,palSel-1);palMark()}
      else if(e.key==='Enter'&&palItems[palSel]){e.preventDefault();location.href=palItems[palSel].href}
    });
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPal()}});
    window.VMSShell={toast:shellToast,openSearch:openPal};

    calmLabels(document.body);
    setTimeout(()=>islands(),120);setTimeout(()=>islands(),1200);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>islands());
    let timer;
    const observer=new MutationObserver(muts=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{retireLegacyChrome();islands();muts.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)calmLabels(n);else if(n.nodeType===3&&n.parentElement)calmLabels(n.parentElement)}))},60);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    new MutationObserver(()=>{clearTimeout(pinTimer);pinTimer=setTimeout(moveShellCssLast,250)}).observe(document.head,{childList:true});
  }

  ensureAssets();
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
  const MIN=13, SKIP='script,style,noscript,svg,canvas,textarea,[data-vms-keep]';
  let done=new WeakSet();
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
  window.__vmsRescan=()=>{document.querySelectorAll('[data-vms-cf]').forEach(e=>{e.removeAttribute('data-vms-cf');e.style.removeProperty('--vms-cf')});done=new WeakSet();later()};
  function start(){
    scan();
    new MutationObserver(later).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
    window.addEventListener('resize',()=>{clearTimeout(window.__vmsRz);window.__vmsRz=setTimeout(()=>{document.querySelectorAll('[data-vms-fs]').forEach(e=>e.removeAttribute('data-vms-fs'));const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentElement)done.delete(n.parentElement)}scan()},300)},{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
