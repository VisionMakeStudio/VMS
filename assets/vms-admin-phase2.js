/* Vision Make Studio — Final Polish Phase 2: Admin consistency */
(()=>{
  'use strict';
  const path=(location.pathname||'/').toLowerCase();
  if(!path.startsWith('/admin/')||/\/admin\/login(?:\.html)?\/?$/.test(path))return;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const lower=s=>clean(s).toLowerCase();
  const current=(path.split('/').filter(Boolean).pop()||'index.html').toLowerCase();

  const NAV=[
    ['index.html','Home','⌂'],
    ['audit.html','VMS Audit','✦'],
    ['qr.html','QR Tools','▦'],
    ['clients.html','Clients','◎'],
    ['service-catalog.html','Service Catalog','◇'],
    ['billing.html','Billing / Subscriptions','$'],
    ['promotions.html','Promotions','%'],
    ['projects.html','Projects & Requests','✓'],
    ['files.html','Files & Assets','▤'],
    ['activity.html','Notifications & Activity','●'],
    ['linkhub.html','VMS LinkHub','↗'],
    ['analytics.html','Analytics','◫'],
    ['leads.html','CRM / Leads','◉'],
    ['marketing.html','Sales Content','◆'],
    ['automations.html','Automations','⚡'],
    ['security.html','Security & Access','⌾']
  ];
  const alias={
    'dashboard':'home','home':'home','vms audit':'vms audit','audit':'vms audit','qr tools':'qr tools','qr':'qr tools',
    'client directory':'clients','clients':'clients','service catalog':'service catalog','billing':'billing / subscriptions',
    'billing / subscriptions':'billing / subscriptions','billing & subscriptions':'billing / subscriptions','promotions':'promotions',
    'projects & requests':'projects & requests','projects and requests':'projects & requests','files & assets':'files & assets',
    'notifications & activity':'notifications & activity','notifications and activity':'notifications & activity','notifications':'notifications & activity',
    'vms linkhub':'vms linkhub','linkhub':'vms linkhub','analytics':'analytics','crm / leads':'crm / leads','crm/leads':'crm / leads',
    'leads':'crm / leads','sales content':'sales content','marketing':'sales content','automation':'automations','automations':'automations',
    'automation center':'automations','security':'security & access','security & access':'security & access'
  };
  const routeByLabel=new Map(NAV.map(([href,label])=>[lower(label),href]));
  const routeSet=new Set(NAV.map(([href])=>href));

  function adminNavCandidate(nav){
    const txt=lower(nav.textContent);
    let score=0;
    for(const label of ['home','vms audit','qr tools','clients','service catalog','billing','promotions'])if(txt.includes(label))score++;
    return score>=3;
  }

  function canonicalKey(el){
    let text=lower(el.textContent).replace(/[✓→•●⌂✦▦◎◇$%↗◫◉◆⚡⌾]/g,'').trim();
    text=text.replace(/\b(soon|new)\b$/,'').trim();
    if(alias[text])return alias[text];
    const href=(el.getAttribute?.('href')||'').split(/[?#]/)[0].split('/').pop()?.toLowerCase()||'';
    const known=NAV.find(([r])=>r===href);
    return known?lower(known[1]):text;
  }

  function replaceNavContents(nav){
    if(nav.dataset.vmsPhase2Canonical==='1')return;
    const existingItems=$$('a,button',nav);
    const isIconNav=nav.classList.contains('vms-admin-nav')||existingItems.some(x=>x.querySelector?.('.vms-nav-icon'));

    // Preserve legitimate extra Admin destinations not yet in the canonical list.
    const extras=[];
    const seenExtra=new Set();
    existingItems.forEach(el=>{
      const key=canonicalKey(el);
      if(routeByLabel.has(key))return;
      const href=(el.getAttribute?.('href')||'').split(/[?#]/)[0];
      const label=clean(el.textContent);
      if(!href||href==='#'||!label||seenExtra.has(key))return;
      if(/logout|sign out|public website|client portal/i.test(label))return;
      seenExtra.add(key);extras.push([href,label,'']);
    });

    nav.innerHTML='';
    [...NAV,...extras].forEach(([href,label,icon])=>{
      const a=document.createElement('a');
      a.href=href;
      if(isIconNav){
        a.innerHTML=`<span class="vms-nav-icon" aria-hidden="true">${icon||'•'}</span><span>${label}</span>`;
      }else a.textContent=label;
      if(href.toLowerCase()===current){a.classList.add('active');a.setAttribute('aria-current','page')}
      nav.appendChild(a);
    });
    nav.dataset.vmsPhase2Canonical='1';
  }

  function ensureSharedAdminShell(){
    // Most Admin tools already have the approved sidebar. Standalone utilities
    // (notably Security & Access / Automations variants) should inherit the same
    // shell instead of opening as a visually separate page.
    if(document.querySelector('#vms-admin-sidebar,aside.sidebar,aside.side'))return;

    const titleMap=new Map(NAV.map(([href,label])=>[href,label]));
    const pageTitle=titleMap.get(current)||clean(document.querySelector('h1')?.textContent)||'VMS Admin';

    if(!document.getElementById('vms-phase2-shared-shell-style')){
      const st=document.createElement('style');
      st.id='vms-phase2-shared-shell-style';
      st.textContent=`
        body.vms-shared-admin-shell{padding:72px 0 0 236px!important;min-height:100vh!important;overflow-x:hidden!important}
        #vms-admin-sidebar{position:fixed;inset:0 auto 0 0;width:236px;background:linear-gradient(180deg,#003049 0%,#00283d 70%,#06263a 100%);z-index:9998;color:#fff;padding:20px 14px 15px;display:flex;flex-direction:column;box-shadow:12px 0 36px rgba(0,28,45,.08)}
        .vms-admin-brand{display:flex;align-items:center;gap:11px;padding:2px 10px 18px;border-bottom:1px solid rgba(255,255,255,.13)}
        .vms-admin-brand img{width:94px;height:54px;object-fit:contain;object-position:left center;display:block}
        .vms-admin-brand-copy{display:grid;gap:2px}.vms-admin-brand-copy strong{font-size:11px;line-height:1.05}.vms-admin-brand-copy span{font-size:8px;letter-spacing:.16em;color:#9fbdc9;font-weight:900}
        .vms-admin-nav{display:grid;gap:4px;margin-top:15px;overflow:auto}.vms-admin-nav a{color:#d8e6eb;text-decoration:none;border-radius:11px;padding:10px 11px;font-size:11px;font-weight:850;min-height:38px;display:flex;align-items:center;gap:9px}.vms-admin-nav a:hover{background:rgba(255,255,255,.07);color:#fff}.vms-admin-nav a.active{color:#ff7a45;background:rgba(255,255,255,.10)}
        .vms-nav-icon{width:21px;text-align:center;opacity:.9;font-size:12px}.vms-admin-foot{margin-top:auto;border-top:1px solid rgba(255,255,255,.12);padding:13px 9px 2px;display:grid;gap:8px}.vms-admin-foot a{color:#a7c0cb;text-decoration:none;font-size:9px;font-weight:800}.vms-admin-foot small{color:#7897a5;line-height:1.45;font-size:7.5px}
        #vms-admin-topbar{position:fixed;top:0;right:0;left:236px;height:72px;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);border-bottom:1px solid #dce7eb;z-index:9997;display:flex;align-items:center;justify-content:space-between;padding:0 24px;gap:15px}
        .vms-admin-top-left{display:flex;align-items:center;gap:11px;min-width:0}.vms-admin-menu{display:none;width:44px;height:44px;border:1px solid #d6e2e7;background:#fff;color:#003049;border-radius:12px;font-size:19px;font-weight:900}.vms-admin-page-title small{display:block;color:#8b9da6;font-size:8px;font-weight:950;letter-spacing:.14em}.vms-admin-page-title strong{display:block;color:#003049;font-size:20px;line-height:1.1;margin-top:3px}.vms-admin-top-actions{display:flex;align-items:center;gap:8px}.vms-shell-btn{height:39px;border:1px solid #d6e2e7;border-radius:10px;background:#fff;color:#003049;padding:0 12px;font-weight:900;font-size:10px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.vms-shell-btn.primary{background:#003049;border-color:#003049;color:#fff}
        #vms-admin-backdrop{display:none;position:fixed;inset:0;background:rgba(0,28,45,.48);z-index:9996}
        body.vms-shared-admin-shell>main,body.vms-shared-admin-shell>.page{max-width:none!important;margin-left:0!important;margin-right:0!important}
        @media(max-width:820px){body.vms-shared-admin-shell{padding:70px 0 0!important}#vms-admin-sidebar{width:min(82vw,340px);transform:translateX(-105%);transition:transform .24s ease}body.vms-admin-drawer-open #vms-admin-sidebar{transform:translateX(0)}body.vms-admin-drawer-open #vms-admin-backdrop{display:block}#vms-admin-topbar{left:0;height:70px;padding:0 16px}.vms-admin-menu{display:grid;place-items:center}.vms-admin-page-title strong{font-size:18px}.vms-admin-top-actions .desktop-only-shell{display:none}}
      `;
      document.head.appendChild(st);
    }

    const aside=document.createElement('aside');
    aside.id='vms-admin-sidebar';
    aside.innerHTML=`<div class="vms-admin-brand"><img src="../assets/vms-logo.png" alt="Vision Make Studio"><div class="vms-admin-brand-copy"><strong>Vision Make Studio</strong><span>ADMIN</span></div></div><nav class="vms-admin-nav">${NAV.map(([href,label,icon])=>`<a href="${href}" class="${current===href.toLowerCase()?'active':''}"><span class="vms-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('')}</nav><div class="vms-admin-foot"><a href="../portal/">Client Portal</a><a href="../index.html">Public Website</a><small>VMS Admin · Private workspace<br>info@visionmakestudio.com</small></div>`;

    const header=document.createElement('header');
    header.id='vms-admin-topbar';
    header.innerHTML=`<div class="vms-admin-top-left"><button class="vms-admin-menu" type="button" aria-label="Open admin menu">☰</button><div class="vms-admin-page-title"><small>VMS ADMIN</small><strong>${pageTitle}</strong></div></div><div class="vms-admin-top-actions"><a class="vms-shell-btn desktop-only-shell" href="../portal/">Client Portal</a><a class="vms-shell-btn primary" href="../index.html">View Site</a></div>`;
    const backdrop=document.createElement('div');backdrop.id='vms-admin-backdrop';
    document.body.prepend(backdrop,header,aside);
    document.body.classList.add('vms-shared-admin-shell');

    const close=()=>document.body.classList.remove('vms-admin-drawer-open');
    header.querySelector('.vms-admin-menu')?.addEventListener('click',()=>document.body.classList.toggle('vms-admin-drawer-open'));
    backdrop.addEventListener('click',close);
    aside.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  }

  function canonicalizeAdminNavigation(){
    const navs=$$('aside nav,aside .nav,.vms-admin-nav').filter(adminNavCandidate);
    if(!navs.length)return;

    // If an injected canonical sidebar exists, retire any old page-specific sidebar
    // that would otherwise display a second Admin menu beside it.
    const canonicalSidebar=$('#vms-admin-sidebar');
    if(canonicalSidebar){
      $$('aside').forEach(aside=>{
        if(aside===canonicalSidebar)return;
        const nav=$('nav,.nav',aside);
        if(nav&&adminNavCandidate(nav))aside.classList.add('vms-retired-admin-sidebar');
      });
    }

    const target=canonicalSidebar?.querySelector('nav,.vms-admin-nav')||navs[0];
    replaceNavContents(target);

    // If the page does not use an injected shell, clean its single native menu too.
    if(!canonicalSidebar)navs.forEach(replaceNavContents);
  }

  function dropdown(trigger,items,{align='right'}={}){
    const wrap=document.createElement('span');wrap.className='vms-phase2-menu-wrap';
    const menu=document.createElement('div');menu.className='vms-phase2-action-menu';menu.dataset.align=align;
    items.forEach(({label,action,danger})=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;if(danger)b.classList.add('danger');b.addEventListener('click',e=>{e.stopPropagation();wrap.classList.remove('open');action?.()});menu.appendChild(b);
    });
    trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();$$('.vms-phase2-menu-wrap.open').forEach(x=>{if(x!==wrap)x.classList.remove('open')});wrap.classList.toggle('open')});
    wrap.append(trigger,menu);document.addEventListener('click',()=>wrap.classList.remove('open'));return wrap;
  }

  function enhanceNotificationActivity(){
    if(!/(activity|notification)/.test(current))return;
    const select=$('#desktopSelectBtn');
    const filter=$('#filterBtn');
    if(select&&filter&&select.dataset.vmsPhase2!=='1'){
      select.dataset.vmsPhase2='1';select.textContent='Select All';
      filter.insertAdjacentElement('afterend',select);
      const original=select.onclick;
      select.onclick=e=>{
        original?.call(select,e);
        requestAnimationFrame(()=>{
          const bulk=$('#bulkSelectAllBtn');
          if(bulk&&/select all/i.test(clean(bulk.textContent)))bulk.click();
        });
      };
    }

    const bar=$('#bulkBar'),actions=bar?.querySelector('.bulk-actions');
    if(actions&&!$('#vmsPhase2BulkActions',actions)){
      const read=$('#bulkReadBtn'),unread=$('#bulkUnreadBtn'),del=$('#bulkDeleteBtn'),cancel=$('#bulkCancelBtn'),selectAll=$('#bulkSelectAllBtn');
      [read,unread,del,cancel,selectAll].forEach(x=>{if(x)x.classList.add('vms-phase2-original-action')});
      const trigger=document.createElement('button');trigger.id='vmsPhase2BulkActions';trigger.type='button';trigger.className='btn vms-phase2-bulk-trigger';trigger.textContent='⋯ Bulk Actions';
      const items=[];
      if(read)items.push({label:'Mark Read',action:()=>read.click()});
      if(unread)items.push({label:'Mark Unread',action:()=>unread.click()});
      if(del)items.push({label:'Delete',danger:true,action:()=>del.click()});
      if(cancel)items.push({label:'Clear Selection',action:()=>cancel.click()});
      actions.appendChild(dropdown(trigger,items));
    }
  }

  function replaceShortText(from,to){
    $$('h1,h2,h3,h4,strong,.panel-head-left strong,.topbar-left strong').forEach(el=>{if(lower(el.textContent)===lower(from))el.textContent=to});
  }

  function enhanceScheduling(){
    const pageText=lower(document.title+' '+($('.topbar-left strong')?.textContent||'')+' '+($('h1')?.textContent||''));
    if(!/(scheduling|schedule|appointments)/.test(pageText)&&!/(schedule|scheduling)/.test(current))return;
    replaceShortText('Jobs','Appointments & Scheduled Work');
    replaceShortText('Scheduled Jobs','Appointments & Scheduled Work');

    const actionLabels=/^(edit|reschedule|cancel|delete|delete permanently)$/i;
    $$('.row-actions,.action-cell,td:last-child,[class*="row"] .actions').forEach(group=>{
      if(group.dataset.vmsPhase2Menu==='1')return;
      const originals=$$('button',group).filter(b=>actionLabels.test(clean(b.textContent)));
      if(originals.length<2)return;
      group.dataset.vmsPhase2Menu='1';
      const trigger=document.createElement('button');trigger.type='button';trigger.className='vms-kebab';trigger.setAttribute('aria-label','Appointment actions');trigger.textContent='⋯';
      const items=originals.map(old=>({label:clean(old.textContent),danger:/cancel|delete/i.test(old.textContent),action:()=>old.click()}));
      originals.forEach(b=>b.classList.add('vms-phase2-original-action'));
      group.appendChild(dropdown(trigger,items));
    });
  }

  function enhanceGenericRowActions(){
    // Keep dense data-table rows clean without changing page-level action bars.
    $$('.row-actions,.action-cell').forEach(group=>{
      if(group.dataset.vmsPhase2Menu==='1')return;
      const originals=$$('button',group).filter(b=>!b.classList.contains('action-dots')&&!b.classList.contains('vms-kebab')&&!b.hidden);
      if(originals.length<3)return;
      const labels=originals.map(b=>clean(b.textContent));
      if(labels.some(x=>/^(save|add|new|filter|search)$/i.test(x)))return;
      group.dataset.vmsPhase2Menu='1';
      const trigger=document.createElement('button');trigger.type='button';trigger.className='vms-kebab';trigger.setAttribute('aria-label','Actions');trigger.textContent='⋯';
      const items=originals.map(old=>({label:clean(old.textContent)||'Action',danger:/delete|archive|cancel|remove/i.test(old.textContent),action:()=>old.click()}));
      originals.forEach(b=>b.classList.add('vms-phase2-original-action'));
      group.appendChild(dropdown(trigger,items));
    });
  }

  function alignPageActions(){
    // Small, targeted polish requested during Admin QA.
    $$('a,button').forEach(el=>{
      const t=lower(el.textContent);
      if(t==='view public services')el.classList.add('vms-view-public-services');
      if(t.includes('new promotion'))el.classList.add('vms-new-promotion-action');
    });
  }

  function boot(){
    document.documentElement.classList.add('vms-phase2-admin');
    const pageSlug=current.replace(/\.html?$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'index';
    document.documentElement.classList.add(`vms-page-${pageSlug}`);
    ensureSharedAdminShell();
    canonicalizeAdminNavigation();
    enhanceNotificationActivity();
    enhanceScheduling();
    enhanceGenericRowActions();
    alignPageActions();

    let timer;
    const mo=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{ensureSharedAdminShell();canonicalizeAdminNavigation();enhanceNotificationActivity();enhanceScheduling();enhanceGenericRowActions();alignPageActions()},80)});
    mo.observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
