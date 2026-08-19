/* VMS shared production bridge */
(()=>{
  const cfg=window.VMS_CONFIG||{};
  const TEST_EMAIL='info@visionmakestudio.com';
  const isLocal=location.protocol==='file:';

  function configReady(){
    return !!(
      cfg.supabaseUrl &&
      cfg.supabaseAnonKey &&
      !String(cfg.supabaseUrl).includes('PASTE_') &&
      !String(cfg.supabaseAnonKey).includes('PASTE_')
    );
  }

  async function loadSupabase(){
    if(window.supabase?.createClient)return window.supabase;
    if(!configReady())return null;

    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });

    return window.supabase;
  }

  async function client(){
    const lib=await loadSupabase();
    return lib?lib.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
  }

  async function magicLink(email,redirectPath='/portal/'){
    email=String(email||'').trim().toLowerCase();
    if(!email)throw new Error('Enter your email address.');

    const sb=await client();

    if(!sb){
      if(isLocal&&email===TEST_EMAIL){
        localStorage.setItem('vms_local_portal_session',TEST_EMAIL);
        location.href=redirectPath.includes('portal')?'../portal/index.html':'portal/index.html';
        return {local:true};
      }
      return {local:true};
    }

    const redirectTo=new URL(redirectPath,location.origin).href;
    const {error}=await sb.auth.signInWithOtp({
      email,
      options:{emailRedirectTo:redirectTo,shouldCreateUser:false}
    });

    if(error)throw error;
    return {local:false};
  }

  async function signOut(){
    const sb=await client();
    if(sb)await sb.auth.signOut();
    localStorage.removeItem('vms_local_portal_session');
    localStorage.removeItem('vms_local_admin_session');
  }

  async function getAdminRole(sb,userId){
    const {data:profile,error}=await sb
      .from('profiles')
      .select('role')
      .eq('id',userId)
      .maybeSingle();

    if(error)throw error;
    return profile?.role||null;
  }

  async function getMfaState(sb){
    const {data,error}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(error)throw error;
    return data||{currentLevel:null,nextLevel:null,currentAuthenticationMethods:[]};
  }

  async function requireSession(kind='client'){
    const reveal=()=>document.documentElement.classList.remove('vms-auth-pending');
    const adminFail=code=>{
      location.replace('/admin/login.html?error='+encodeURIComponent(code));
      return null;
    };
    const portalFail=code=>{
      location.replace('/?portal=1&portal_error='+encodeURIComponent(code));
      return null;
    };

    if(isLocal){
      reveal();
      return {
        email:kind==='client'?TEST_EMAIL:'preview@visionmakestudio.com',
        role:kind
      };
    }

    let sb;
    try{
      sb=await client();
    }catch(e){
      console.error('VMS auth client failed',e);
    }

    if(!sb){
      return kind==='admin'
        ?adminFail('configuration')
        :portalFail('configuration');
    }

    let session=null;
    try{
      ({data:{session}}=await sb.auth.getSession());
    }catch(e){
      console.error('VMS session lookup failed',e);
    }

    if(!session){
      return kind==='admin'
        ?adminFail('session_required')
        :portalFail('session_required');
    }

    if(kind==='admin'){
      try{
        const role=await getAdminRole(sb,session.user.id);

        if(role!=='admin'){
          await sb.auth.signOut();
          return adminFail('unauthorized');
        }

        /*
          If this Admin has a verified MFA factor, Supabase reports
          nextLevel=aal2. Never reveal private Admin content until this
          particular session has completed the second factor.
        */
        const aal=await getMfaState(sb);
        if(aal?.nextLevel==='aal2' && aal?.currentLevel!=='aal2'){
          return adminFail('mfa_required');
        }
      }catch(e){
        console.error('VMS admin verification failed',e);
        return adminFail('verification_failed');
      }
    }

    reveal();
    return session.user;
  }

  async function api(path,options={}){
    const r=await fetch(path,{
      ...options,
      headers:{
        'Content-Type':'application/json',
        ...(options.headers||{})
      }
    });

    if(!r.ok){
      let m='Request failed';
      try{
        m=(await r.json()).error||m;
      }catch{}
      throw new Error(m);
    }

    return r.json();
  }

  window.VMSAuth={
    magicLink,
    signOut,
    requireSession,
    client,
    getAdminRole,
    getMfaState,
    TEST_EMAIL,
    configReady
  };

  window.VMSApi={api};
  document.documentElement.classList.add('vms-suite-loaded');
})();