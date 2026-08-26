/* VMS shared production bridge */
(()=>{
  const cfg=window.VMS_CONFIG||{};
  const TEST_EMAIL='info@visionmakestudio.com';
  const isLocal=location.protocol==='file:';
  const ADMIN_FAST_NAV_KEY='vms_admin_fast_nav';
  const FINAL_POLISH_VERSION='20260824-billing-auth-fix';
  const PORTAL_AUTH_TYPES=new Set(['email','invite','recovery','email_change']);

  function isPortalLocation(){
    const path=(location.pathname||'/').toLowerCase();
    return path==='/portal'||path==='/portal/'||path.startsWith('/portal/');
  }

  /* Capture the auth payload synchronously, before any Portal router can turn
     the callback fragment into a UI section or replace it with #home. */
  function capturePortalAuthCallback(){
    if(!isPortalLocation())return null;
    try{
      const url=new URL(location.href);
      const query=url.searchParams;
      const fragment=new URLSearchParams((url.hash||'').replace(/^#/,''));
      const callback={
        tokenHash:query.get('token_hash')||'',
        type:query.get('type')||'',
        code:query.get('code')||'',
        accessToken:fragment.get('access_token')||'',
        refreshToken:fragment.get('refresh_token')||'',
        error:query.get('error_description')||query.get('error')||fragment.get('error_description')||fragment.get('error')||''
      };
      return Object.values(callback).some(Boolean)?callback:null;
    }catch(error){
      console.warn('VMS Portal auth callback capture skipped',error);
      return null;
    }
  }

  const PORTAL_AUTH_CALLBACK=capturePortalAuthCallback();

  function surfaceClass(){
    const path=(location.pathname||'/').toLowerCase();
    if(path.startsWith('/admin/'))return 'vms-admin-surface';
    if(path==='/portal'||path==='/portal/'||path.startsWith('/portal/'))return 'vms-portal-surface';
    return 'vms-public-surface';
  }

  function installFinalPolish(){
    const root=document.documentElement;
    root.classList.add(surfaceClass());

    // Give every VMS page a stable page class so shared review fixes can target
    // one tool without changing the approved layout of the rest of the suite.
    const pageName=((location.pathname||'/').split('/').filter(Boolean).pop()||'index.html')
      .replace(/\.html?$/i,'')
      .replace(/[^a-z0-9]+/gi,'-')
      .replace(/^-+|-+$/g,'')
      .toLowerCase()||'index';
    root.classList.add(`vms-page-${pageName}`);

    const ensureAdminShell=()=>{
      const path=(location.pathname||'/').toLowerCase();
      if(!path.startsWith('/admin/')||/\/admin\/login(?:\.html)?\/?$/.test(path))return;
      if(document.getElementById('vmsCanonicalAdminSidebar'))return;
      if(document.querySelector('script[data-vms-canonical-admin-shell="1"]'))return;
      const script=document.createElement('script');
      script.src='/assets/vms-admin-shell.js?v=20260824-phase2-admin-shell';
      script.async=false;
      script.dataset.vmsCanonicalAdminShell='1';
      document.head.appendChild(script);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureAdminShell,{once:true});else ensureAdminShell();

    const ensurePortalShell=()=>{
      const path=(location.pathname||'/').toLowerCase();
      if(!(path==='/portal'||path==='/portal/'||path.startsWith('/portal/')))return;
      if(document.getElementById('vmsCanonicalPortalSidebar'))return;
      if(document.querySelector('script[data-vms-canonical-portal-shell="1"]'))return;
      const script=document.createElement('script');
      script.src='/assets/vms-portal-shell.js?v=20260824-phase2-portal-shell';
      script.async=false;
      script.dataset.vmsCanonicalPortalShell='1';
      document.head.appendChild(script);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensurePortalShell,{once:true});else ensurePortalShell();

    if(!document.querySelector('link[data-vms-final-polish="1"]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href=`/assets/vms-final-polish.css?v=${FINAL_POLISH_VERSION}`;
      link.dataset.vmsFinalPolish='1';
      document.head.appendChild(link);
    }

    const ensureToastRegion=()=>{
      let region=document.getElementById('vms-global-toast-region');
      if(region)return region;
      region=document.createElement('div');
      region.id='vms-global-toast-region';
      region.setAttribute('role','region');
      region.setAttribute('aria-label','VMS notifications');
      region.setAttribute('aria-live','polite');
      document.body.appendChild(region);
      return region;
    };

    const toast=(message,kind='success',timeout=2600)=>{
      message=String(message||'').trim();
      if(!message)return;
      const region=ensureToastRegion();
      const item=document.createElement('div');
      item.className='vms-global-toast';
      item.dataset.kind=['success','error','warning'].includes(kind)?kind:'success';
      item.textContent=message;
      region.appendChild(item);
      requestAnimationFrame(()=>item.classList.add('show'));
      setTimeout(()=>{
        item.classList.remove('show');
        setTimeout(()=>item.remove(),220);
      },Math.max(1200,Number(timeout)||2600));
    };

    const normalizeUrl=value=>{
      let v=String(value||'').trim();
      if(!v)return '';
      if(/^(mailto:|tel:|sms:|geo:|wifi:)/i.test(v))return v;
      if(/^\/\//.test(v))v='https:'+v;
      if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(v))v='https://'+v;
      try{
        const u=new URL(v);
        if(!/^https?:$/.test(u.protocol))return v;
        u.hash=u.hash||'';
        return u.href.replace(/\/$/,'');
      }catch{
        return v;
      }
    };

    const bindUrlNormalization=()=>{
      if(root.dataset.vmsUrlNormalizeBound==='1')return;
      root.dataset.vmsUrlNormalizeBound='1';
      document.addEventListener('blur',event=>{
        const input=event.target;
        if(!(input instanceof HTMLInputElement))return;
        const hint=[input.type,input.name,input.id,input.placeholder,input.getAttribute('aria-label')]
          .filter(Boolean).join(' ').toLowerCase();
        if(!(/url/.test(input.type)||/(website|url|link|instagram|facebook|tiktok|youtube|linkedin|google|destination)/.test(hint)))return;
        const next=normalizeUrl(input.value);
        if(next&&next!==input.value){
          input.value=next;
          input.dispatchEvent(new Event('input',{bubbles:true}));
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
      },true);
    };

    window.VMSUI={
      ...(window.VMSUI||{}),
      toast,
      normalizeUrl,
      version:FINAL_POLISH_VERSION
    };
    window.addEventListener('vms:toast',event=>{
      const detail=event.detail||{};
      toast(detail.message||detail.text||'',detail.kind||detail.type||'success',detail.timeout);
    });
    bindUrlNormalization();
  }

  installFinalPolish();

  function configReady(){
    return !!(
      cfg.supabaseUrl &&
      cfg.supabaseAnonKey &&
      !String(cfg.supabaseUrl).includes('PASTE_') &&
      !String(cfg.supabaseAnonKey).includes('PASTE_')
    );
  }

  function normalizeAdminPath(path){
    let p=String(path||'/').split('?')[0].split('#')[0];
    p=p.replace(/\/index(?:\.html)?$/i,'/').replace(/\.html$/i,'');
    if(p.length>1)p=p.replace(/\/+$/,'');
    return p||'/';
  }

  function clearAdminFastNav(){
    try{sessionStorage.removeItem(ADMIN_FAST_NAV_KEY)}catch{}
  }

  function currentAdminFastNav(){
    try{
      const raw=sessionStorage.getItem(ADMIN_FAST_NAV_KEY);
      if(!raw)return null;
      const data=JSON.parse(raw);
      const current=normalizeAdminPath(location.pathname);
      if(!data||Number(data.until||0)<=Date.now()||normalizeAdminPath(data.to)!==current)return null;
      return data;
    }catch{
      return null;
    }
  }

  async function getSessionWithNavigationGrace(sb,kind){
    let session=null;
    try{
      ({data:{session}}=await sb.auth.getSession());
    }catch(e){
      console.error('VMS session lookup failed',e);
    }

    /* Internal Admin navigation should never bounce a verified user through the
       login screen because Supabase storage took a moment to settle. Keep the
       privacy gate closed and retry briefly; if the session is truly gone, the
       normal login redirect still happens after the grace window. */
    if(session||kind!=='admin'||!currentAdminFastNav())return session;

    const deadline=Date.now()+1800;
    while(!session&&Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,100));
      try{
        ({data:{session}}=await sb.auth.getSession());
      }catch{}
    }
    return session;
  }

  function cleanPortalAuthCallbackUrl(){
    if(!isPortalLocation())return;
    try{
      const url=new URL(location.href);
      for(const key of ['token_hash','type','code','sb_flow_id','auth_callback','error','error_code','error_description'])url.searchParams.delete(key);
      const search=url.searchParams.toString();
      history.replaceState(history.state||null,'',url.pathname+(search?'?'+search:'')+'#home');
    }catch(error){
      console.warn('VMS Portal auth callback cleanup skipped',error);
    }
  }

  async function waitForPortalSession(sb,timeout=5000){
    const deadline=Date.now()+timeout;
    while(Date.now()<deadline){
      try{
        const {data:{session}}=await sb.auth.getSession();
        if(session)return session;
      }catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return null;
  }

  async function finishPortalAuthCallback(sb){
    const callback=PORTAL_AUTH_CALLBACK;
    if(!callback)return null;
    if(callback.error)throw new Error(callback.error);

    /* Supabase may already have consumed an implicit fragment while the client
       initialized. Prefer that session before attempting a second exchange. */
    let session=null;
    try{({data:{session}}=await sb.auth.getSession())}catch{}

    if(!session&&callback.tokenHash){
      const type=PORTAL_AUTH_TYPES.has(callback.type)?callback.type:'email';
      const {data,error}=await sb.auth.verifyOtp({token_hash:callback.tokenHash,type});
      if(error)throw error;
      session=data?.session||null;
    }

    if(!session&&callback.code){
      const {data,error}=await sb.auth.exchangeCodeForSession(callback.code);
      if(error)throw error;
      session=data?.session||null;
    }

    if(!session&&callback.accessToken&&callback.refreshToken){
      const {data,error}=await sb.auth.setSession({
        access_token:callback.accessToken,
        refresh_token:callback.refreshToken
      });
      if(error)throw error;
      session=data?.session||null;
    }

    if(!session)session=await waitForPortalSession(sb);
    if(!session)throw new Error('The secure sign-in link could not be completed.');
    cleanPortalAuthCallbackUrl();
    return session;
  }

  function bindAdminFastNavigation(){
    if(document.documentElement.dataset.vmsFastNavBound==='1')return;
    document.documentElement.dataset.vmsFastNavBound='1';

    document.addEventListener('click',event=>{
      if(event.defaultPrevented)return;

      const anchor=event.target?.closest?.('a[href]');
      if(!anchor)return;

      if(anchor.target && anchor.target.toLowerCase()==='_blank')return;
      if(anchor.hasAttribute('download'))return;

      let url;
      try{
        url=new URL(anchor.getAttribute('href'),location.href);
      }catch{
        return;
      }

      if(url.origin!==location.origin)return;
      if(!url.pathname.startsWith('/admin/'))return;

      const destination=normalizeAdminPath(url.pathname);

      if(
        destination==='/admin/login' ||
        destination==='/admin/login.html'
      ){
        clearAdminFastNav();
        return;
      }

      try{
        sessionStorage.setItem(
          ADMIN_FAST_NAV_KEY,
          JSON.stringify({
            to:destination,
            until:Date.now()+12000
          })
        );
      }catch{}
    },true);
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

    if(isLocal){
      if(email===TEST_EMAIL){
        localStorage.setItem('vms_local_portal_session',TEST_EMAIL);
        location.href=redirectPath.includes('portal')?'../portal/index.html':'portal/index.html';
        return {local:true};
      }
      return {local:true};
    }

    /* Phase 3 uses a branded VMS email sent server-side through Resend.
       The function validates the address against the real clients table before
       generating a Supabase magic link, so public visitors cannot self-create
       arbitrary Client Portal accounts. */
    const response=await fetch('/api/member-magic-link',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,redirectPath})
    });
    let data={};
    try{data=await response.json();}catch{}
    if(!response.ok)throw new Error(data?.error||'We could not send the secure sign-in email right now.');
    return {local:false,branded:true,message:data?.message||''};
  }

  async function signOut(){
    clearAdminFastNav();

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
    const authRoot=document.documentElement;
    authRoot.dataset.vmsAuthChecking=kind;

    const reveal=()=>{
      authRoot.classList.remove('vms-auth-pending');
      authRoot.dataset.vmsAuthVerified=kind;
      delete authRoot.dataset.vmsAuthChecking;
    };

    const adminFail=code=>{
      delete authRoot.dataset.vmsAuthChecking;
      clearAdminFastNav();
      location.replace('/admin/login.html?error='+encodeURIComponent(code));
      return null;
    };

    const portalFail=code=>{
      delete authRoot.dataset.vmsAuthChecking;
      location.replace('/?portal=1&portal_error='+encodeURIComponent(code));
      return null;
    };

    if(isLocal){
      if(kind==='admin')bindAdminFastNavigation();
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

    let callbackSession=null;
    if(kind==='client'&&PORTAL_AUTH_CALLBACK){
      try{
        callbackSession=await finishPortalAuthCallback(sb);
      }catch(e){
        console.error('VMS Portal magic-link completion failed',e);
        return portalFail('magic_link_failed');
      }
    }

    const session=callbackSession||await getSessionWithNavigationGrace(sb,kind);

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

        /*
          Only a successfully verified Admin can arm the fast navigation
          token for the next internal Admin page.
        */
        bindAdminFastNavigation();

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
