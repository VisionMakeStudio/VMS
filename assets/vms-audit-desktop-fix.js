(()=>{
  'use strict';
  if(!/\/admin\/audit(?:\.html)?\/?$/i.test(location.pathname))return;
  if(window.__VMS_AUDIT_DESKTOP_PHASE3__)return;
  window.__VMS_AUDIT_DESKTOP_PHASE3__=true;
  if(document.documentElement.dataset.vmsShell==='v2')return; /* Admin v2 Audit page has its own layout. */

  const DESKTOP='(min-width:901px)';
  const sections=[
    ['overview','Business Info'],
    ['website','Website'],
    ['google','Local Presence'],
    ['reviews','Reviews'],
    ['systems','Systems'],
    ['report','Client Report']
  ];

  function activeView(){
    const dashboard=document.getElementById('view-dashboard');
    if(dashboard?.classList.contains('active') && getComputedStyle(dashboard).display!=='none')return 'dashboard';
    const history=document.body.classList.contains('phase3-history-mode');
    if(history)return 'history';
    for(const [name] of sections){
      const el=document.getElementById(`view-${name}`)||document.querySelector(`.view[data-view="${name}"]`);
      if(el?.classList.contains('active') && getComputedStyle(el).display!=='none')return name;
    }
    const active=document.querySelector('.audit-subitem.active[data-view],.navbtn.active[data-view]');
    return active?.dataset?.view||'dashboard';
  }

  function sourceFor(view){
    const escaped=(window.CSS&&CSS.escape)?CSS.escape(view):view.replace(/[^a-z0-9_-]/gi,'');
    return document.querySelector(`.audit-subitem[data-view="${escaped}"],.navbtn[data-view="${escaped}"]`);
  }

  function ensureStyle(){
    if(document.getElementById('vms-phase3-audit-desktop-style'))return;
    const style=document.createElement('style');
    style.id='vms-phase3-audit-desktop-style';
    style.textContent=`
      @media(min-width:901px){
        body.vms-admin-canonical[data-vms-admin-route="audit"]>.app{display:block!important;width:100%!important;max-width:none!important}
        body.vms-admin-canonical[data-vms-admin-route="audit"]>.app>.side{display:none!important}
        body.vms-admin-canonical[data-vms-admin-route="audit"]>.app>.main{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important}
        body.vms-admin-canonical[data-vms-admin-route="audit"]>.app>.main>.content{width:min(100%,1440px)!important;max-width:1440px!important;margin:0 auto!important;min-width:0!important}
        .audit-subnav-wrap{display:none!important}
        .side-bottom-dock{position:static!important;bottom:auto!important;z-index:auto!important;margin-top:auto!important}
        .top.phase2-top,.top{position:relative!important;top:auto!important;z-index:4!important}
        .vms-audit-workspace-tabs{display:flex;gap:8px;align-items:center;overflow-x:auto;padding:10px 0 12px;background:transparent;scrollbar-width:none}
        .vms-audit-workspace-tabs::-webkit-scrollbar{display:none}
        .vms-audit-workspace-tabs button{flex:0 0 auto;border:1px solid #dfe7ea;background:#fff;color:#526a76;border-radius:999px;min-height:38px;padding:0 14px;font:850 11px/1 Inter,system-ui,sans-serif;cursor:pointer}
        .vms-audit-workspace-tabs button:hover{border-color:#b9ccd5;background:#f8fafb;color:#003049}
        .vms-audit-workspace-tabs button.active{background:#003049;border-color:#003049;color:#fff}
        body.vms-audit-dashboard-mode .vms-audit-workspace-tabs,
        body.vms-audit-dashboard-mode .top.phase2-top,
        body.vms-audit-dashboard-mode .mobile-nav.phase2-tabs{display:none!important}
      }
      @media(max-width:900px){.vms-audit-workspace-tabs{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureTabs(){
    let tabs=document.getElementById('vmsAuditWorkspaceTabs');
    if(tabs)return tabs;
    const main=document.querySelector('.app>.main,.main');
    const top=document.querySelector('.top.phase2-top,.main>.top');
    if(!main)return null;
    tabs=document.createElement('nav');
    tabs.id='vmsAuditWorkspaceTabs';
    tabs.className='vms-audit-workspace-tabs';
    tabs.setAttribute('aria-label','Audit workspace sections');
    tabs.innerHTML=sections.map(([view,label])=>`<button type="button" data-vms-audit-view="${view}">${label}</button>`).join('');
    if(top)top.insertAdjacentElement('afterend',tabs);
    else main.prepend(tabs);
    tabs.addEventListener('click',event=>{
      const button=event.target.closest('button[data-vms-audit-view]');
      if(!button)return;
      const view=button.dataset.vmsAuditView;
      const source=sourceFor(view);
      if(source)source.click();
      else if(typeof window.show==='function')window.show(view);
      requestAnimationFrame(sync);
    });
    return tabs;
  }

  function sync(){
    const view=activeView();
    const dashboard=view==='dashboard';
    document.body.classList.toggle('vms-audit-dashboard-mode',dashboard);
    document.body.classList.toggle('vms-audit-workspace-mode',!dashboard&&view!=='history');
    const tabs=document.getElementById('vmsAuditWorkspaceTabs');
    if(tabs){
      tabs.hidden=dashboard||view==='history'||!matchMedia(DESKTOP).matches;
      tabs.querySelectorAll('button[data-vms-audit-view]').forEach(button=>{
        const current=button.dataset.vmsAuditView===view;
        button.classList.toggle('active',current);
        if(current)button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      });
    }
  }

  function boot(){
    ensureStyle();
    ensureTabs();
    sync();
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;sync()});
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','style'],childList:true});
    addEventListener('resize',sync,{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
