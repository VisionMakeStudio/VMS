/* VMS shared production bridge */
(()=>{
  const cfg=window.VMS_CONFIG||{};
  const TEST_EMAIL='info@visionmakestudio.com';
  const isLocal=location.protocol==='file:';
  const ADMIN_FAST_NAV_KEY='vms_admin_fast_nav';
  const FINAL_POLISH_VERSION='20260821-review-fixes';

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
      if(document.querySelector('#vms-admin-sidebar,aside.sidebar,aside.side'))return;

      const current=(path.split('/').filter(Boolean).pop()||'index.html').toLowerCase();
      const nav=[
        ['index.html','Home','⌂'],
        ['audit.html','VMS Audit','✦'],
        ['qr.html','QR Tools','▦'],
        ['clients.html','Clients','◎'],
        ['service-catalog.html','Service Catalog','◇'],
        ['billing.html','Billing / Subscriptions','$'],
        ['promotions.html','Promotions','%'],
        ['projects.html','Projects & Requests','✓'],
        ['files.html','Files & Assets','▤'],
        ['activity.html','Notifications & Activity','●'],
        ['linkhub.html','VMS LinkHub','↗'],
        ['analytics.html','Analytics','◫'],
        ['leads.html','CRM / Leads','◉'],
        ['marketing.html','Sales Content','◆'],
        ['automations.html','Automations','⚡'],
        ['security.html','Security & Access','⌾']
      ];
      const titleMap=new Map(nav.map(([href,label])=>[href,label]));
      const pageTitle=titleMap.get(current)||document.querySelector('h1')?.textContent?.trim()||'VMS Admin';

      if(!document.getElementById('vms-shared-admin-shell-style')){
        const st=document.createElement('style');
        st.id='vms-shared-admin-shell-style';
        st.textContent=`
          body.vms-shared-admin-shell{padding:72px 0 0 236px!important;min-height:100vh!important;overflow-x:hidden!important}
          #vms-admin-sidebar{position:fixed;inset:0 auto 0 0;width:236px;background:linear-gradient(180deg,#003049 0%,#00283d 70%,#06263a 100%);z-index:9998;color:#fff;padding:20px 14px 15px;display:flex;flex-direction:column;box-shadow:12px 0 36px rgba(0,28,45,.08)}
          .vms-admin-brand{display:flex;align-items:center;gap:11px;padding:2px 10px 18px;border-bottom:1px solid rgba(255,255,255,.13)}
          .vms-admin-brand img{width:94px;height:54px;object-fit:contain;object-position:left center;display:block}
          .vms-admin-brand-copy{display:grid;gap:2px}.vms-admin-brand-copy strong{font-size:11px;line-height:1.05}.vms-admin-brand-copy span{font-size:8px;letter-spacing:.16em;color:#9fbdc9;font-weight:900}
          .vms-admin-nav{display:grid;gap:4px;margin-top:15px;overflow:auto}.vms-admin-nav a{color:#d8e6eb;text-decoration:none;border-radius:11px;padding:10px 11px;font-size:11px;font-weight:850;min-height:38px;display:flex;align-items:center;gap:9px}.vms-admin-nav a:hover{background:rgba(255,255,255,.07);color:#fff}.vms-admin-nav a.active{color:#ff7a45;background:rgba(255,255,255,.10)}
          .vms-nav-icon{width:21px;text-align:center;opacity:.9;font-size:12px}.vms-admin-foot{margin-top:auto;border-top:1px solid rgba(255,255,255,.12);padding:13px 9px 2px;display:grid;gap:8px}.vms-admin-foot a{color:#a7c0cb;text-decoration:none;font-size:9px;font-weight:800}.vms-admin-foot small{color:#7897a5;line-height:1.45;font-size:7.5px}
          #vms-admin-topbar{position:fixed;top:0;right:0;left:236px;height:72px;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);border-bottom:1px solid #dce7eb;z-index:9997;display:flex;align-items:center;justify-content:space-between;padding:0 24px;gap:15px}
          .vms-admin-top-left{display:flex;align-items:center;gap:11px;min-width:0}.vms-admin-menu{display:none;width:44px;height:44px;border:1px solid #d6e2e7;background:#fff;color:#003049;border-radius:12px;font-size:19px;font-weight:900}.vms-admin-page-title small{display:block;color:#8b9da6;font-size:8px;font-weight:950;letter-spacing:.14em}.vms-admin-page-title strong{display:block;color:#003049;font-size:20px;line-height:1.1;margin-top:3px}.vms-admin-top-actions{display:flex;align-items:center;gap:8px}.vms-shell-btn{height:39px;border:1px solid #d6e2e7;border-radius:10px;background:#fff;color:#003049;padding:0 12px;font-weight:900;font-size:10px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.vms-shell-btn.primary{background:#003049;border-color:#003049;color:#fff}
          #vms-admin-backdrop{display:none;position:fixed;inset:0;background:rgba(0,28,45,.48);z-index:9996}
          body.vms-shared-admin-shell>main,body.vms-shared-admin-shell>.page{max-width:none!important;margin-left:0!important;margin-right:0!important}
          @media(max-width:820px){body.vms-shared-admin-shell{padding:70px 0 0!important}#vms-admin-sidebar{width:min(82vw,340px);transform:translateX(-105%);transition:transform .24s ease}body.vms-admin-drawer-open #vms-admin-sidebar{transform:translateX(0)}body.vms-admin-drawer-open #vms-admin-backdrop{display:block}#vms-admin-topbar{left:0;height:70px;padding:0 16px}.vms-admin-menu{display:grid;place-items:center}.vms-admin-page-title strong{font-size:18px}.vms-admin-top-actions .desktop-only-shell{display:none}}
        `;
        document.head.appendChild(st);
      }

      const aside=document.createElement('aside');
      aside.id='vms-admin-sidebar';
      aside.innerHTML=`<div class="vms-admin-brand"><img src="../assets/vms-logo.png" alt="Vision Make Studio"><div class="vms-admin-brand-copy"><strong>Vision Make Studio</strong><span>ADMIN</span></div></div><nav class="vms-admin-nav">${nav.map(([href,label,icon])=>`<a href="${href}" class="${current===href.toLowerCase()?'active':''}"><span class="vms-nav-icon">${icon}</span><span>${label}</span></a>`).join('')}</nav><div class="vms-admin-foot"><a href="../portal/">Client Portal</a><a href="../index.html">Public Website</a><small>VMS Admin · Private workspace<br>info@visionmakestudio.com</small></div>`;

      const header=document.createElement('header');
      header.id='vms-admin-topbar';
      header.innerHTML=`<div class="vms-admin-top-left"><button class="vms-admin-menu" type="button" aria-label="Open admin menu">☰</button><div class="vms-admin-page-title"><small>VMS ADMIN</small><strong>${pageTitle}</strong></div></div><div class="vms-admin-top-actions"><a class="vms-shell-btn desktop-only-shell" href="../portal/">Client Portal</a><a class="vms-shell-btn primary" href="../index.html">View Site</a></div>`;
      const backdrop=document.createElement('div');backdrop.id='vms-admin-backdrop';
      document.body.prepend(backdrop,header,aside);
      document.body.classList.add('vms-shared-admin-shell');
      const close=()=>document.body.classList.remove('vms-admin-drawer-open');
      header.querySelector('.vms-admin-menu')?.addEventListener('click',()=>document.body.classList.toggle('vms-admin-drawer-open'));
      backdrop.addEventListener('click',close);
      aside.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
      document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    };

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureAdminShell,{once:true});else ensureAdminShell();

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
    const reveal=()=>document.documentElement.classList.remove('vms-auth-pending');

    const adminFail=code=>{
      clearAdminFastNav();
      location.replace('/admin/login.html?error='+encodeURIComponent(code));
      return null;
    };

    const portalFail=code=>{
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
