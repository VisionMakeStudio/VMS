(()=>{
  if(!/\/admin\/audit(?:\.html)?$/i.test(location.pathname))return;
  function boot(){
    const style=document.createElement('style');style.id='vms-phase11-audit-desktop-style';style.textContent=`
      @media(min-width:901px){
        .audit-subnav-wrap{display:none!important}
        .side-bottom-dock{position:static!important;bottom:auto!important;z-index:auto!important;margin-top:auto!important}
        .top.phase2-top,.top{position:relative!important;top:auto!important;z-index:4!important}
        .vms-audit-workspace-tabs{display:flex;gap:7px;align-items:center;overflow-x:auto;padding:10px 24px;background:#fff;border-bottom:1px solid #dfe7ea;scrollbar-width:thin}
        .vms-audit-workspace-tabs button{flex:0 0 auto;border:1px solid #dfe7ea;background:#f7f9fa;color:#526a76;border-radius:999px;min-height:36px;padding:0 13px;font:850 11px/1 Inter,system-ui,sans-serif;cursor:pointer}
        .vms-audit-workspace-tabs button.active{background:#003049;border-color:#003049;color:#fff}
      }
      @media(max-width:900px){.vms-audit-workspace-tabs{display:none!important}}
    `;document.head.appendChild(style);
    const top=document.querySelector('.top.phase2-top,.main>.top');if(!top||document.getElementById('vmsAuditWorkspaceTabs'))return;
    const tabs=document.createElement('nav');tabs.id='vmsAuditWorkspaceTabs';tabs.className='vms-audit-workspace-tabs';tabs.setAttribute('aria-label','Audit workspace sections');
    const sections=[['overview','Business Info'],['website','Website'],['google','Google'],['reviews','Reviews'],['systems','Systems'],['report','Client Report']];
    tabs.innerHTML=sections.map(([v,l])=>`<button type="button" data-vms-audit-view="${v}">${l}</button>`).join('');
    top.insertAdjacentElement('afterend',tabs);
    const source=v=>document.querySelector(`.audit-subitem[data-view="${CSS.escape(v)}"],.navbtn[data-view="${CSS.escape(v)}"]`);
    const set=v=>tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.vmsAuditView===v));
    tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-vms-audit-view]');if(!b)return;set(b.dataset.vmsAuditView);const s=source(b.dataset.vmsAuditView);if(s)s.click();else if(typeof window.show==='function')window.show(b.dataset.vmsAuditView)});
    function detect(){for(const [v] of sections){const el=document.getElementById(`view-${v}`)||document.querySelector(`.view[data-view="${v}"]`);if(el&&getComputedStyle(el).display!=='none'&&el.classList.contains('active')){set(v);return}}const a=document.querySelector('.audit-subitem.active[data-view]');if(a)set(a.dataset.view||'overview');else set('overview')}
    const observer=new MutationObserver(()=>requestAnimationFrame(detect));document.querySelectorAll('.view,.audit-subitem').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class','style']}));detect();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
