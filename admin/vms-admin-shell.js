(function(){
  var MOBILE_MAX=900;

  function currentPage(){
    var p=(location.pathname||'').split('/').filter(Boolean).pop()||'index.html';
    return p.toLowerCase();
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

      /*
        Capture phase + stopImmediatePropagation prevents legacy page-level
        menu handlers from reopening their retired mobile drawers.
      */
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
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start);
  }else{
    start();
  }
})();
