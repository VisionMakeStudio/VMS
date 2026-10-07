/* VMS cookie consent + Google Analytics 4 (public pages only).
   Analytics loads ONLY after the visitor taps Accept. Until GA_ID is filled in,
   nothing loads and no banner is shown. */
(function(){
  var GA_ID='';                       // <-- paste your GA4 Measurement ID here, e.g. 'G-ABC123XYZ9'
  var KEY='vms-consent-v1';
  if(!GA_ID)return;
  if(/^\/(admin|portal|api)\//.test(location.pathname))return;
  function get(){try{return localStorage.getItem(KEY)}catch(e){return null}}
  function set(v){try{localStorage.setItem(KEY,v)}catch(e){}}
  var gpc=navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
  function loadGA(){
    if(window.__vmsGA)return;window.__vmsGA=1;
    var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID;document.head.appendChild(s);
    window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};
    gtag('js',new Date());gtag('config',GA_ID,{anonymize_ip:true});
  }
  function css(){
    if(document.getElementById('vms-consent-css'))return;
    var st=document.createElement('style');st.id='vms-consent-css';
    st.textContent='.vms-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:520px;margin:0 auto;background:#003049;color:#FDF0D5;border:1px solid rgba(253,240,213,.25);border-radius:14px;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.35);font:14px/1.5 Inter,system-ui,sans-serif}.vms-cc p{margin:0 0 12px}.vms-cc a{color:#FFB48A;text-decoration:underline}.vms-cc .r{display:flex;gap:10px;flex-wrap:wrap}.vms-cc button{flex:1 1 120px;min-height:44px;border-radius:10px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid rgba(253,240,213,.4);background:transparent;color:#FDF0D5}.vms-cc button.y{background:#EB5E28;border-color:#EB5E28;color:#fff}.vms-cc button:focus-visible{outline:3px solid #FFB48A;outline-offset:2px}@media(min-width:600px){.vms-cc{left:auto;right:20px;margin:0}}';
    document.head.appendChild(st);
  }
  function close(){var b=document.getElementById('vms-cc');if(b)b.remove()}
  function open(){
    css();close();
    var d=document.createElement('div');d.className='vms-cc';d.id='vms-cc';d.setAttribute('role','dialog');d.setAttribute('aria-label','Cookie preferences');
    d.innerHTML='<p>We use privacy-friendly analytics cookies to see which pages help visitors, so we can improve this site. Nothing loads unless you accept. <a href="/privacy">Privacy Policy</a></p><div class="r"><button type="button" class="n">Decline</button><button type="button" class="y">Accept</button></div>';
    d.querySelector('.y').onclick=function(){set('granted');close();loadGA()};
    d.querySelector('.n').onclick=function(){set('denied');close()};
    document.body.appendChild(d);
  }
  function init(){
    var c=get();
    if(c==='granted'&&!gpc)loadGA();
    else if(!c&&!gpc)open();
    var links=document.querySelectorAll('.footer-links,.wfoot');
    if(links.length){var a=document.createElement('a');a.href='#';a.textContent='Cookie settings';a.onclick=function(e){e.preventDefault();open()};links[links.length-1].appendChild(a)}
  }
  window.vmsConsent={open:open};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
