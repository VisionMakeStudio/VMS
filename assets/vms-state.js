/* VMS cross-device state bridge for legacy Admin/Portal tools.
   Keeps the existing proven UI/data models while persisting each tool state in Supabase.
   Client portal local state is owner-scoped so one signed-in client can never inherit
   another client's local workspace state on a shared browser/device. */
(()=>{
  const nativeGet=Storage.prototype.getItem;
  const nativeSet=Storage.prototype.setItem;
  const nativeRemove=Storage.prototype.removeItem;
  let started=false, scope='', keys=new Set(), suppress=false, userEmail='';
  const isHosted=location.protocol!=='file:';
  const CLIENT_OWNER_MARKER='vms_client_state_owner_v1';
  const ADMIN_KEYS=[
    'vms_clients_final_v1','vms_billing_subscriptions_v3','vms_work_admin_v2','vms_work_admin_v1',
    'vms_notifications_activity_v2','vms_notifications_activity_v1','vms_files_assets_v2','vms_files_assets_v1',
    'vms_linkhub_admin_v2','vms_linkhub_admin_v1','vms_promotions_v2','vms_service_catalog_v2','vms_service_catalog_demo_v1',
    'vms_phase3_history_v1','vms_phase3_current_v1','vms_phase5_requests_v1','vms_qr_saved_library_v3',
    'vms_qr_tools_v4','vms_qr_tools_final_v1','vms_qr_codes_v1','vms_saved_qrs_v1'
  ];
  const CLIENT_KEYS=['vms_client_portal_v4','vms_client_bridge_v1'];

  function localGet(k){return nativeGet.call(localStorage,k)}
  function localSet(k,v){suppress=true;try{nativeSet.call(localStorage,k,v)}finally{suppress=false}}
  function localRemove(k){suppress=true;try{nativeRemove.call(localStorage,k)}finally{suppress=false}}
  function validConfig(){const c=window.VMS_CONFIG||{};return !!(c.supabaseUrl&&c.supabaseAnonKey&&!String(c.supabaseUrl).includes('PASTE_')&&!String(c.supabaseAnonKey).includes('PASTE_'))}
  async function sb(){if(!validConfig()||!window.VMSAuth?.client)return null;try{return await VMSAuth.client()}catch{return null}}

  function protectClientOwner(nextEmail){
    const clean=String(nextEmail||'').trim().toLowerCase();
    if(!clean)return false;
    const previous=String(localGet(CLIENT_OWNER_MARKER)||'').trim().toLowerCase();
    let cleared=false;
    if(previous&&previous!==clean){
      for(const key of CLIENT_KEYS){if(localGet(key)!=null){localRemove(key);cleared=true}}
      for(const key of Object.keys(sessionStorage)){if(key.startsWith('vms_state_hydrated_client:'))sessionStorage.removeItem(key)}
    }
    localSet(CLIENT_OWNER_MARKER,clean);
    return cleared;
  }

  async function upsert(key,value){
    if(!isHosted||!scope||!keys.has(key)||!validConfig())return;
    const client=await sb();if(!client)return;
    let payload;try{payload=JSON.parse(value)}catch{payload=value}
    const {error}=await client.from('workspace_state').upsert({scope,state_key:key,payload,owner_email:userEmail||null,updated_at:new Date().toISOString()},{onConflict:'scope,state_key'});
    if(error)console.warn('VMS cloud state save failed',key,error.message||error);
  }
  async function removeCloud(key){const client=await sb();if(!client||!scope)return;const {error}=await client.from('workspace_state').delete().eq('scope',scope).eq('state_key',key);if(error)console.warn('VMS cloud state delete failed',key,error.message||error)}
  function installPatch(){
    if(started)return;started=true;
    Storage.prototype.setItem=function(k,v){const result=nativeSet.call(this,k,v);if(this===localStorage&&!suppress&&keys.has(String(k)))queueMicrotask(()=>upsert(String(k),String(v)));return result};
    Storage.prototype.removeItem=function(k){const result=nativeRemove.call(this,k);if(this===localStorage&&!suppress&&keys.has(String(k)))queueMicrotask(()=>removeCloud(String(k)));return result};
  }
  async function hydrate(){
    if(!isHosted||!validConfig())return false;
    const client=await sb();if(!client)return false;
    const {data,error}=await client.from('workspace_state').select('state_key,payload,updated_at').eq('scope',scope).in('state_key',[...keys]);
    if(error){console.warn('VMS cloud state hydrate failed',error.message||error);return false}
    const cloud=new Map((data||[]).map(r=>[r.state_key,r]));
    let changed=false;
    for(const key of keys){
      const row=cloud.get(key),local=localGet(key);
      if(row){
        const serialized=typeof row.payload==='string'?row.payload:JSON.stringify(row.payload);
        if(local!==serialized){localSet(key,serialized);changed=true}
      }else if(local!=null){
        await upsert(key,local);
      }
    }
    return changed;
  }
  async function start(opts={}){
    const user=opts.user||null;
    userEmail=String(opts.email||user?.email||'').toLowerCase();
    const isAdmin=opts.scope==='admin';
    if(!isAdmin)protectClientOwner(userEmail);
    scope=isAdmin?'admin':`client:${userEmail||'preview'}`;
    keys=new Set(opts.keys||(isAdmin?ADMIN_KEYS:CLIENT_KEYS));
    installPatch();
    const marker=`vms_state_hydrated_${scope}`;
    if(sessionStorage.getItem(marker)==='1')return {changed:false,scope};
    const changed=await hydrate();
    sessionStorage.setItem(marker,'1');
    if(changed&&opts.reload!==false){location.reload();return {changed:true,reloading:true,scope}}
    return {changed,scope};
  }
  window.VMSState={start,hydrate,ADMIN_KEYS,CLIENT_KEYS,scope:()=>scope};
})();
