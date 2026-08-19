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
        width:min(100%,344px)!important;
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
        border-radius:46px!important;
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
        border-radius:41px;
        border:1px solid rgba(255,255,255,.18);
        pointer-events:none;
      }
      .manage-preview .phone-notch{
        position:absolute!important;
        top:15px!important;
        left:50%!important;
        transform:translateX(-50%)!important;
        z-index:30!important;
        width:88px!important;
        height:25px!important;
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
        border-radius:38px!important;
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
          width:min(100%,320px)!important;
          padding:8px 6px 10px!important;
        }
        .manage-preview .phone{
          border-width:3px!important;
          border-radius:42px!important;
        }
        .manage-preview .phone::before{border-radius:37px!important}
        .manage-preview .phone-notch{
          top:13px!important;
          width:82px!important;
          height:24px!important;
        }
        .manage-preview .phone-notch::after{
          right:11px;
          top:8.5px;
          width:6px;
          height:6px;
        }
        .manage-preview .public-page{
          padding:58px 17px 22px!important;
          border-radius:35px!important;
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
