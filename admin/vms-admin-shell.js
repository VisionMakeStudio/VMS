(function(){
  var MOBILE_MAX=900;

  function currentPage(){
    var parts=(location.pathname||'').split('/').filter(Boolean);
    var p=(parts.pop()||'index.html').toLowerCase();

    /* Netlify may serve clean URLs such as /admin/audit instead of audit.html. */
    if(p==='admin' || !p)return 'index.html';
    if(!p.includes('.'))p+='.html';

    return p;
  }

  function pageTitle(){
    var titles={
      'index.html':'Dashboard',
      'audit.html':'VMS Audit',
      'qr.html':'QR Tools',
      'clients.html':'Client Directory',
      'service-catalog.html':'Service Catalog',
      'billing.html':'Billing & Subscriptions',
      'promotions.html':'Promotions',
      'projects.html':'Projects & Requests',
      'files.html':'Files & Assets',
      'activity.html':'Notifications & Activity',
      'linkhub.html':'VMS LinkHub'
    };
    return titles[currentPage()]||'VMS Admin';
  }

  function markPageClass(){
    if(!document.body)return;
    var page=currentPage().replace(/\.html$/,'').replace(/[^a-z0-9-]/g,'-');
    document.body.classList.add('vms-page-'+page);
  }

  function getMenuButton(){
    return document.getElementById('mobileMenuBtn') ||
      document.getElementById('vmsMobileMenuBtn') ||
      document.querySelector('.vms-mobile-menu-btn,[data-vms-menu-toggle]');
  }

  function installStyle(id,css){
    if(document.getElementById(id))return;
    var style=document.createElement('style');
    style.id=id;
    style.textContent=css;
    document.head.appendChild(style);
  }

  function refineBillingPage(){
    if(currentPage()!=='billing.html')return;

    installStyle('vms-billing-mobile-refinements',`
      /* Billing refinement: keep MRR primary; service mix is supporting information. */
      @media(max-width:760px){
        .mrr-feature{
          grid-template-columns:minmax(0,1fr) 66px!important;
          column-gap:10px!important;
          min-height:118px!important;
          padding:15px 16px!important;
          align-items:center!important;
        }
        .mrr-feature .mrr-copy{padding-right:0!important}
        .mrr-feature .mrr-copy>strong#statMrr{
          font-size:38px!important;
          line-height:.98!important;
        }
        .mrr-chart-wrap{
          width:66px!important;
          justify-self:end!important;
          gap:3px!important;
        }
        .mrr-feature .donut{
          width:60px!important;
          height:60px!important;
          box-shadow:inset 0 0 0 1px rgba(0,48,73,.045)!important;
        }
        .mrr-feature .donut-hole{
          width:38px!important;
          height:38px!important;
          box-shadow:0 1px 6px rgba(0,48,73,.045)!important;
        }
        .mrr-feature .donut-hole strong{
          font-size:13px!important;
          line-height:1!important;
        }
        .mrr-feature .donut-hole span{
          font-size:5px!important;
          line-height:1!important;
          margin-top:2px!important;
          letter-spacing:.045em!important;
        }
      }
    `);

    var strip=document.getElementById('attentionStrip');
    var count=document.getElementById('statAttention');
    if(!strip||!count)return;

    function syncAttentionStrip(){
      var issueCount=parseInt(String(count.textContent||'0').replace(/[^0-9-]/g,''),10)||0;
      strip.style.setProperty('display',issueCount>0?'flex':'none','important');
      strip.setAttribute('aria-hidden',issueCount>0?'false':'true');
    }

    syncAttentionStrip();

    if(count.dataset.vmsAttentionObserver!=='1'){
      count.dataset.vmsAttentionObserver='1';
      new MutationObserver(syncAttentionStrip).observe(count,{childList:true,characterData:true,subtree:true});
    }
  }

  function refineLinkHubPage(){
    if(currentPage()!=='linkhub.html')return;

    installStyle('vms-linkhub-modern-phone',`
      /* Newer iPhone-inspired LinkHub preview: Dynamic Island, thinner bezel, cleaner frame. */
      .manage-preview .phone-wrap{
        width:min(100%,304px)!important;
        margin:0 auto!important;
        padding:12px!important;
        background:transparent!important;
        border-radius:0!important;
        box-shadow:none!important;
      }
      .manage-preview .phone{
        position:relative!important;
        width:100%!important;
        aspect-ratio:9/19.5!important;
        min-height:0!important;
        padding:5px!important;
        overflow:hidden!important;
        border:3px solid #27343b!important;
        border-radius:42px!important;
        background:#0a1014!important;
        box-shadow:
          0 24px 54px rgba(0,35,52,.20),
          0 7px 16px rgba(0,35,52,.12),
          inset 0 0 0 1px rgba(255,255,255,.42)!important;
      }
      .manage-preview .phone::before{
        content:"";
        position:absolute;
        inset:2px;
        z-index:2;
        border-radius:38px;
        border:1px solid rgba(255,255,255,.18);
        pointer-events:none;
      }
      .manage-preview .phone-notch{
        position:absolute!important;
        top:15px!important;
        left:50%!important;
        transform:translateX(-50%)!important;
        z-index:30!important;
        width:82px!important;
        height:23px!important;
        margin:0!important;
        border-radius:999px!important;
        background:#05080a!important;
        box-shadow:0 1px 2px rgba(255,255,255,.05),0 2px 8px rgba(0,0,0,.26)!important;
      }
      .manage-preview .phone-notch::after{
        content:"";
        position:absolute;
        right:12px;
        top:9px;
        width:6px;
        height:6px;
        border-radius:50%;
        background:#102a44;
        box-shadow:inset 0 0 0 1px rgba(71,110,147,.45),0 0 3px rgba(44,92,138,.35);
      }
      .manage-preview .public-page{
        width:100%!important;
        height:100%!important;
        min-height:0!important;
        padding:64px 18px 24px!important;
        border-radius:36px!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        scrollbar-width:none;
      }
      .manage-preview .public-page::-webkit-scrollbar{display:none}
      .manage-preview .preview-label{
        margin-top:10px!important;
        font-size:10px!important;
        color:#83959e!important;
      }

      @media(max-width:760px){
        .manage-preview .phone-wrap{
          width:min(100%,274px)!important;
          padding:8px 6px 10px!important;
        }
        .manage-preview .phone{
          border-width:3px!important;
          border-radius:38px!important;
        }
        .manage-preview .phone::before{border-radius:34px!important}
        .manage-preview .phone-notch{
          top:13px!important;
          width:76px!important;
          height:22px!important;
        }
        .manage-preview .phone-notch::after{
          right:11px;
          top:8.5px;
          width:6px;
          height:6px;
        }
        .manage-preview .public-page{
          padding:58px 17px 22px!important;
          border-radius:32px!important;
        }
      }
    `);
  }

  function normalizeMobileHeader(){
    if(window.innerWidth>MOBILE_MAX)return;
    if(currentPage()==='login.html')return;

    var main=document.querySelector('main.main,.main');
    if(!main)return;

    var btn=getMenuButton();
    var topbar=main.querySelector(':scope > .topbar');

    /*
      QR Tools and Clients already have a normal title topbar, but their
      hamburger lived inside a separate logo strip. Move that same button
      into the title topbar so all of its existing click behavior/identity
      remains intact.
    */
    if(topbar){
      topbar.classList.add('vms-standard-topbar');

      var directFirst=topbar.firstElementChild;
      var buttonAlreadyInside=btn && topbar.contains(btn);

      if(!buttonAlreadyInside && btn){
        var leftWrap=document.createElement('div');
        leftWrap.className='vms-standard-left';

        if(directFirst){
          topbar.insertBefore(leftWrap,directFirst);
          leftWrap.appendChild(btn);
          leftWrap.appendChild(directFirst);
        }else{
          topbar.appendChild(leftWrap);
          leftWrap.appendChild(btn);
        }
      }else if(btn){
        var existingWrap=btn.parentElement;
        if(existingWrap)existingWrap.classList.add('vms-standard-left');
      }

      var titleNode=topbar.querySelector('.topbar-left,.title-copy');
      if(titleNode)titleNode.classList.add('vms-standard-title');

      return;
    }

    /*
      Audit does not have the same Admin title topbar; its existing .top
      belongs to the audit workflow itself. Add one Promotions-style Admin
      header above the workflow instead of altering the workflow controls.
    */
    if(currentPage()==='audit.html'){
      var injected=document.createElement('header');
      injected.className='topbar vms-standard-topbar vms-injected-topbar';

      var left=document.createElement('div');
      left.className='vms-standard-left';

      if(btn)left.appendChild(btn);

      var title=document.createElement('div');
      title.className='vms-standard-title';
      title.innerHTML='<small>VMS ADMIN</small><strong>'+pageTitle()+'</strong>';
      left.appendChild(title);
      injected.appendChild(left);

      main.insertBefore(injected,main.firstChild);
    }
  }

  function bindSidebar(){
    var sidebar=document.querySelector('aside.sidebar,aside.side');
    if(!sidebar)return;

    sidebar.classList.add('sidebar');
    sidebar.id=sidebar.id||'sidebar';

    var buttons=Array.from(document.querySelectorAll(
      '#mobileMenuBtn,#vmsMobileMenuBtn,.vms-mobile-menu-btn,[data-vms-menu-toggle]'
    ));

    var backdrop=document.getElementById('drawerBackdrop') ||
      document.querySelector('.drawer-backdrop');

    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.id='drawerBackdrop';
      backdrop.className='drawer-backdrop';
      backdrop.setAttribute('aria-hidden','true');
      document.body.appendChild(backdrop);
    }

    function isOpen(){
      return sidebar.classList.contains('open');
    }

    function setMenu(open){
      sidebar.classList.toggle('open',open);

      buttons.forEach(function(btn){
        btn.setAttribute('aria-expanded',open?'true':'false');
      });

      backdrop.classList.toggle('show',open);
      backdrop.setAttribute('aria-hidden',open?'false':'true');
      document.body.classList.toggle('menu-open',open);
    }

    buttons.forEach(function(btn){
      if(btn.dataset.vmsShellBound==='1')return;
      btn.dataset.vmsShellBound='1';

      btn.addEventListener('click',function(e){
        if(window.innerWidth>MOBILE_MAX)return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setMenu(!isOpen());
      },true);
    });

    if(backdrop.dataset.vmsShellBound!=='1'){
      backdrop.dataset.vmsShellBound='1';

      backdrop.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setMenu(false);
      },true);
    }

    sidebar.querySelectorAll('a').forEach(function(link){
      if(link.dataset.vmsShellCloseBound==='1')return;
      link.dataset.vmsShellCloseBound='1';
      link.addEventListener('click',function(){
        if(window.innerWidth<=MOBILE_MAX)setMenu(false);
      });
    });

    document.addEventListener('keydown',function(e){
      if(e.key==='Escape')setMenu(false);
    });

    window.addEventListener('resize',function(){
      if(window.innerWidth>MOBILE_MAX)setMenu(false);
    });

    if(window.innerWidth<=MOBILE_MAX)setMenu(false);
  }

  function start(){
    markPageClass();
    normalizeMobileHeader();
    bindSidebar();
    refineBillingPage();
    refineLinkHubPage();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start);
  }else{
    start();
  }
})();

