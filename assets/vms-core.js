/* VMS shared production bridge */
(()=>{
  const cfg=window.VMS_CONFIG||{};
  const TEST_EMAIL='info@visionmakestudio.com';
  const isLocal=location.protocol==='file:';
  const ADMIN_VISUAL_TRUST_KEY='vms_admin_visual_trust_until';
  const ADMIN_VISUAL_TRUST_MS=15*60*1000;

  function configReady(){
    return !!(
      cfg.supabaseUrl &&
      cfg.supabaseAnonKey &&
      !String(cfg.supabaseUrl).includes('PASTE_') &&
      !String(cfg.supabaseAnonKey).includes('PASTE_')
    );
  }

  function setAdminVisualTrust(){
    try{
      sessionStorage.setItem(
        ADMIN_VISUAL_TRUST_KEY,
        String(Date.now()+ADMIN_VISUAL_TRUST_MS)
      );
    }catch{}
  }

  function clearAdminVisualTrust(){
    try{sessionStorage.removeItem(ADMIN_VISUAL_TRUST_KEY)}catch{}
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
    clearAdminVisualTrust();

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
    return data||{
      currentLevel:null,
      nextLevel:null,
      currentAuthenticationMethods:[]
    };
  }

  async function requireSession(kind='client'){
    const reveal=()=>document.documentElement.classList.remove('vms-auth-pending');

    const adminFail=code=>{
      clearAdminVisualTrust();
      location.replace('/admin/login.html?error='+encodeURIComponent(code));
      return null;
    };

    const portalFail=code=>{
      location.replace('/?portal=1&portal_error='+encodeURIComponent(code));
      return null;
    };

    if(isLocal){
      if(kind==='admin')setAdminVisualTrust();
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

        const aal=await getMfaState(sb);

        if(aal?.nextLevel==='aal2' && aal?.currentLevel!=='aal2'){
          return adminFail('mfa_required');
        }

        setAdminVisualTrust();

      }catch(e){
        console.error('VMS admin verification failed',e);
        return adminFail('verification_failed');
      }
    }

    reveal();
    return session.user;
  }

  function installLogoutStyles(){
    if(document.getElementById('vms-shared-logout-style'))return;

    const style=document.createElement('style');
    style.id='vms-shared-logout-style';
    style.textContent=`
      .vms-logout-wrap{
        width:100%;
        margin-top:10px;
        padding-top:10px;
        border-top:1px solid rgba(255,255,255,.10);
      }

      .vms-shared-logout{
        width:100%;
        min-height:42px;
        margin:0;
        padding:9px 11px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:10px;
        background:rgba(255,255,255,.055);
        color:rgba(255,255,255,.90);
        display:flex;
        align-items:center;
        justify-content:flex-start;
        gap:9px;
        font:850 10px/1.2 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
        text-align:left;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:background .16s ease,border-color .16s ease,color .16s ease;
      }

      .vms-shared-logout:hover{
        background:rgba(193,18,31,.17);
        border-color:rgba(255,180,186,.20);
        color:#fff;
      }

      .vms-shared-logout:active{
        background:rgba(193,18,31,.23);
      }

      .vms-shared-logout:disabled{
        opacity:.58;
        cursor:wait;
      }

      .vms-shared-logout svg{
        width:17px;
        height:17px;
        flex:0 0 17px;
        stroke:currentColor;
      }

      .vms-shared-logout .vms-logout-copy{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .vms-shared-logout strong{
        color:inherit;
        font-size:10px;
        line-height:1.15;
        font-weight:900;
      }

      .vms-shared-logout small{
        color:rgba(255,255,255,.52);
        font-size:7px;
        line-height:1.2;
        font-weight:750;
      }

      @media(max-width:900px){
        .vms-shared-logout{
          min-height:46px;
          padding:11px 12px;
          border-radius:11px;
          font-size:11px;
        }

        .vms-shared-logout strong{font-size:11px}
        .vms-shared-logout small{font-size:7.5px}
      }
    `;

    document.head.appendChild(style);
  }

  function installLogoutControl(){
    const path=(location.pathname||'').toLowerCase();
    const isAdmin=path.startsWith('/admin/') &&
      !/\/admin\/login(?:\.html)?\/?$/.test(path);
    const isPortal=path==='/portal' ||
      path==='/portal/' ||
      path.startsWith('/portal/');

    if(!isAdmin && !isPortal)return;
    if(document.querySelector('[data-vms-shared-logout="1"]'))return;

    const sidebar=document.querySelector('aside.sidebar,aside.side,.sidebar,.side');
    if(!sidebar)return;

    installLogoutStyles();

    const wrap=document.createElement('div');
    wrap.className='vms-logout-wrap';
    wrap.dataset.vmsSharedLogout='1';

    const button=document.createElement('button');
    button.type='button';
    button.className='vms-shared-logout';
    button.setAttribute('aria-label',isAdmin?'Log out of VMS Admin':'Log out of Client Portal');

    button.innerHTML=`
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 17l5-5-5-5"></path>
        <path d="M15 12H3"></path>
        <path d="M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"></path>
      </svg>
      <span class="vms-logout-copy">
        <strong>Log out</strong>
        <small>${isAdmin?'VMS Admin':'Client Portal'}</small>
      </span>
    `;

    button.addEventListener('click',async()=>{
      if(button.disabled)return;

      button.disabled=true;
      const strong=button.querySelector('strong');
      const small=button.querySelector('small');

      if(strong)strong.textContent='Signing out…';
      if(small)small.textContent='Please wait';

      try{
        await signOut();
      }catch(e){
        console.error('VMS sign out failed',e);
      }

      if(isAdmin){
        location.replace('/admin/login.html?logged_out=1');
      }else{
        location.replace('/?portal=1&logged_out=1');
      }
    });

    wrap.appendChild(button);

    if(isPortal){
      const foot=sidebar.querySelector('.side-foot');
      if(foot){
        foot.appendChild(wrap);
      }else{
        wrap.style.marginTop='auto';
        sidebar.appendChild(wrap);
      }
      return;
    }

    const adminFoot=sidebar.querySelector(
      '.side-bottom,.side-bottom-dock,.vms-admin-sidebar-foot,.sidebar-foot,.side-note'
    );

    if(adminFoot){
      adminFoot.appendChild(wrap);
    }else{
      wrap.style.marginTop='auto';
      sidebar.appendChild(wrap);
    }
  }

  function bootSharedUi(){
    installLogoutControl();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bootSharedUi,{once:true});
  }else{
    bootSharedUi();
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
