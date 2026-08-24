/* VMS Phase 3 — public header/modal interaction hardening. */
(()=>{
  if(window.__VMS_PUBLIC_PHASE3__)return;window.__VMS_PUBLIC_PHASE3__=true;
  function install(){
    const menu=document.getElementById('mobileNav'),btn=document.getElementById('menuBtn');
    if(menu&&btn){
      btn.setAttribute('aria-controls','mobileNav');btn.setAttribute('aria-expanded',String(menu.classList.contains('open')));
      const sync=()=>{const open=menu.classList.contains('open');btn.setAttribute('aria-expanded',String(open));document.body.classList.toggle('vms-public-menu-open',open)};
      new MutationObserver(sync).observe(menu,{attributes:true,attributeFilter:['class']});sync();
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('open')){menu.classList.remove('open');btn.focus()}});
      document.addEventListener('click',e=>{if(menu.classList.contains('open')&&!menu.contains(e.target)&&!btn.contains(e.target))menu.classList.remove('open')});
      addEventListener('resize',()=>{if(innerWidth>900&&menu.classList.contains('open'))menu.classList.remove('open')},{passive:true});
    }
    const modals=Array.from(document.querySelectorAll('.modal-backdrop'));
    if(modals.length){
      const syncModal=()=>document.body.classList.toggle('vms-modal-open',modals.some(m=>m.classList.contains('show')));
      modals.forEach(m=>new MutationObserver(syncModal).observe(m,{attributes:true,attributeFilter:['class']}));syncModal();
      document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const open=modals.find(m=>m.classList.contains('show'));if(open)open.classList.remove('show')});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