/* ============================================================
   VMS PHASE 3 — ADMIN LIVE BILLING LEDGER
   Reads real Supabase Stripe records; preserves manual/POS tools below.
   ============================================================ */
(function(){
  function page(){
    var p=(location.pathname||'').split('/').filter(Boolean).pop()||'index.html';
    if(!p.includes('.'))p+='.html';return p.toLowerCase();
  }
  if(page()!=='billing.html'||window.__VMS_PHASE3_ADMIN_BILLING__)return;
  window.__VMS_PHASE3_ADMIN_BILLING__=true;

  var running=false;
  var lastLoad=0;
  function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(v,currency){var n=Number(v)||0;try{return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'USD').toUpperCase(),minimumFractionDigits:2}).format(n)}catch(e){return '$'+n.toFixed(2)}}
  function date(v){if(!v)return '—';var d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
  function statusLabel(v){var s=String(v||'').replace(/_/g,' ');return s?s.replace(/\b\w/g,function(c){return c.toUpperCase()}):'Unknown'}
  function tone(v){var s=String(v||'').toLowerCase();if(['active','trialing','paid','complete','completed'].includes(s))return 'green';if(['past_due','unpaid','incomplete','failed'].includes(s))return 'red';if(['open','pending','paused'].includes(s))return 'orange';return 'muted'}

  function install(){
    if(document.getElementById('vms-phase3-admin-billing-style'))return;
    var st=document.createElement('style');st.id='vms-phase3-admin-billing-style';st.textContent=`
      body.vms-phase3-billing .content>.stats,
      body.vms-phase3-billing .content>.revenue-strip,
      body.vms-phase3-billing #attentionStrip{display:none!important}
      #vmsPhase3AdminBilling{margin:0 0 18px}
      #vmsPhase3AdminBilling .p3-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
      #vmsPhase3AdminBilling .p3-head h2{margin:0;color:#173443;font-size:21px;letter-spacing:-.03em}
      #vmsPhase3AdminBilling .p3-head p{margin:5px 0 0;color:#738791;font-size:11px;line-height:1.5}
      #vmsPhase3AdminBilling .p3-provider{display:inline-flex;align-items:center;gap:6px;border:1px solid #dbe5e9;border-radius:999px;background:#fff;padding:7px 10px;color:#55717e;font-size:10px;font-weight:800;white-space:nowrap}
      #vmsPhase3AdminBilling .p3-provider:before{content:"";width:7px;height:7px;border-radius:50%;background:#669BBC}
      #vmsPhase3AdminBilling .p3-provider.live:before{background:#2b8c69}
      #vmsPhase3AdminBilling .p3-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
      #vmsPhase3AdminBilling .p3-metric{border:1px solid #dfe7ea;border-radius:16px;background:#fff;padding:15px;box-shadow:0 8px 24px rgba(0,48,73,.045)}
      #vmsPhase3AdminBilling .p3-metric span{display:block;color:#81949d;font-size:9px;font-weight:850;letter-spacing:.05em}
      #vmsPhase3AdminBilling .p3-metric strong{display:block;margin-top:7px;color:#173443;font-size:25px;line-height:1;letter-spacing:-.04em}
      #vmsPhase3AdminBilling .p3-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:12px;align-items:start}
      #vmsPhase3AdminBilling .p3-card{border:1px solid #dfe7ea;border-radius:16px;background:#fff;padding:15px;box-shadow:0 8px 24px rgba(0,48,73,.04)}
      #vmsPhase3AdminBilling .p3-card+.p3-card{margin-top:12px}
      #vmsPhase3AdminBilling .p3-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
      #vmsPhase3AdminBilling .p3-card-head strong{color:#173443;font-size:13px}.p3-card-head span{color:#7a8d96;font-size:9px}
      #vmsPhase3AdminBilling .p3-list{display:grid;gap:7px}
      #vmsPhase3AdminBilling .p3-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #e5ecef;border-radius:12px;background:#fbfcfd}
      #vmsPhase3AdminBilling .p3-row strong{display:block;color:#173443;font-size:11px}.p3-row small{display:block;margin-top:3px;color:#7c9099;font-size:9px;line-height:1.4}
      #vmsPhase3AdminBilling .p3-right{text-align:right;white-space:nowrap}.p3-right b{display:block;color:#173443;font-size:11px}.p3-right a{font-size:9px;color:#003049;font-weight:800;text-decoration:none}
      #vmsPhase3AdminBilling .p3-badge{display:inline-flex;border-radius:999px;padding:5px 7px;font-size:8px;font-weight:850;background:#edf5f8;color:#3f7894;margin-left:5px}.p3-badge.green{background:#edf7f3;color:#2b8c69}.p3-badge.red{background:#fbeff0;color:#b13a43}.p3-badge.orange{background:#fff5e8;color:#a9651d}.p3-badge.muted{background:#f1f3f4;color:#74858d}
      #vmsPhase3AdminBilling .p3-empty{padding:18px;border:1px dashed #cbd9df;border-radius:12px;text-align:center;color:#7d919a;font-size:10px;line-height:1.5;background:#fafcfd}
      #vmsPhase3AdminBilling .p3-note{margin-top:10px;padding:10px 12px;border:1px solid #dfe7ea;border-radius:12px;background:#f6f9fa;color:#71858f;font-size:9px;line-height:1.5}
      .vms-phase3-manual-label{margin:18px 0 10px;padding-top:16px;border-top:1px solid #dfe7ea}.vms-phase3-manual-label strong{display:block;color:#173443;font-size:14px}.vms-phase3-manual-label span{display:block;margin-top:4px;color:#7a8d96;font-size:10px;line-height:1.45}
      @media(max-width:900px){#vmsPhase3AdminBilling .p3-metrics{grid-template-columns:1fr 1fr}#vmsPhase3AdminBilling .p3-grid{grid-template-columns:1fr}#vmsPhase3AdminBilling .p3-head{flex-direction:column}#vmsPhase3AdminBilling .p3-metric{padding:13px}#vmsPhase3AdminBilling .p3-metric strong{font-size:22px}}
      @media(max-width:520px){#vmsPhase3AdminBilling .p3-row{grid-template-columns:1fr}#vmsPhase3AdminBilling .p3-right{text-align:left}.p3-right a{display:inline-block;margin-top:4px}}
    `;document.head.appendChild(st);
  }

  async function getSb(){
    if(!window.VMSAuth?.client)return null;
    try{var sb=await VMSAuth.client();var s=await sb.auth.getSession();if(!s?.data?.session)return null;return sb}catch(e){return null}
  }

  function addManualLabel(content){
    if(document.getElementById('vmsPhase3ManualLabel'))return;
    var tabs=content.querySelector('.tabs');if(!tabs)return;
    var el=document.createElement('div');el.id='vmsPhase3ManualLabel';el.className='vms-phase3-manual-label';el.innerHTML='<strong>Manual / VMS Billing Tools</strong><span>Use the tools below for cash, Zelle, manual invoices, notes, and legacy entries. Stripe payments above are synced automatically.</span>';
    tabs.parentNode.insertBefore(el,tabs);
  }

  async function refresh(force){
    if(running)return;if(!force&&Date.now()-lastLoad<10000)return;running=true;
    try{
      var sb=await getSb();if(!sb)return;
      var content=document.querySelector('.content');if(!content)return;
      var results=await Promise.all([
        sb.from('clients').select('id,business_name,owner_email'),
        sb.from('billing_subscriptions').select('*').order('updated_at',{ascending:false}),
        sb.from('billing_invoices').select('*').order('created_at',{ascending:false}).limit(50),
        sb.from('billing_checkout_sessions').select('*').order('created_at',{ascending:false}).limit(20),
        sb.from('billing_customers').select('*')
      ]);
      for(var r of results){if(r.error)throw r.error}
      var clients=results[0].data||[],subs=(results[1].data||[]).filter(function(x){return x.provider==='stripe'}),invoices=(results[2].data||[]).filter(function(x){return x.provider==='stripe'}),checkouts=results[3].data||[],customers=(results[4].data||[]).filter(function(x){return x.provider==='stripe'});
      var cmap=new Map(clients.map(function(c){return [c.id,c]}));
      var active=subs.filter(function(s){return ['active','trialing'].includes(String(s.status||'').toLowerCase())});
      var mrr=active.reduce(function(sum,s){var a=Number(s.amount)||0;return sum+(/annual|year/i.test(String(s.cadence||''))?a/12:a)},0);
      var pastDue=subs.filter(function(s){return ['past_due','unpaid','incomplete'].includes(String(s.status||'').toLowerCase())}).length;
      var now=new Date(),month=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
      var collected=invoices.filter(function(i){return i.status==='paid'&&String(i.paid_at||i.created_at||'').slice(0,7)===month}).reduce(function(sum,i){return sum+(Number(i.amount_paid)||0)},0);
      var outstanding=invoices.filter(function(i){return i.status==='open'}).reduce(function(sum,i){return sum+(Number(i.amount_due)||0)},0);
      var hasLive=customers.length||subs.length||invoices.length||checkouts.length;
      document.body.classList.add('vms-phase3-billing');
      install();
      var panel=document.getElementById('vmsPhase3AdminBilling');if(!panel){panel=document.createElement('section');panel.id='vmsPhase3AdminBilling';var intro=content.querySelector('.intro');intro?intro.insertAdjacentElement('afterend',panel):content.prepend(panel)}
      panel.innerHTML=`
        <div class="p3-head"><div><h2>Live Billing Ledger</h2><p>Stripe subscriptions, successful payments, invoices, checkout sessions, and payment issues synced through Supabase.</p></div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><span class="p3-provider ${hasLive?'live':''}">${hasLive?'Stripe connected':'Waiting for first Stripe checkout'}</span><button class="btn small" type="button" id="vmsP3BillingRefresh">Refresh</button></div></div>
        <div class="p3-metrics">
          <div class="p3-metric"><span>LIVE MRR</span><strong>${esc(money(mrr))}</strong></div>
          <div class="p3-metric"><span>ACTIVE SUBSCRIPTIONS</span><strong>${active.length}</strong></div>
          <div class="p3-metric"><span>COLLECTED THIS MONTH</span><strong>${esc(money(collected))}</strong></div>
          <div class="p3-metric"><span>NEEDS ATTENTION</span><strong>${pastDue}</strong></div>
        </div>
        <div class="p3-grid">
          <div>
            <div class="p3-card"><div class="p3-card-head"><div><strong>Stripe Subscriptions</strong><span>Current recurring billing source of truth</span></div><span>${subs.length} total</span></div><div class="p3-list">${subs.length?subs.slice(0,12).map(function(s){var c=cmap.get(s.client_id)||{};return `<div class="p3-row"><div><strong>${esc(c.business_name||c.owner_email||'Client')} · ${esc(s.metadata?.service_name||s.metadata?.service_key||'VMS Service')}<span class="p3-badge ${tone(s.status)}">${esc(statusLabel(s.status))}</span></strong><small>${esc(s.cadence||'Recurring')} · Next period ${esc(date(s.current_period_end))}${s.cancel_at_period_end?' · Cancels at period end':''}</small></div><div class="p3-right"><b>${esc(money(s.amount,s.currency))}</b><small>${/annual|year/i.test(String(s.cadence||''))?'/yr':'/mo'}</small></div></div>`}).join(''):'<div class="p3-empty">No live Stripe subscriptions yet.</div>'}</div></div>
            <div class="p3-card"><div class="p3-card-head"><div><strong>Recent Stripe Invoices</strong><span>Receipts and payment status synced from Stripe</span></div><span>${invoices.length} total</span></div><div class="p3-list">${invoices.length?invoices.slice(0,10).map(function(i){var c=cmap.get(i.client_id)||{};var url=i.hosted_invoice_url||i.invoice_pdf_url||'';return `<div class="p3-row"><div><strong>${esc(i.invoice_number||'Stripe invoice')}<span class="p3-badge ${tone(i.status)}">${esc(statusLabel(i.status))}</span></strong><small>${esc(c.business_name||c.owner_email||'Client')} · ${esc(date(i.paid_at||i.issued_at||i.created_at))}</small></div><div class="p3-right"><b>${esc(money(i.status==='paid'?i.amount_paid:i.amount_due,i.currency))}</b>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Open invoice</a>`:''}</div></div>`}).join(''):'<div class="p3-empty">No Stripe invoices or receipts yet.</div>'}</div></div>
          </div>
          <div>
            <div class="p3-card"><div class="p3-card-head"><div><strong>Checkout Activity</strong><span>Latest hosted checkout attempts</span></div><span>${checkouts.length} recent</span></div><div class="p3-list">${checkouts.length?checkouts.slice(0,8).map(function(x){var c=cmap.get(x.client_id)||{};return `<div class="p3-row"><div><strong>${esc(x.metadata?.service_name||x.service_key)}<span class="p3-badge ${tone(x.status)}">${esc(statusLabel(x.status))}</span></strong><small>${esc(c.business_name||c.owner_email||'Client')} · ${esc(date(x.created_at))}</small></div><div class="p3-right"><b>${esc(money((Number(x.service_amount)||0)+(Number(x.activation_fee)||0),x.currency))}</b><small>${esc(x.mode)}</small></div></div>`}).join(''):'<div class="p3-empty">No Stripe checkout sessions yet.</div>'}</div></div>
            <div class="p3-card"><div class="p3-card-head"><div><strong>Open Balance</strong><span>Finalized Stripe invoices still awaiting payment</span></div></div><div class="p3-metric" style="box-shadow:none;margin:0"><span>OUTSTANDING</span><strong>${esc(money(outstanding))}</strong></div><div class="p3-note">The live ledger above is payment-provider data. Keep using the manual tools below for cash/Zelle overrides, internal notes, or records that do not originate in Stripe.</div></div>
          </div>
        </div>`;
      panel.querySelector('#vmsP3BillingRefresh').onclick=function(){lastLoad=0;refresh(true)};
      addManualLabel(content);lastLoad=Date.now();
    }catch(e){console.warn('VMS live billing ledger could not load.',e)}finally{running=false}
  }
  function boot(){[1500,3200,5500].forEach(function(ms){setTimeout(function(){refresh(true)},ms)});window.addEventListener('focus',function(){lastLoad=0;refresh(true)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
