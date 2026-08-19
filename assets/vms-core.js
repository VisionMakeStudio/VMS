/* VMS shared production bridge · Client Cloud Batch v1 · 2026-08-19 */
(()=>{
  const cfg=window.VMS_CONFIG||{};
  const TEST_EMAIL='info@visionmakestudio.com';
  const isLocal=location.protocol==='file:';
  const ADMIN_VISUAL_TRUST_KEY='vms_admin_visual_trust_until';
  const ADMIN_VISUAL_TRUST_MS=15*60*1000;
  const CLIENT_STORE_KEY='vms_clients_final_v1';
  const BILLING_STORE_KEY='vms_billing_subscriptions_v3';
  const CLIENT_CLOUD_GUARD_KEY='vms_client_cloud_store_hash';
  const nativeFetch=window.fetch.bind(window);
  let sbInstance=null;
  let portalEntitlementObserver=null;
  let portalEntitlementTimer=null;
  let adminCloudSyncTimer=null;

  function configReady(){
    return !!(
      cfg.supabaseUrl &&
      cfg.supabaseAnonKey &&
      !String(cfg.supabaseUrl).includes('PASTE_') &&
      !String(cfg.supabaseAnonKey).includes('PASTE_')
    );
  }

  function setAdminVisualTrust(){
    try{sessionStorage.setItem(ADMIN_VISUAL_TRUST_KEY,String(Date.now()+ADMIN_VISUAL_TRUST_MS))}catch{}
  }

  function clearAdminVisualTrust(){
    try{sessionStorage.removeItem(ADMIN_VISUAL_TRUST_KEY)}catch{}
  }

  async function loadSupabase(){
    if(window.supabase?.createClient)return window.supabase;
    if(!configReady())return null;

    const existing=document.querySelector('script[data-vms-supabase-loader="1"]');
    if(existing){
      await new Promise((resolve,reject)=>{
        if(window.supabase?.createClient)return resolve();
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
      });
      return window.supabase;
    }

    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.dataset.vmsSupabaseLoader='1';
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });

    return window.supabase;
  }

  async function client(){
    if(sbInstance)return sbInstance;
    const lib=await loadSupabase();
    sbInstance=lib?lib.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
    return sbInstance;
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
    try{sessionStorage.removeItem(CLIENT_CLOUD_GUARD_KEY)}catch{}

    const sb=await client();
    if(sb)await sb.auth.signOut();

    localStorage.removeItem('vms_local_portal_session');
    localStorage.removeItem('vms_local_admin_session');
  }

  async function getAdminRole(sb,userId){
    const {data:profile,error}=await sb.from('profiles').select('role').eq('id',userId).maybeSingle();
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
      return {email:kind==='client'?TEST_EMAIL:'preview@visionmakestudio.com',role:kind};
    }

    let sb;
    try{sb=await client()}catch(e){console.error('VMS auth client failed',e)}

    if(!sb)return kind==='admin'?adminFail('configuration'):portalFail('configuration');

    let session=null;
    try{({data:{session}}=await sb.auth.getSession())}catch(e){console.error('VMS session lookup failed',e)}

    if(!session)return kind==='admin'?adminFail('session_required'):portalFail('session_required');

    if(kind==='admin'){
      try{
        const role=await getAdminRole(sb,session.user.id);
        if(role!=='admin'){
          await sb.auth.signOut();
          return adminFail('unauthorized');
        }

        const aal=await getMfaState(sb);
        if(aal?.nextLevel==='aal2'&&aal?.currentLevel!=='aal2')return adminFail('mfa_required');
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
      .vms-logout-wrap{width:100%;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.10)}
      .vms-shared-logout{width:100%;min-height:42px;margin:0;padding:9px 11px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.90);display:flex;align-items:center;justify-content:flex-start;gap:9px;font:850 10px/1.2 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .16s ease,border-color .16s ease,color .16s ease}
      .vms-shared-logout:hover{background:rgba(193,18,31,.17);border-color:rgba(255,180,186,.20);color:#fff}
      .vms-shared-logout:active{background:rgba(193,18,31,.23)}
      .vms-shared-logout:disabled{opacity:.58;cursor:wait}
      .vms-shared-logout svg{width:17px;height:17px;flex:0 0 17px;stroke:currentColor}
      .vms-shared-logout .vms-logout-copy{min-width:0;display:grid;gap:1px}
      .vms-shared-logout strong{color:inherit;font-size:10px;line-height:1.15;font-weight:900}
      .vms-shared-logout small{color:rgba(255,255,255,.52);font-size:7px;line-height:1.2;font-weight:750}
      @media(max-width:900px){.vms-shared-logout{min-height:46px;padding:11px 12px;border-radius:11px;font-size:11px}.vms-shared-logout strong{font-size:11px}.vms-shared-logout small{font-size:7.5px}}
    `;
    document.head.appendChild(style);
  }

  function installLogoutControl(){
    const path=(location.pathname||'').toLowerCase();
    const isAdmin=path.startsWith('/admin/')&&!/\/admin\/login(?:\.html)?\/?$/.test(path);
    const isPortal=path==='/portal'||path==='/portal/'||path.startsWith('/portal/');
    if(!isAdmin&&!isPortal)return;
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
    button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"></path></svg><span class="vms-logout-copy"><strong>Log out</strong><small>${isAdmin?'VMS Admin':'Client Portal'}</small></span>`;

    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      button.disabled=true;
      const strong=button.querySelector('strong');
      const small=button.querySelector('small');
      if(strong)strong.textContent='Signing out…';
      if(small)small.textContent='Please wait';
      try{await signOut()}catch(e){console.error('VMS sign out failed',e)}
      if(isAdmin)location.replace('/admin/login.html?logged_out=1');
      else location.replace('/?portal=1&logged_out=1');
    });

    wrap.appendChild(button);
    if(isPortal){
      const foot=sidebar.querySelector('.side-foot');
      if(foot)foot.appendChild(wrap);else{wrap.style.marginTop='auto';sidebar.appendChild(wrap)}
      return;
    }

    const adminFoot=sidebar.querySelector('.side-bottom,.side-bottom-dock,.vms-admin-sidebar-foot,.sidebar-foot,.side-note');
    if(adminFoot)adminFoot.appendChild(wrap);else{wrap.style.marginTop='auto';sidebar.appendChild(wrap)}
  }

  /* ------------------------------------------------------------------
     Client onboarding + service assignment production bridge
     ------------------------------------------------------------------ */
  function lower(v){return String(v||'').trim().toLowerCase()}
  function cleanEmail(v){return lower(v)}
  function titleCaseStatus(v){
    const s=lower(v).replace(/[_-]+/g,' ');
    if(s==='needs attention')return 'Needs Attention';
    return s?s.replace(/\b\w/g,c=>c.toUpperCase()):'Active';
  }
  function dbClientStatus(v){
    const s=lower(v).replace(/[_-]+/g,' ');
    if(s==='lead')return 'lead';
    if(s==='needs attention')return 'needs_attention';
    if(s==='paused')return 'paused';
    if(s==='archived')return 'archived';
    return 'active';
  }
  function dbServiceStatus(v){
    const s=lower(v);
    if(['pending','active','paused','completed','canceled'].includes(s))return s;
    return 'active';
  }
  function billingStatusForService(status){
    const s=dbServiceStatus(status);
    if(s==='active')return 'active';
    if(s==='completed')return 'completed';
    if(s==='paused')return 'paused';
    if(s==='canceled')return 'canceled';
    return 'pending';
  }
  function hashString(value){
    let h=2166136261;
    const str=String(value||'');
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(36);
  }
  function readClientStore(){
    try{const raw=localStorage.getItem(CLIENT_STORE_KEY);const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[]}catch{return []}
  }
  function writeClientStore(list){try{localStorage.setItem(CLIENT_STORE_KEY,JSON.stringify(list))}catch{}}

  async function requireAdminClient(){
    const sb=await client();
    if(!sb)throw new Error('VMS cloud is unavailable.');
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user)throw new Error('Admin session expired.');
    const role=await getAdminRole(sb,session.user.id);
    if(role!=='admin')throw new Error('Admin access required.');
    return {sb,session};
  }


  function billingStatusLabel(value){
    const s=lower(value).replace(/[_-]+/g,' ');
    if(['active','test','paid','completed'].includes(s))return 'Active';
    if(['pending','awaiting payment','unpaid'].includes(s))return 'Awaiting Payment';
    if(['past due','past_due'].includes(s))return 'Past Due';
    if(['paused','suspended'].includes(s))return 'Suspended';
    if(['canceled','cancelled'].includes(s))return 'Canceled';
    return titleCaseStatus(s||'Active');
  }

  function readBillingStore(){
    try{
      const raw=localStorage.getItem(BILLING_STORE_KEY);
      const parsed=raw?JSON.parse(raw):{};
      return {
        subscriptions:Array.isArray(parsed.subscriptions)?parsed.subscriptions:[],
        oneTimePayments:Array.isArray(parsed.oneTimePayments)?parsed.oneTimePayments:[],
        invoices:Array.isArray(parsed.invoices)?parsed.invoices:[]
      };
    }catch{return {subscriptions:[],oneTimePayments:[],invoices:[]}}
  }

  function syncBillingStoreFromCloud(cloudClients,cloudServices,catalog){
    const current=readBillingStore();
    const byClient=new Map((cloudClients||[]).map(x=>[x.id,x]));
    const byCatalog=new Map((catalog||[]).map(x=>[x.id,x]));
    const existingByKey=new Map((current.subscriptions||[]).map(x=>[
      `${cleanEmail(x.email)}|${lower(x.catalogServiceId||x.service)}`,x
    ]));

    const cloudSubscriptions=(cloudServices||[]).filter(row=>{
      if(row?.metadata?.testAccess===true)return false;
      const cat=byCatalog.get(row.service_key);
      return !!row.billing_cadence||cat?.pricing_model==='Recurring';
    }).map(row=>{
      const clientRow=byClient.get(row.client_id);
      if(!clientRow)return null;
      const cat=byCatalog.get(row.service_key);
      const key=`${cleanEmail(clientRow.owner_email)}|${lower(row.service_key)}`;
      const old=existingByKey.get(key)||{};
      const agreed=row.agreed_price==null?Number(cat?.recurring_price||0):Number(row.agreed_price);
      const standard=Number(cat?.recurring_price??agreed??0);
      return {
        ...old,
        id:old.id||`cloud-sub-${row.client_id}-${row.service_key}`,
        client:clientRow.business_name||'VMS Client',
        email:clientRow.owner_email||'',
        service:row.service_name||cat?.name||'VMS Subscription',
        catalogServiceId:row.service_key,
        pricingModel:cat?.kind==='package'?'Package':'Catalog / Custom',
        bundleItems:Array.isArray(old.bundleItems)?old.bundleItems:[],
        status:billingStatusLabel(row.billing_status||row.service_status),
        setupPrice:Number(old.setupPrice||0),
        price:Number.isFinite(agreed)?agreed:0,
        standardPrice:Number.isFinite(standard)?standard:0,
        cycle:row.billing_cadence||cat?.cadence||'Monthly',
        promo:old.promo||'',
        startDate:row.start_date||old.startDate||'',
        nextRenewal:old.nextRenewal||'',
        lastPayment:old.lastPayment||'',
        note:row?.metadata?.note||old.note||'Synced from VMS Client Services.',
        archived:lower(row.service_status)==='canceled'||lower(row.billing_status)==='canceled',
        payments:Array.isArray(old.payments)?old.payments:[],
        cloudManaged:true,
        cloudServiceId:row.id
      };
    }).filter(Boolean);

    const cloudKeys=new Set(cloudSubscriptions.map(x=>`${cleanEmail(x.email)}|${lower(x.catalogServiceId||x.service)}`));
    const manual=(current.subscriptions||[]).filter(x=>{
      if(x.cloudManaged)return false;
      const key=`${cleanEmail(x.email)}|${lower(x.catalogServiceId||x.service)}`;
      return !cloudKeys.has(key);
    });
    const next={...current,subscriptions:[...cloudSubscriptions,...manual]};
    const before=JSON.stringify(current);
    const after=JSON.stringify(next);
    if(before!==after){
      try{localStorage.setItem(BILLING_STORE_KEY,after)}catch{}
      return {changed:true,hash:hashString(after)};
    }
    return {changed:false,hash:hashString(after)};
  }

  function clientMetadataFromInput(input={},existing={}){
    const meta={...(existing||{})};
    const set=(key,value)=>{if(value!==undefined&&value!==null&&String(value)!=='')meta[key]=value};
    set('local_id',input.id);
    set('industry',input.industry);
    set('website',input.website);
    set('since',input.since);
    set('address',input.address);
    set('note',input.note);
    set('source',input.source||meta.source||'VMS Admin');
    set('preArchiveStatus',input.preArchiveStatus);
    if(typeof input.logo==='string'&&/^https?:\/\//i.test(input.logo))set('logo_url',input.logo);
    return meta;
  }

  async function directSyncClient(input={},overrides={}){
    const email=cleanEmail(input.email);
    if(!email)throw new Error('Client email is required for Portal access.');
    const {sb}=await requireAdminClient();

    const {data:found,error:findError}=await sb.from('clients').select('*').ilike('owner_email',email).maybeSingle();
    if(findError)throw findError;

    const metadata=clientMetadataFromInput(input,found?.metadata||{});
    if(overrides.metadata&&typeof overrides.metadata==='object')Object.assign(metadata,overrides.metadata);

    const payload={
      business_name:String(input.business||found?.business_name||'VMS Client').trim().slice(0,180),
      owner_email:email,
      contact_name:String(input.contact||found?.contact_name||'').trim().slice(0,180)||null,
      phone:String(input.phone||found?.phone||'').trim().slice(0,80)||null,
      status:overrides.status||dbClientStatus(input.status||found?.status||'active'),
      metadata,
      onboarding_status:overrides.onboarding_status||found?.onboarding_status||'not_invited',
      preferred_contact_method:input.preferredContactMethod||found?.preferred_contact_method||null,
      preferred_contact_time:input.preferredContactTime||found?.preferred_contact_time||null,
      portal_invited_at:overrides.portal_invited_at??found?.portal_invited_at??null,
      updated_at:new Date().toISOString()
    };

    if(found?.id){
      const {data,error}=await sb.from('clients').update(payload).eq('id',found.id).select('*').single();
      if(error)throw error;
      return data;
    }

    const {data,error}=await sb.from('clients').insert(payload).select('*').single();
    if(error)throw error;
    return data;
  }

  async function catalogForAssignments(sb){
    const {data,error}=await sb.from('service_catalog').select('id,name,pricing_model,one_time_price,recurring_price,cadence,status,metadata,included');
    if(error)throw error;
    return Array.isArray(data)?data:[];
  }

  async function directSyncServices(input={}){
    const cloudClient=await directSyncClient(input);
    const {sb}=await requireAdminClient();
    const catalog=await catalogForAssignments(sb);
    const byId=new Map(catalog.map(x=>[lower(x.id),x]));
    const byName=new Map(catalog.map(x=>[lower(x.name),x]));

    const normalized=(Array.isArray(input.services)?input.services:[]).map(service=>{
      const candidate=byId.get(lower(service.catalogType))||byName.get(lower(service.name));
      const billingType=lower(service.billingType);
      const cadence=billingType.includes('annual')?'Annual':billingType.includes('month')?'Monthly':candidate?.cadence||null;
      const catalogPrice=cadence?candidate?.recurring_price:candidate?.one_time_price;
      const explicit=service.price!==''&&service.price!==null&&service.price!==undefined;
      const rawPrice=explicit?Number(service.price):Number(catalogPrice);
      const status=dbServiceStatus(service.status);
      return {
        client_id:cloudClient.id,
        service_key:candidate?.id||String(service.catalogType||service.name||'service').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
        service_name:String(service.name||candidate?.name||'VMS Service').slice(0,180),
        service_status:status,
        billing_status:billingStatusForService(status),
        catalog_service_id:candidate?.id||null,
        agreed_price:Number.isFinite(rawPrice)?rawPrice:null,
        billing_cadence:cadence,
        price_locked:true,
        start_date:service.startDate||null,
        metadata:{
          source:'vms-admin-clients',
          local_service_id:service.id||null,
          note:String(service.note||'').slice(0,1000),
          assigned_from_catalog:!!candidate
        },
        updated_at:new Date().toISOString()
      };
    }).filter(x=>x.service_key);

    const {data:existing,error:existingError}=await sb.from('client_services').select('id,service_key,metadata').eq('client_id',cloudClient.id);
    if(existingError)throw existingError;

    const nextKeys=new Set(normalized.map(x=>x.service_key));
    const stale=(existing||[]).filter(row=>{
      const managed=row?.metadata?.source==='vms-admin-clients'||row?.metadata?.testAccess===true;
      return managed&&!nextKeys.has(row.service_key);
    }).map(row=>row.id);

    if(stale.length){
      const {error}=await sb.from('client_services').delete().in('id',stale);
      if(error)throw error;
    }

    let saved=[];
    if(normalized.length){
      const {data,error}=await sb.from('client_services').upsert(normalized,{onConflict:'client_id,service_key'}).select('*');
      if(error)throw error;
      saved=data||[];
    }

    const metadata={...(cloudClient.metadata||{}),services_synced_at:new Date().toISOString()};
    await sb.from('clients').update({metadata,updated_at:new Date().toISOString()}).eq('id',cloudClient.id);
    setTimeout(()=>syncAdminClientLocalStore({reload:false}),0);
    return {ok:true,client:{...cloudClient,metadata},services:saved};
  }

  async function directDeleteClient(input={}){
    const email=cleanEmail(input.email);
    if(!email)return {ok:true,skipped:true};
    const {sb}=await requireAdminClient();
    const {data:found,error:findError}=await sb.from('clients').select('id').ilike('owner_email',email).maybeSingle();
    if(findError)throw findError;
    if(!found?.id)return {ok:true,skipped:true};
    const {error}=await sb.from('clients').delete().eq('id',found.id);
    if(error)throw error;
    return {ok:true,deleted:true};
  }

  async function directAdminClientAction(action,input={}){
    if(action==='sync-services')return directSyncServices(input);
    if(action==='delete')return directDeleteClient(input);
    const c=await directSyncClient(input);
    return {ok:true,client:c};
  }

  function installAdminClientFetchBridge(){
    if(isLocal||!location.pathname.startsWith('/admin/'))return;
    if(window.__VMS_CLIENT_FETCH_BRIDGE__)return;
    window.__VMS_CLIENT_FETCH_BRIDGE__=true;

    window.fetch=async(input,init={})=>{
      let url='';
      try{url=typeof input==='string'?new URL(input,location.origin).href:input?.url||''}catch{}
      let parsedUrl=null;
      try{parsedUrl=new URL(url,location.origin)}catch{}
      const method=String(init?.method||input?.method||'GET').toUpperCase();

      if(parsedUrl?.origin===location.origin&&parsedUrl.pathname==='/api/client-account'&&method==='POST'&&typeof init?.body==='string'){
        let body=null;
        try{body=JSON.parse(init.body)}catch{}
        const action=String(body?.action||'sync');
        const inputClient=body?.client||{};

        if(['sync','sync-services','delete'].includes(action)){
          try{
            const result=await directAdminClientAction(action,inputClient);
            return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
          }catch(error){
            console.error('VMS direct client sync failed',error);
            return new Response(JSON.stringify({error:error?.message||'Client cloud update failed.'}),{status:500,headers:{'Content-Type':'application/json'}});
          }
        }

        if(action==='invite'){
          const response=await nativeFetch(input,init);
          try{
            if(response.ok){
              const nextOnboarding=lower(inputClient.onboardingStatus)==='active'?'active':'invited';
              await directSyncClient(inputClient,{onboarding_status:nextOnboarding,portal_invited_at:new Date().toISOString()});
            }else{
              await directSyncClient({...inputClient,status:'Needs Attention'},{status:'needs_attention',onboarding_status:'needs_attention'});
            }
            setTimeout(()=>syncAdminClientLocalStore({reload:false}),0);
          }catch(e){console.warn('VMS invite status sync failed',e)}
          return response;
        }
      }

      return nativeFetch(input,init);
    };
  }

  function mapCloudService(row,catalogMap,oldServices=[]){
    const cat=catalogMap.get(row.service_key);
    const old=oldServices.find(x=>lower(x.catalogType)===lower(row.service_key)||lower(x.name)===lower(row.service_name));
    return {
      id:row?.metadata?.local_service_id||old?.id||('cloud-service-'+row.id),
      name:row.service_name||cat?.name||'VMS Service',
      catalogType:row.service_key,
      billingType:row.billing_cadence||((cat?.pricing_model==='Recurring')?'Monthly':'One-time'),
      price:row.agreed_price===null||row.agreed_price===undefined?'':Number(row.agreed_price),
      status:titleCaseStatus(row.service_status||'active'),
      startDate:row.start_date||row?.metadata?.startDate||old?.startDate||'',
      note:row?.metadata?.note||old?.note||'',
      createdAt:row.created_at||old?.createdAt||new Date().toISOString()
    };
  }

  function mergeCloudClient(row,serviceRows,catalogMap,existing){
    const meta=row.metadata||{};
    const old=existing||{};
    const mappedServices=serviceRows.map(s=>mapCloudService(s,catalogMap,old.services||[]));
    const cloudControlsServices=serviceRows.length>0||!!meta.services_synced_at;
    return {
      ...old,
      id:meta.local_id||old.id||row.id,
      cloudId:row.id,
      business:row.business_name||old.business||'VMS Client',
      status:titleCaseStatus(row.status||old.status||'active'),
      industry:meta.industry??old.industry??'',
      website:meta.website??old.website??'',
      contact:row.contact_name??old.contact??'',
      email:row.owner_email||old.email||'',
      phone:row.phone??old.phone??'',
      since:meta.since??old.since??(row.created_at?String(row.created_at).slice(0,10):''),
      address:meta.address??old.address??'',
      note:meta.note??old.note??'',
      logo:old.logo||meta.logo_url||'',
      source:meta.source||old.source||'Supabase',
      preArchiveStatus:meta.preArchiveStatus||old.preArchiveStatus||'',
      onboardingStatus:row.onboarding_status||old.onboardingStatus||'not_invited',
      portalInvitedAt:row.portal_invited_at||old.portalInvitedAt||'',
      preferredContactMethod:row.preferred_contact_method||old.preferredContactMethod||'',
      preferredContactTime:row.preferred_contact_time||old.preferredContactTime||'',
      services:cloudControlsServices?mappedServices:(Array.isArray(old.services)?old.services:[]),
      auditLinks:Array.isArray(old.auditLinks)?old.auditLinks:[],
      qrLinks:Array.isArray(old.qrLinks)?old.qrLinks:[],
      projects:Array.isArray(old.projects)?old.projects:[],
      requests:Array.isArray(old.requests)?old.requests:[],
      activity:Array.isArray(old.activity)?old.activity:[],
      products:Array.isArray(old.products)?old.products:[],
      billing:old.billing||{plan:'',status:'Not Set',amount:'',standardAmount:'',cycle:'Monthly',lastPayment:'',nextPayment:'',note:'',promo:null,payments:[]}
    };
  }

  async function syncAdminClientLocalStore(opts={}){
    const path=location.pathname.toLowerCase();
    if(isLocal||!(path.includes('/admin/clients')||path.includes('/admin/billing')))return {changed:false};

    try{
      const {sb}=await requireAdminClient();
      const [{data:cloudClients,error:clientError},{data:cloudServices,error:serviceError},{data:catalog,error:catalogError}]=await Promise.all([
        sb.from('clients').select('*').order('created_at',{ascending:true}),
        sb.from('client_services').select('*').order('created_at',{ascending:true}),
        sb.from('service_catalog').select('id,name,kind,pricing_model,recurring_price,cadence')
      ]);
      if(clientError)throw clientError;
      if(serviceError)throw serviceError;
      if(catalogError)throw catalogError;

      const current=readClientStore();
      const catalogMap=new Map((catalog||[]).map(x=>[x.id,x]));
      const byEmail=new Map(current.filter(x=>x.email).map(x=>[cleanEmail(x.email),x]));
      const serviceByClient=new Map();
      for(const row of cloudServices||[]){
        if(!serviceByClient.has(row.client_id))serviceByClient.set(row.client_id,[]);
        serviceByClient.get(row.client_id).push(row);
      }

      const merged=(cloudClients||[]).map(row=>mergeCloudClient(row,serviceByClient.get(row.id)||[],catalogMap,byEmail.get(cleanEmail(row.owner_email))));
      const cloudEmails=new Set((cloudClients||[]).map(x=>cleanEmail(x.owner_email)));
      const unsyncedLocal=current.filter(x=>!x.email||!cloudEmails.has(cleanEmail(x.email)));
      const next=[...merged,...unsyncedLocal];
      const before=JSON.stringify(current);
      const after=JSON.stringify(next);
      const clientChanged=before!==after;
      const billingSync=syncBillingStoreFromCloud(cloudClients||[],cloudServices||[],catalog||[]);
      const changed=clientChanged||billingSync.changed;

      if(clientChanged)writeClientStore(next);
      if(changed){
        const hash=hashString(after+'|'+billingSync.hash);
        const previous=sessionStorage.getItem(CLIENT_CLOUD_GUARD_KEY);
        sessionStorage.setItem(CLIENT_CLOUD_GUARD_KEY,hash);
        if(opts.reload!==false&&previous!==hash){
          setTimeout(()=>location.reload(),40);
          return {changed:true,reloading:true};
        }
      }

      const status=document.querySelector('.status-pill');
      if(status)status.innerHTML='<span class="status-dot"></span> Supabase synced';
      return {changed,reloading:false};
    }catch(e){
      console.warn('VMS Admin client cloud bootstrap failed.',e);
      return {changed:false,error:e};
    }
  }

  function refreshInviteButtonState(){
    const button=document.getElementById('profilePortalInviteBtn');
    const email=(document.getElementById('infoEmail')?.textContent||'').trim();
    if(!button||!email||email==='—')return;
    const c=readClientStore().find(x=>cleanEmail(x.email)===cleanEmail(email));
    if(!c)return;
    const status=lower(c.onboardingStatus);
    if(status==='invited')button.textContent='Resend Portal Invite';
    else if(status==='active')button.textContent='Portal Active';
    else if(status==='needs_attention')button.textContent='Retry Portal Invite';
    else button.textContent='Invite to Client Portal';
  }

  function bootAdminClientCloud(){
    const path=location.pathname.toLowerCase();
    if(!(path.includes('/admin/clients')||path.includes('/admin/billing')))return;
    clearTimeout(adminCloudSyncTimer);
    adminCloudSyncTimer=setTimeout(()=>syncAdminClientLocalStore({reload:true}),650);
    setTimeout(()=>syncAdminClientLocalStore({reload:true}),1800);
    setTimeout(()=>syncAdminClientLocalStore({reload:true}),3500);
    window.addEventListener('focus',()=>syncAdminClientLocalStore({reload:true}));
    if(path.includes('/admin/clients')){
      document.addEventListener('click',e=>{
        if(e.target.closest('[data-open-profile],.view-client,.client-row,.client-card'))setTimeout(refreshInviteButtonState,80);
      });
      setInterval(refreshInviteButtonState,2500);
    }
  }

  /* ------------------------------------------------------------------
     Client Portal entitlements
     ------------------------------------------------------------------ */
  function serviceStatusAllowsAccess(row){
    const service=lower(row?.service_status);
    const billing=lower(row?.billing_status);
    if(!['active','completed'].includes(service))return false;
    if(['pending','unpaid','past_due','past due','paused','suspended','canceled','cancelled'].includes(billing))return false;
    return true;
  }

  function normalizeName(v){return String(v||'').replace(/\s+/g,' ').trim().toLowerCase()}
  function setText(el,value){if(!el)return;const text=String(value??'');if(el.textContent!==text)el.textContent=text}

  function expandEntitlements(rows,catalog){
    const byId=new Map(catalog.map(x=>[x.id,x]));
    const byName=new Map(catalog.map(x=>[normalizeName(x.name),x]));
    const ids=new Set();
    for(const row of rows.filter(serviceStatusAllowsAccess)){
      ids.add(row.service_key);
      const item=byId.get(row.service_key);
      for(const included of item?.included||[]){
        const clean=normalizeName(String(included).replace(/^\d+\s+months?\s+/i,''));
        const matched=byName.get(clean)||[...byName.entries()].find(([name])=>clean.includes(name)||name.includes(clean))?.[1];
        if(matched)ids.add(matched.id);
      }
    }
    if(ids.has('linkhub-pro')){
      ids.add('linkhub-core');ids.add('linkhub-wifi');ids.add('linkhub-menu');
    }
    return ids;
  }

  function setPortalNavAccess(section,allowed){
    const btn=document.querySelector(`#nav button[data-section="${section}"]`);
    if(btn)btn.hidden=!allowed;
    const sec=document.getElementById('section-'+section);
    if(sec&&!allowed&&sec.classList.contains('active')){
      const home=document.querySelector('#nav button[data-section="home"]');
      if(home)home.click();
    }
  }

  function money(v){
    return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:Number(v)%1?2:0,maximumFractionDigits:2}).format(Number(v)||0);
  }

  function cadenceShort(v){return /annual|year/i.test(String(v||''))?'yr':'mo'}
  function cadenceLong(v){return /annual|year/i.test(String(v||''))?'year':'month'}

  function applyPortalBilling(rows,catalog){
    const byId=new Map(catalog.map(x=>[x.id,x]));
    const recurring=rows.filter(serviceStatusAllowsAccess).filter(row=>{
      const cat=byId.get(row.service_key);
      return !!row.billing_cadence||cat?.pricing_model==='Recurring';
    });

    const planName=document.getElementById('billingPlanName');
    const standard=document.getElementById('billingStandardPrice');
    const status=document.getElementById('billingStatusText');
    const note=document.getElementById('billingPlanNote');
    if(!planName&&!standard&&!status)return;

    if(!recurring.length){
      if(planName)setText(planName,'No active recurring subscription');
      if(standard)setText(standard,'—');
      if(status)setText(status,'No subscription');
      if(note)setText(note,'Your active one-time VMS services and deliverables remain available in the Client Portal.');
      return;
    }

    if(recurring.length===1){
      const row=recurring[0];
      const cat=byId.get(row.service_key);
      const agreed=row.agreed_price!=null?Number(row.agreed_price):Number(cat?.recurring_price||0);
      const standardAmount=Number(cat?.recurring_price||agreed||0);
      const cadence=row.billing_cadence||cat?.cadence||'Monthly';
      if(planName)setText(planName,`${row.service_name||cat?.name||'VMS Subscription'} · ${money(agreed)}/${cadenceLong(cadence)}`);
      if(standard)setText(standard,`${money(standardAmount)}/${cadenceShort(cadence)}`);
      if(status)setText(status,'Active');
      return;
    }

    const monthly=recurring.filter(r=>!/annual|year/i.test(String(r.billing_cadence||byId.get(r.service_key)?.cadence||'')));
    const monthlyTotal=monthly.reduce((sum,row)=>sum+Number(row.agreed_price??byId.get(row.service_key)?.recurring_price??0),0);
    if(planName)setText(planName,`${recurring.length} active VMS subscriptions${monthly.length?` · ${money(monthlyTotal)}/month`:''}`);
    if(standard)setText(standard,monthly.length?`${money(monthly.reduce((sum,row)=>sum+Number(byId.get(row.service_key)?.recurring_price??row.agreed_price??0),0))}/mo`:'See plans');
    if(status)setText(status,'Active');
  }

  function applyPortalEntitlementDom(clientRow,rows,catalog){
    if(!clientRow)return;
    const byId=new Map(catalog.map(x=>[x.id,x]));
    const entitled=expandEntitlements(rows,catalog);
    const activeRows=rows.filter(serviceStatusAllowsAccess);

    const hasFamily=family=>[...entitled].some(id=>byId.get(id)?.metadata?.family===family);
    const qrAllowed=entitled.has('smart-qr')||hasFamily('qr');
    const linkhubAllowed=entitled.has('linkhub-core')||entitled.has('linkhub-pro');
    const auditAllowed=hasFamily('audit');
    const wifiAllowed=entitled.has('linkhub-wifi')||entitled.has('linkhub-pro');
    const menuAllowed=entitled.has('linkhub-menu')||entitled.has('linkhub-pro');

    setPortalNavAccess('qrs',qrAllowed);
    setPortalNavAccess('linkhub',linkhubAllowed);
    setPortalNavAccess('audits',auditAllowed);

    const wifiCard=document.getElementById('linkHubWifiFeatureCard');
    const menuCard=document.getElementById('linkHubMenuFeatureCard');
    const wifiEditor=document.getElementById('linkHubWifiFeatureEditor');
    const menuEditor=document.getElementById('linkHubMenuFeatureEditor');
    const wifiTab=document.querySelector('[data-linkhub-preview="wifi"]');
    const menuTab=document.querySelector('[data-linkhub-preview="menu"]');
    if(wifiCard)wifiCard.hidden=!wifiAllowed;
    if(menuCard)menuCard.hidden=!menuAllowed;
    if(wifiEditor&&!wifiAllowed)wifiEditor.hidden=true;
    if(menuEditor&&!menuAllowed)menuEditor.hidden=true;
    if(wifiTab)wifiTab.hidden=!wifiAllowed;
    if(menuTab)menuTab.hidden=!menuAllowed;

    const stats=document.querySelector('#section-linkhub .preview-stats');
    const analyticsAllowed=entitled.has('linkhub-pro')||[...entitled].some(id=>byId.get(id)?.metadata?.analyticsIncluded===true);
    if(stats)stats.hidden=!analyticsAllowed;

    const grid=document.getElementById('activeServiceGrid');
    if(grid){
      const activeKeys=new Set(activeRows.map(x=>x.service_key));
      grid.querySelectorAll('.service-card').forEach(card=>{
        const name=normalizeName(card.querySelector('.service-copy strong')?.textContent);
        const cat=catalog.find(x=>normalizeName(x.name)===name||normalizeName(x.name.replace(/^VMS\s+/i,''))===name);
        if(cat)card.hidden=!activeKeys.has(cat.id);
      });
    }

    const count=document.getElementById('homeActiveServiceCount');
    const names=document.getElementById('homeActiveServiceNames');
    if(count)setText(count,String(activeRows.length));
    if(names){
      const list=activeRows.slice(0,3).map(r=>(r.service_name||'VMS Service').replace(/^VMS\s+/i,''));
      setText(names,list.join(' · ')+(activeRows.length>3?' + more':'')||'No active services');
    }

    const sideName=document.querySelector('.side-client strong');
    const sideMeta=document.querySelector('.side-client span');
    if(sideName)setText(sideName,clientRow.business_name||'VMS Client');
    if(sideMeta)setText(sideMeta,clientRow.owner_email||'Active VMS Client');

    applyPortalBilling(rows,catalog);
  }

  async function syncPortalEntitlements(){
    if(isLocal||!location.pathname.startsWith('/portal'))return;
    try{
      const sb=await client();
      if(!sb)return;
      const {data:{session}}=await sb.auth.getSession();
      const email=cleanEmail(session?.user?.email);
      if(!email)return;

      const {data:clientRow,error:clientError}=await sb.from('clients').select('*').ilike('owner_email',email).maybeSingle();
      if(clientError||!clientRow)return;

      const [{data:rows,error:serviceError},{data:catalog,error:catalogError}]=await Promise.all([
        sb.from('client_services').select('*').eq('client_id',clientRow.id),
        sb.from('service_catalog').select('*').eq('status','Published')
      ]);
      if(serviceError)throw serviceError;
      if(catalogError)throw catalogError;
      applyPortalEntitlementDom(clientRow,rows||[],catalog||[]);
    }catch(e){console.warn('VMS Client Portal entitlement sync failed.',e)}
  }

  function schedulePortalEntitlementSync(){
    clearTimeout(portalEntitlementTimer);
    portalEntitlementTimer=setTimeout(syncPortalEntitlements,120);
  }

  function bootPortalEntitlements(){
    if(!location.pathname.startsWith('/portal'))return;
    setTimeout(syncPortalEntitlements,700);
    setTimeout(syncPortalEntitlements,1800);
    setTimeout(syncPortalEntitlements,3500);
    if(!portalEntitlementObserver&&document.body){
      portalEntitlementObserver=new MutationObserver(schedulePortalEntitlementSync);
      portalEntitlementObserver.observe(document.body,{childList:true,subtree:true});
    }
    window.addEventListener('focus',syncPortalEntitlements);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncPortalEntitlements()});
  }

  function bootSharedUi(){
    installLogoutControl();
    bootAdminClientCloud();
    bootPortalEntitlements();
  }

  installAdminClientFetchBridge();

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootSharedUi,{once:true});
  else bootSharedUi();

  async function api(path,options={}){
    const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    if(!r.ok){
      let m='Request failed';
      try{m=(await r.json()).error||m}catch{}
      throw new Error(m);
    }
    return r.json();
  }

  window.VMSAuth={magicLink,signOut,requireSession,client,getAdminRole,getMfaState,TEST_EMAIL,configReady};
  window.VMSApi={api};
  window.VMSClientCloud={syncLocalStore:syncAdminClientLocalStore,syncClient:directSyncClient,syncServices:directSyncServices,deleteClient:directDeleteClient};
  document.documentElement.classList.add('vms-suite-loaded');
})();
