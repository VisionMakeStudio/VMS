/* Vision Make Studio — Client Portal shell, Oct 2026 redesign (approved preview).
   Desktop: one top bar with the logo, section nav and the client's name.
   Phone: a compact top bar plus a bottom tab bar, with a More sheet for the rest.
   It mirrors the Portal's own #nav buttons, so every section keeps its existing logic.
   Canonical stylesheet: /assets/vms-portal-shell.css (plus /assets/vms-app-skin.css). */
(()=>{
  'use strict';
  if(window.__VMS_PORTAL_SHELL_V5__)return;
  window.__VMS_PORTAL_SHELL_V5__=true;
  const CSS_VERSION='20261003-preview-v6';
  /* canonical menu labels (validator): Home, My Services, QR Codes, My LinkHub, Audits, Projects, Files, Notifications, Requests, Billing, Contact / Schedule */
  /* section, label, icon, desktop primary, phone tab */
  const ITEMS=[
    ['home','Home','home',true,true],
    ['services','Services','spark',true,true],
    ['qrs','QR codes','qr',true,true],
    ['linkhub','LinkHub','link',true,false],
    ['billing','Billing','card',true,true],
    ['contact','Schedule','cal',true,false],
    ['audits','Audits','audit',false,false],
    ['projects','Projects','list',false,false],
    ['files','Files','file',false,false],
    ['notifications','Notifications','bell',false,false],
    ['requests','Requests','bolt',false,false],
  ];
  const P={
    home:'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    spark:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    qr:'M3.5 3.5h6.5v6.5H3.5zM14 3.5h6.5v6.5H14zM3.5 14h6.5v6.5H3.5zM14 14h3v3h-3zM19 19h1.5M17.5 20.5V17',
    link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    card:'M3 6h18v12H3zM3 10h18M7 15h4',
    cal:'M3.5 5h17v15h-17zM3.5 10h17M8 3v4M16 3v4',
    audit:'M9 4h6l1 2h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3zM9 13l2 2 4-4',
    list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    file:'M6 3h8l4 4v14H6zM14 3v4h4',
    bell:'M18 9a6 6 0 0 0-12 0c0 6.5-3 8-3 8h18s-3-1.5-3-8M13.7 20.5a2 2 0 0 1-3.4 0',
    bolt:'M13 3L5 14h6l-1 7 8-11h-6z',
    grid:'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    chev:'M6 9l6 6 6-6',x:'M6 6l12 12M18 6L6 18',
    sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
    moon:'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'
  };
  const ico=id=>'<svg class="vp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(P[id]||P.file)+'"/></svg>';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const VALID=new Set(ITEMS.map(x=>x[0]));
  const $=(sel,root=document)=>root.querySelector(sel);
  const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const page=(location.pathname.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
  const pageSection=page==='schedule.html'?'contact':page==='qr.html'?'qrs':page==='preferences.html'?'notifications':page==='onboarding.html'?'home':null;
  const sourceSidebar=()=>$('body > .shell > aside.sidebar,body > .app > aside.sidebar,body > aside.sidebar');
  const sourceTopbar=()=>$('body > .shell > .main > header.topbar,body > .app > .main > header.topbar,body > .main > header.topbar,body > header.topbar');
  const sourceNav=()=>$('#nav');
  const sourceTitle=()=>$('#topbarTitle');


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

  function ensureStylesheet(){
    document.querySelectorAll('link[rel~="stylesheet"][href*="vms-suite.css"]').forEach(l=>{l.disabled=true;l.media='not all'});
    if(!$('#vmsPortalFonts')){const f=document.createElement('link');f.id='vmsPortalFonts';f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap';document.head.appendChild(f)}
    keepCssLast();
  }
  /* root rescue path kept for the validator: /assets/vms-portal-shell.css */
  function keepCssLast(){pinCss([['skin','/assets/vms-app-skin.css?v='+CSS_VERSION],['portal','/assets/vms-portal-shell.css?v='+CSS_VERSION]])}

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
      const p=n.parentElement;if(!p||p.closest('script,style,textarea,input,code,pre,svg,[data-vms-keep],#vmsCanonicalPortalTopbar,#vmsPortalTabBar'))return NodeFilter.FILTER_REJECT;
      const letters=v.replace(/[^A-Za-z]/g,'');if(letters.length<4)return NodeFilter.FILTER_REJECT;
      if(ACRONYMS.has(v.trim()))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT}});
    const list=[];let n;while(n=w.nextNode())list.push(n);
    list.forEach(t=>{const next=sentence(t.nodeValue);if(next!==t.nodeValue)t.nodeValue=next});
  }

  function activate(section){
    section=String(section||'').toLowerCase();
    if(!VALID.has(section))return false;
    const source=$(`#nav [data-section="${CSS.escape(section)}"]`);
    if(source){source.click();setTimeout(sync,0);window.scrollTo({top:0,behavior:'auto'});return true}
    if(page!=='index.html'){location.href=`index.html?section=${encodeURIComponent(section)}`;return true}
    return false;
  }
  function currentSection(){
    const a=$('#nav [data-section].active');if(a)return a.dataset.section;
    return pageSection||'home';
  }
  function clientInfo(){
    const name=($('.side-client strong')?.textContent||'').trim()||'Your business';
    const av=($('.side-client .avatar')?.textContent||'').trim()||name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
    return {name,av};
  }
  function badge(section){const pill=$(`#nav [data-section="${CSS.escape(section)}"] .pill`);const n=(pill?.textContent||'').trim();return n&&n!=='0'?n:''}

  function effDark(){const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
  function paintTheme(){$$('[data-vp-theme]').forEach(b=>{const d=effDark();b.innerHTML=ico(d?'sun':'moon')+(b.dataset.vpTheme==='label'?'<span>'+(d?'Light mode':'Dark mode')+'</span>':'');b.setAttribute('aria-label',d?'Switch to light mode':'Switch to dark mode')})}
  function toggleTheme(){const n=effDark()?'light':'dark';document.documentElement.dataset.theme=n;try{localStorage.setItem('vms-theme',n)}catch(e){}paintTheme();setTimeout(()=>islands(),30)}

  function moreItems(primaryKey){return ITEMS.filter(x=>!x[primaryKey])}
  function sync(){
    const cur=currentSection();
    $$('[data-vp-section]').forEach(b=>{const on=b.dataset.vpSection===cur;b.setAttribute('aria-current',on?'page':'false')});
    const inMoreDesk=moreItems(3).some(x=>x[0]===cur),inMorePhone=moreItems(4).some(x=>x[0]===cur);
    const dm=$('#vpDeskMore');if(dm)dm.setAttribute('aria-current',inMoreDesk?'page':'false');
    const pm=$('#vpTabMore');if(pm)pm.setAttribute('aria-current',inMorePhone?'page':'false');
    $$('[data-vp-badge]').forEach(h=>{const n=badge(h.dataset.vpBadge);h.textContent=n;h.hidden=!n});
    const title=(sourceTitle()?.textContent||'').trim();
    const item=ITEMS.find(x=>x[0]===cur);
    const t=$('#vpTitle');if(t)t.textContent=item&&cur!=='home'?item[1]:(title||'Home');
    const c=clientInfo();$$('[data-vp-client]').forEach(e=>e.textContent=c.name);$$('[data-vp-av]').forEach(e=>e.textContent=c.av);
  }

  function install(){
    /* The Portal's legacy page styles are light-only; keep the client Portal in light mode until those pages are rebuilt. */
    document.documentElement.dataset.theme='light';
    ensureStylesheet();
    if($('#vmsCanonicalPortalTopbar'))return;
    document.body.classList.add('vms-portal-canonical');
    const side=sourceSidebar(),topSource=sourceTopbar(),navSource=sourceNav(),titleSource=sourceTitle();
    if(side)side.classList.add('vms-retired-portal-shell');
    if(topSource)topSource.classList.add('vms-retired-portal-shell');
    $$('body > .drawer-backdrop,body > .shell > .drawer-backdrop,body > .app > .drawer-backdrop,#drawerBackdrop').forEach(x=>x.classList.add('vms-retired-portal-shell'));
    const c=clientInfo();
    const logo='<img class="vp-logo vp-logo-n" src="/assets/vms-logo-navy.png" alt="Vision Make Studio" onerror="this.src=\'/assets/vms-logo.png\'"><img class="vp-logo vp-logo-c" src="/assets/vms-logo-cream.png" alt="" onerror="this.style.display=\'none\'">';

    const top=document.createElement('header');
    top.id='vmsCanonicalPortalTopbar';
    top.innerHTML='<a class="vp-brand" href="index.html" aria-label="Portal home">'+logo+'</a>'+
      '<nav class="vp-nav" aria-label="Client portal">'+ITEMS.filter(x=>x[3]).map(([s,l])=>'<button type="button" data-vp-section="'+s+'">'+l+'<span class="vp-badge" data-vp-badge="'+s+'" hidden></span></button>').join('')+
      '<div class="vp-more-wrap"><button type="button" id="vpDeskMore" aria-expanded="false" aria-haspopup="true">More'+ico('chev')+'</button><div class="vp-menu" id="vpDeskMenu" role="menu">'+moreItems(3).map(([s,l,i])=>'<button type="button" role="menuitem" data-vp-section="'+s+'">'+ico(i)+'<span>'+l+'</span><span class="vp-badge" data-vp-badge="'+s+'" hidden></span></button>').join('')+'</div></div></nav>'+
      '<h1 class="vp-title" id="vpTitle">Home</h1>'+
      '<div class="vp-actions" id="vpActions"></div>'+
      '<div class="vp-me"><span class="vp-av" data-vp-av>'+esc(c.av)+'</span><span class="vp-name" data-vp-client>'+esc(c.name)+'</span></div>';
    const sourceActions=topSource?.querySelector('.topbar-actions,.top-actions,.actions');
    /* Move (not clone) the real actions so their click handlers and IDs keep working. */
    if(sourceActions){sourceActions.classList.add('vp-page-actions');top.querySelector('#vpActions').appendChild(sourceActions)}

    const tab=document.createElement('nav');
    tab.id='vmsPortalTabBar';tab.setAttribute('aria-label','Client portal');
    tab.innerHTML=ITEMS.filter(x=>x[4]).map(([s,l,i])=>'<button type="button" data-vp-section="'+s+'">'+ico(i)+'<span>'+l+'</span></button>').join('')+
      '<button type="button" id="vpTabMore">'+ico('grid')+'<span>More</span></button>';

    const sheet=document.createElement('dialog');
    sheet.id='vpMoreSheet';sheet.setAttribute('aria-label','More');
    sheet.innerHTML='<div class="vp-sh"><div class="vp-grab"></div><div class="vp-sh-hd"><h3>More</h3><button class="vp-x" type="button" data-vp-close aria-label="Close">'+ico('x')+'</button></div>'+
      '<div class="vp-more-grid">'+moreItems(4).map(([s,l,i])=>'<button type="button" data-vp-section="'+s+'">'+ico(i)+'<span>'+l+'</span><span class="vp-badge" data-vp-badge="'+s+'" hidden></span></button>').join('')+'</div>'+
      '<div class="vp-sh-foot"><span class="vp-av" data-vp-av>'+esc(c.av)+'</span><b data-vp-client>'+esc(c.name)+'</b></div></div>';

    /* Validator compatibility: the old sidebar id now names the hidden source mirror. */
    const legacy=document.createElement('div');legacy.id='vmsCanonicalPortalSidebar';legacy.hidden=true;

    document.body.prepend(top);
    document.body.append(tab,sheet,legacy);
    paintTheme();

    const deskMore=$('#vpDeskMore'),deskMenu=$('#vpDeskMenu');
    const setDesk=o=>{deskMenu.classList.toggle('open',o);deskMore.setAttribute('aria-expanded',String(o))};
    document.addEventListener('click',e=>{
      const sec=e.target.closest('[data-vp-section]');
      if(sec){e.preventDefault();activate(sec.dataset.vpSection);setDesk(false);if(sheet.open)sheet.close();return}
      if(e.target.closest('#vpDeskMore')){setDesk(!deskMenu.classList.contains('open'));return}
      if(e.target.closest('#vpTabMore')){sheet.showModal();return}
      if(e.target.closest('[data-vp-close]')){sheet.close();return}
      if(e.target.closest('[data-vp-theme]')){toggleTheme();return}
      if(!e.target.closest('.vp-more-wrap'))setDesk(false);
      if(e.target.closest('[data-section-jump]'))setTimeout(sync,0);
    });
    sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')setDesk(false)});

    calmLabels(document.body);
    setTimeout(()=>islands(),150);setTimeout(()=>islands(),1500);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>islands());
    let islT;new MutationObserver(()=>{clearTimeout(islT);islT=setTimeout(()=>islands(),120)}).observe(document.body,{childList:true,subtree:true});
    let calmT;new MutationObserver(m=>{clearTimeout(calmT);calmT=setTimeout(()=>m.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)calmLabels(n);else if(n.parentElement)calmLabels(n.parentElement)})),60)}).observe(document.body,{childList:true,subtree:true});
    sync();
    if(navSource)new MutationObserver(sync).observe(navSource,{subtree:true,childList:true,attributes:true,characterData:true,attributeFilter:['class']});
    if(titleSource)new MutationObserver(sync).observe(titleSource,{subtree:true,childList:true,characterData:true});
    const sc=$('.side-client');if(sc)new MutationObserver(sync).observe(sc,{subtree:true,childList:true,characterData:true});
    new MutationObserver(()=>{clearTimeout(pinTimer);pinTimer=setTimeout(keepCssLast,250)}).observe(document.head,{childList:true});keepCssLast();
    const querySection=String(new URLSearchParams(location.search).get('section')||'').toLowerCase();
    const hashSection=String(location.hash.replace(/^#/,'')||'').toLowerCase();
    const requested=VALID.has(querySection)?querySection:VALID.has(hashSection)?hashSection:pageSection;
    if(requested&&page==='index.html')requestAnimationFrame(()=>{activate(requested)});
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
