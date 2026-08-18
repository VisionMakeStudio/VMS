(function(){
  function bindSidebar(){
    var sidebar=document.querySelector('aside.sidebar,aside.side');
    if(!sidebar)return;
    sidebar.classList.add('sidebar');
    sidebar.id=sidebar.id||'sidebar';
    var btn=document.getElementById('mobileMenuBtn');
    if(btn && !btn.dataset.vmsBound){
      btn.dataset.vmsBound='1';
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        sidebar.classList.toggle('open');
        btn.setAttribute('aria-expanded',sidebar.classList.contains('open')?'true':'false');
      });
    }
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'){sidebar.classList.remove('open');if(btn)btn.setAttribute('aria-expanded','false')}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindSidebar);else bindSidebar();
})();
