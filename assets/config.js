// Public browser configuration. Safe to expose: project URL + publishable key only.
window.VMS_CONFIG = {
  supabaseUrl: 'https://ncfynulcljtdafbuvzeb.supabase.co',
  supabaseAnonKey: 'sb_publishable_mlH8b3vONTCm-PcGQdPKKw_s0xeXxZp'
};

/*
  VMS Admin trusted-tab visual gate
  ---------------------------------
  Every Admin page still runs the real Supabase session, role, and MFA checks.
  Once this browser tab has successfully verified Admin access, we suppress
  the full-screen privacy splash for a short period so normal Admin navigation
  feels continuous instead of flashing "Verifying..." between pages.

  This is only a visual fast-path. Invalid/expired sessions are still rejected
  by VMSAuth.requireSession().
*/
(()=>{
  if(location.protocol==='file:' || !location.pathname.startsWith('/admin/'))return;
  if(/\/admin\/login(?:\.html)?\/?$/i.test(location.pathname))return;

  const KEY='vms_admin_visual_trust_until';

  try{
    const until=Number(sessionStorage.getItem(KEY)||0);
    if(until>Date.now()){
      document.documentElement.classList.remove('vms-auth-pending');
    }else{
      sessionStorage.removeItem(KEY);
    }
  }catch{}
})();
