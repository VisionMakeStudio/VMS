(function(){
  function bindSidebar(){
    var sidebar=document.querySelector('aside.sidebar,aside.side');
    if(!sidebar)return;

    sidebar.classList.add('sidebar');
    sidebar.id=sidebar.id||'sidebar';

    var buttons=Array.from(document.querySelectorAll(
      '#mobileMenuBtn,.vms-mobile-menu-btn,[data-vms-menu-toggle]'
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
        Capture phase + stopImmediatePropagation prevents old page-specific
        hamburger handlers from running after this shared controller.
      */
      btn.addEventListener('click',function(e){
        if(window.innerWidth>900)return;
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
        if(window.innerWidth<=900)setMenu(false);
      });
    });

    document.addEventListener('keydown',function(e){
      if(e.key==='Escape')setMenu(false);
    });

    window.addEventListener('resize',function(){
      if(window.innerWidth>900)setMenu(false);
    });

    /* Start closed on mobile, regardless of legacy page state. */
    if(window.innerWidth<=900)setMenu(false);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bindSidebar);
  }else{
    bindSidebar();
  }
})();
