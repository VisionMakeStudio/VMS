// Public browser configuration. Safe to expose: project URL + publishable key only.
window.VMS_CONFIG = {
  supabaseUrl: 'https://ncfynulcljtdafbuvzeb.supabase.co',
  supabaseAnonKey: 'sb_publishable_mlH8b3vONTCm-PcGQdPKKw_s0xeXxZp'
};

/*
  VMS Admin fast navigation gate
  --------------------------------
  Admin pages still run the real Supabase + role + MFA verification on every
  load. After an already-verified Admin clicks another VMS Admin page, the
  current page creates a one-use token for that exact destination. Because
  config.js loads in <head>, we can consume that token before <body> paints
  and avoid flashing the full-screen "Verifying secure Admin session…" gate.

  Fresh visits, refreshes, expired tokens, other destinations, and new
  unauthenticated sessions continue to show the privacy gate normally.
*/
(()=>{
  if(location.protocol==='file:' || !location.pathname.startsWith('/admin/'))return;

  const KEY='vms_admin_fast_nav';

  const normalizePath=path=>{
    let p=String(path||'/').split('?')[0].split('#')[0];
    p=p.replace(/\/index(?:\.html)?$/i,'/').replace(/\.html$/i,'');
    if(p.length>1)p=p.replace(/\/+$/,'');
    return p||'/';
  };

  try{
    const raw=sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY); // one use only

    if(!raw)return;

    const token=JSON.parse(raw);
    const validTime=Number(token?.until||0)>Date.now();
    const validTarget=normalizePath(token?.to)===normalizePath(location.pathname);

    if(validTime && validTarget){
      document.documentElement.classList.remove('vms-auth-pending');
    }
  }catch(e){
    try{sessionStorage.removeItem(KEY)}catch{}
  }
})();
