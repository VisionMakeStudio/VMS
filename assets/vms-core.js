/* VMS shared production bridge */
(()=>{
  const cfg=window.VMS_CONFIG||{};
  const TEST_EMAIL='info@visionmakestudio.com';
  const isLocal=location.protocol==='file:';
  async function loadSupabase(){
    if(window.supabase?.createClient)return window.supabase;
    if(!cfg.supabaseUrl||!cfg.supabaseAnonKey)return null;
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
    return window.supabase;
  }
  async function client(){const lib=await loadSupabase();return lib?lib.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null}
  async function magicLink(email,redirectPath='/portal/'){
    email=String(email||'').trim().toLowerCase();
    if(!email)throw new Error('Enter your email address.');
    const sb=await client();
    if(!sb){if(isLocal&&email===TEST_EMAIL){localStorage.setItem('vms_local_portal_session',TEST_EMAIL);location.href=redirectPath.includes('portal')?'../portal/index.html':'portal/index.html';return {local:true}};return {local:true}}
    const redirectTo=new URL(redirectPath,location.origin).href;
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:false}});if(error)throw error;return {local:false};
  }
  async function signOut(){const sb=await client();if(sb)await sb.auth.signOut();localStorage.removeItem('vms_local_portal_session');localStorage.removeItem('vms_local_admin_session');}
  async function requireSession(kind='client'){
    if(isLocal)return {email:kind==='client'?TEST_EMAIL:'preview@visionmakestudio.com',role:kind};
    const sb=await client();if(!sb){location.href=kind==='admin'?'/admin/login.html':'/?portal=1';return null}
    const {data:{session}}=await sb.auth.getSession();if(!session){location.href=kind==='admin'?'/admin/login.html':'/?portal=1';return null}
    if(kind==='admin'){
      const {data:profile}=await sb.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
      if(profile?.role!=='admin'){await sb.auth.signOut();location.href='/admin/login.html?error=unauthorized';return null}
    }
    return session.user;
  }
  async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});if(!r.ok){let m='Request failed';try{m=(await r.json()).error||m}catch{}throw new Error(m)}return r.json()}
  window.VMSAuth={magicLink,signOut,requireSession,client,TEST_EMAIL};window.VMSApi={api};
  document.documentElement.classList.add('vms-suite-loaded');
})();
