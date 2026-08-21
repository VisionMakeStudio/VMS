/* Vision Make Studio — canonical Admin shell.
   One shared sidebar/topbar across every protected Admin tool. */
(()=>{
  if(window.__VMS_ADMIN_SHELL_V2__)return;
  window.__VMS_ADMIN_SHELL_V2__=true;

  const NAV=[
    ['index.html','Home'],
    ['audit.html','VMS Audit'],
    ['qr.html','QR Tools'],
    ['clients.html','Clients'],
    ['service-catalog.html','Service Catalog'],
    ['billing.html','Billing / Subscriptions'],
    ['promotions.html','Promotions'],
    ['projects.html','Projects & Requests'],
    ['files.html','Files & Assets'],
    ['activity.html','Notifications & Activity'],
    ['linkhub.html','VMS LinkHub'],
    ['analytics.html','Analytics'],
    ['leads.html','CRM / Leads'],
    ['marketing.html','Sales Content'],
    ['automations.html','Automations'],
    ['security.html','Security & Access']
  ];

  const normalize=value=>{
    const s=String(value||'').split('?')[0].split('#')[0];
    return (s.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
  };
  const current=normalize(location.pathname);
  const title=(NAV.find(([href])=>normalize(href)===current)||[null,'VMS Admin'])[1];

  function css(){return `
    :root{--vms-admin-sidebar-w:230px;--vms-admin-topbar-h:64px;--vms-admin-gap:24px}
    body.vms-admin-canonical{margin:0!important;padding:calc(var(--vms-admin-topbar-h) + 18px) 20px 40px calc(var(--vms-admin-sidebar-w) + var(--vms-admin-gap))!important;background:#f4f8f9!important;min-height:100vh!important;overflow-x:hidden!important}
    body.vms-admin-canonical *{box-sizing:border-box}
    body.vms-admin-canonical>.app,body.vms-admin-canonical>.shell{display:block!important;min-height:0!important;width:100%!important}
    body.vms-admin-canonical .vms-retired-admin-shell{display:none!important}
    body.vms-admin-canonical>.app>.main,body.vms-admin-canonical>.shell>.main,body.vms-admin-canonical>.main,body.vms-admin-canonical>main.page{margin:0!important;padding:0!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:0!important}
    body.vms-admin-canonical :where(.content){width:min(100%,1500px)!important;max-width:1500px!important;margin:0 auto!important;padding:0!important}
    body.vms-admin-canonical>main.page{width:min(100%,1220px)!important;max-width:1220px!important;margin:0 auto!important}

    #vmsCanonicalAdminSidebar{position:fixed;top:0;bottom:0;left:0;width:var(--vms-admin-sidebar-w);background:#003049;color:#fff;padding:18px 14px 22px;display:flex;flex-direction:column;z-index:2147482001;overflow:auto;box-shadow:10px 0 26px rgba(0,48,73,.06)}
    #vmsCanonicalAdminSidebar .vms-admin-brand{display:flex;align-items:center;gap:11px;padding:0 8px 16px;border-bottom:1px solid rgba(255,255,255,.14)}
    #vmsCanonicalAdminSidebar .vms-admin-brand img{display:block;width:88px;height:44px;object-fit:contain;object-position:left center;flex:0 0 auto}
    #vmsCanonicalAdminSidebar .vms-admin-brand-copy{min-width:0}
    #vmsCanonicalAdminSidebar .vms-admin-brand-copy strong{display:block;font-size:11px;line-height:1.2;white-space:nowrap;color:#fff}
    #vmsCanonicalAdminSidebar .vms-admin-brand-copy span{display:block;margin-top:3px;color:#b4c8d1;font-size:8px;font-weight:900;letter-spacing:.12em}
    #vmsCanonicalAdminSidebar .vms-admin-nav{display:grid;gap:4px;margin-top:16px}
    #vmsCanonicalAdminSidebar .vms-admin-nav a{display:flex;align-items:center;min-height:34px;padding:9px 10px;border-radius:8px;color:#e5eef2;text-decoration:none;font-size:10px;font-weight:800;line-height:1.2;transition:.15s ease}
    #vmsCanonicalAdminSidebar .vms-admin-nav a:hover{background:rgba(255,255,255,.06);color:#fff}
    #vmsCanonicalAdminSidebar .vms-admin-nav a.active{color:#ff7a45;background:rgba(255,255,255,.09)}
    #vmsCanonicalAdminSidebar .vms-admin-foot{margin-top:auto;padding:18px 8px 0;color:#8fb0bf;font-size:8px;line-height:1.55;border-top:1px solid rgba(255,255,255,.1)}
    #vmsCanonicalAdminSidebar .vms-admin-external{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px}
    #vmsCanonicalAdminSidebar .vms-admin-external a{border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:8px 7px;color:#dce9ee;text-decoration:none;text-align:center;font-size:7.5px;font-weight:850}

    #vmsCanonicalAdminTopbar{position:fixed;top:0;right:0;left:var(--vms-admin-sidebar-w);height:var(--vms-admin-topbar-h);z-index:2147482000;background:#fff;border-bottom:1px solid #d8e4e8;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 20px}
    #vmsCanonicalAdminTopbar .vms-admin-top-left{display:flex;align-items:center;gap:9px;min-width:0}
    #vmsCanonicalAdminTopbar .vms-admin-page-title{min-width:0}
    #vmsCanonicalAdminTopbar .vms-admin-page-title small{display:block;color:#8ca0a9;font-size:8px;font-weight:950;letter-spacing:.12em}
    #vmsCanonicalAdminTopbar .vms-admin-page-title strong{display:block;margin-top:3px;color:#08364b;font-size:19px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #vmsCanonicalAdminTopbar .vms-admin-top-actions{display:flex;align-items:center;gap:8px;min-width:0}
    #vmsCanonicalAdminTopbar .vms-admin-top-actions:empty{display:none}
    #vmsCanonicalAdminTopbar .vms-admin-menu-btn{display:none;width:42px;height:42px;padding:0;border:1px solid #d8e4e8;border-radius:9px;background:#fff;color:#003049;font-size:18px;line-height:1;place-items:center}
    #vmsCanonicalAdminBackdrop{display:none;position:fixed;inset:0;background:rgba(0,32,48,.5);z-index:2147481999}

    /* Make page-local headers stop reserving space after they are retired. */
    body.vms-admin-canonical :where(.main,.page){min-width:0!important}
    body.vms-admin-canonical :where(.intro,.overview,.hero):first-child{margin-top:0!important}

    @media(max-width:820px){
      body.vms-admin-canonical{padding:calc(var(--vms-admin-topbar-h) + 14px) 14px 34px!important}
      #vmsCanonicalAdminSidebar{width:min(82vw,280px);transform:translateX(-105%);transition:transform .2s ease}
      #vmsCanonicalAdminSidebar.open{transform:translateX(0)}
      #vmsCanonicalAdminTopbar{left:0;padding:11px 14px}
      #vmsCanonicalAdminTopbar .vms-admin-menu-btn{display:grid}
      #vmsCanonicalAdminBackdrop.show{display:block}
      #vmsCanonicalAdminTopbar .vms-admin-top-actions{max-width:54vw;overflow:auto;scrollbar-width:none}
    }
  `}

  function findOldTopbar(){
    return document.querySelector('body > .app > .main > header.topbar, body > .shell > .main > header.topbar, body > .main > header.topbar, body > header.topbar, body > .app > .main > .topbar, body > .shell > .main > .topbar');
  }
  function retireOldShell(){
    document.querySelectorAll('body > .app > aside.sidebar,body > .shell > aside.sidebar,body > aside.sidebar,body > aside.side,body > .app > aside.side,body > .shell > aside.side').forEach(el=>el.classList.add('vms-retired-admin-shell'));
    const oldTop=findOldTopbar();
    if(oldTop)oldTop.classList.add('vms-retired-admin-shell');
    document.querySelectorAll('body > .drawer-backdrop,body > .app > .drawer-backdrop,body > .shell > .drawer-backdrop').forEach(el=>el.classList.add('vms-retired-admin-shell'));
    return oldTop;
  }

  function extractActions(oldTop){
    if(!oldTop)return null;
    const preferred=oldTop.querySelector('.top-actions,.topbar-actions,.actions,.header-actions');
    if(preferred)return preferred;
    const kids=Array.from(oldTop.children);
    if(kids.length>1)return kids[kids.length-1];
    return null;
  }

  function install(){
    if(document.getElementById('vmsCanonicalAdminSidebar'))return;
    document.body.classList.add('vms-admin-canonical');

    const style=document.createElement('style');
    style.id='vms-canonical-admin-shell-style';
    style.textContent=css();
    document.head.appendChild(style);

    const oldTop=findOldTopbar();
    const actionNode=extractActions(oldTop);
    retireOldShell();

    const aside=document.createElement('aside');
    aside.id='vmsCanonicalAdminSidebar';
    aside.setAttribute('aria-label','VMS Admin tools');
    aside.innerHTML=`
      <div class="vms-admin-brand">
        <img src="/assets/vms-logo.png" alt="Vision Make Studio">
        <div class="vms-admin-brand-copy"><strong>Vision Make Studio</strong><span>ADMIN</span></div>
      </div>
      <nav class="vms-admin-nav">${NAV.map(([href,label])=>`<a href="${href}"${normalize(href)===current?' class="active"':''}>${label}</a>`).join('')}</nav>
      <div class="vms-admin-foot"><div class="vms-admin-external"><a href="../portal/">Client Portal</a><a href="../">Public Website</a></div>Your private command center for clients, work, revenue, services, alerts, and every VMS tool.</div>`;

    const top=document.createElement('header');
    top.id='vmsCanonicalAdminTopbar';
    top.innerHTML=`<div class="vms-admin-top-left"><button class="vms-admin-menu-btn" type="button" aria-label="Open Admin menu" aria-expanded="false">☰</button><div class="vms-admin-page-title"><small>VMS ADMIN</small><strong>${title}</strong></div></div><div class="vms-admin-top-actions"></div>`;
    const actionHost=top.querySelector('.vms-admin-top-actions');
    if(actionNode){
      actionNode.classList.remove('vms-retired-admin-shell');
      actionHost.appendChild(actionNode);
    }

    const shade=document.createElement('div');
    shade.id='vmsCanonicalAdminBackdrop';
    document.body.prepend(shade);
    document.body.prepend(top);
    document.body.prepend(aside);

    const btn=top.querySelector('.vms-admin-menu-btn');
    const close=()=>{aside.classList.remove('open');shade.classList.remove('show');btn.setAttribute('aria-expanded','false')};
    btn.addEventListener('click',()=>{const open=!aside.classList.contains('open');aside.classList.toggle('open',open);shade.classList.toggle('show',open);btn.setAttribute('aria-expanded',String(open))});
    shade.addEventListener('click',close);
    aside.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
