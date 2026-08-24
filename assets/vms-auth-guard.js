/* Vision Make Studio — centralized protected-page auth guard.
   Every Admin and Client Portal page uses this one runtime so a privacy gate
   can never remain stuck simply because a legacy page forgot to call VMSAuth. */
(()=>{
  'use strict';
  if(window.__VMS_AUTH_GUARD_V1__)return;
  window.__VMS_AUTH_GUARD_V1__=true;

  const root=document.documentElement;
  const path=(location.pathname||'/').toLowerCase();
  const isAdmin=path.startsWith('/admin/')&&!/\/admin\/login(?:\.html)?\/?$/.test(path);
  const isPortal=path==='/portal'||path==='/portal/'||path.startsWith('/portal/');
  if(!isAdmin&&!isPortal)return;
  const kind=isAdmin?'admin':'client';

  /* A previous Portal shell could accidentally turn Supabase's auth fragment
     into ?section=access_token%3D... . Recover it before Supabase initializes. */
  function repairPortalAuthUrl(){
    if(!isPortal)return;
    try{
      const url=new URL(location.href);
      const section=url.searchParams.get('section');
      if(!section)return;
      const decoded=String(section).trim();
      if(!/^(?:access_token|refresh_token|expires_in|expires_at|token_type|type|error|error_code|error_description)=/i.test(decoded))return;
      url.searchParams.delete('section');
      const search=url.searchParams.toString();
      const clean=url.pathname+(search?'?'+search:'')+'#'+decoded.replace(/^#/,'');
      history.replaceState(history.state||null,'',clean);
    }catch(error){
      console.warn('VMS Portal auth URL repair skipped',error);
    }
  }

  function redirectFailure(code='verification_failed'){
    const target=isAdmin
      ?'/admin/login.html?error='+encodeURIComponent(code)
      :'/?portal=1&portal_error='+encodeURIComponent(code);
    if(location.pathname+location.search!==target)location.replace(target);
  }

  function waitForExistingAuth(timeout=12000){
    return new Promise(resolve=>{
      const started=Date.now();
      const tick=()=>{
        if(root.dataset.vmsAuthVerified===kind||!root.classList.contains('vms-auth-pending'))return resolve(true);
        if(Date.now()-started>=timeout)return resolve(false);
        setTimeout(tick,80);
      };
      tick();
    });
  }

  async function run(){
    repairPortalAuthUrl();

    if(root.dataset.vmsAuthVerified===kind){
      root.classList.remove('vms-auth-pending');
      return;
    }

    /* If a modern page already started requireSession(), do not make a second
       role/MFA request. Wait for that verification to finish instead. */
    if(root.dataset.vmsAuthChecking===kind){
      const ok=await waitForExistingAuth();
      if(!ok)redirectFailure('verification_failed');
      return;
    }

    if(!window.VMSAuth?.requireSession){
      console.error('VMS protected-page auth runtime is unavailable.');
      redirectFailure('configuration');
      return;
    }

    try{
      const user=await window.VMSAuth.requireSession(kind);
      if(user){
        root.dataset.vmsAuthVerified=kind;
        root.classList.remove('vms-auth-pending');
      }
    }catch(error){
      console.error('VMS protected-page verification failed',error);
      redirectFailure('verification_failed');
    }
  }

  run();
})();
