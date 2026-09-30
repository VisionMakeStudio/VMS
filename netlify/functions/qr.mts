import type {Config} from '@netlify/functions';
import {cleanUrl,code,err,json,requireIdentity,write} from './_shared/qr.mts';


/* ---------------- Client self-service QR rules ----------------
   A signed-in client can create, edit, archive and delete ONLY their own QR codes,
   and only what their active services include:
     - static QR: VMS Smart QR (or any package that includes it) or anything with scan tracking
     - tracked (dynamic) QR: LinkHub Pro, or any bundle/package that includes LinkHub Pro
   client_id is always forced to the caller's own client. Admin behavior is unchanged. */
const ACTIVE_SERVICE=new Set(['active','published','enabled']);
const ACTIVE_BILLING=new Set(['active','paid','trialing','gifted','comped']);
const CLIENT_QR_LIMIT=25;
const CLIENT_QR_TYPES=new Set(['website','review','booking','social','menu','wifi','custom']);
const low=(v:any)=>String(v??'').trim().toLowerCase();
const enc=(v:any)=>encodeURIComponent(String(v??''));
async function qrEntitlement(clientId:string){
  const owned:any[]=await json(`client_services?client_id=eq.${enc(clientId)}&select=service_key,service_status,billing_status`);
  const keys=(owned||[]).filter(r=>ACTIVE_SERVICE.has(low(r.service_status))&&ACTIVE_BILLING.has(low(r.billing_status))).map(r=>String(r.service_key));
  const catalog:any[]=await json(`service_catalog?status=eq.Published&select=id,name,metadata,included`);
  const byId=new Map(catalog.map(c=>[String(c.id),c]));
  let staticQr=false,tracked=false;
  for(const key of keys){
    const c=byId.get(key);if(!c)continue;
    const inc=(Array.isArray(c.included)?c.included:[]).map((x:any)=>String(x));
    if(c.metadata?.family==='qr'||inc.some(x=>/smart qr/i.test(x)))staticQr=true;
    if(c.metadata?.analyticsIncluded===true||inc.some(x=>/smart scan activity|linkhub pro/i.test(x)))tracked=true;
  }
  return {static:staticQr||tracked,tracked};
}
async function clientQrAction(req:Request,id:any){
  const client=id.client;
  if(!client?.id)throw Object.assign(new Error('Your VMS client account is not set up yet. Please contact VMS.'),{status:403});
  const b=await req.json().catch(()=>({}));const action=String(b.action||'create');
  const own=async(qrId:string)=>{
    if(!qrId)throw Object.assign(new Error('QR id required.'),{status:400});
    const rows:any[]=await json(`qr_codes?id=eq.${enc(qrId)}&select=*&limit=1`);
    const row=rows?.[0];
    if(!row||String(row.client_id)!==String(client.id))throw Object.assign(new Error('That QR was not found on your account.'),{status:404});
    return row;
  };
  const type=(v:any)=>CLIENT_QR_TYPES.has(String(v))?String(v):'website';
  if(action==='create'){
    const destination=cleanUrl(b.destination);if(!destination)throw Object.assign(new Error('Enter a valid http/https destination.'),{status:400});
    const want=b.mode==='dynamic'?'dynamic':'static';
    const ent=await qrEntitlement(client.id);
    if(want==='dynamic'&&!ent.tracked)throw Object.assign(new Error('Your plan does not include tracked QR codes. LinkHub Pro adds scan tracking.'),{status:403});
    if(want==='static'&&!ent.static)throw Object.assign(new Error('Your account does not include QR codes yet. Add VMS Smart QR to create one.'),{status:403});
    const existing:any[]=await json(`qr_codes?client_id=eq.${enc(client.id)}&status=neq.archived&select=id&limit=${CLIENT_QR_LIMIT+1}`);
    if((existing||[]).length>=CLIENT_QR_LIMIT)throw Object.assign(new Error(`You have reached the limit of ${CLIENT_QR_LIMIT} QR codes. Delete one you no longer use, or contact VMS.`),{status:409});
    const payload={client_id:client.id,code:code(),name:String(b.name||'My QR').trim().slice(0,120),business_name:client.business_name||null,qr_type:type(b.qr_type),destination,mode:want,status:'active',cta:String(b.cta||'').trim().slice(0,120)||null,qr_color:String(b.qr_color||'#003049').slice(0,9),bg_color:String(b.bg_color||'#FFFFFF').slice(0,9),frame_style:'rounded',logo_data:null,metadata:{show_vms:true,phase:5,created_by:'client'}};
    const rows=await write('qr_codes','POST',payload);return Response.json({qr:rows?.[0]||null});
  }
  if(action==='update'){
    const row=await own(String(b.id||''));
    const destination=cleanUrl(b.destination);if(!destination)throw Object.assign(new Error('Enter a valid destination.'),{status:400});
    let mode=row.mode==='dynamic'?'dynamic':'static';
    if(mode==='static'&&b.mode==='dynamic'){const ent=await qrEntitlement(client.id);if(!ent.tracked)throw Object.assign(new Error('Your plan does not include tracked QR codes. LinkHub Pro adds scan tracking.'),{status:403});mode='dynamic'}
    const payload={name:String(b.name||row.name||'My QR').trim().slice(0,120),qr_type:type(b.qr_type||row.qr_type),destination,mode,cta:String(b.cta||'').trim().slice(0,120)||null,qr_color:String(b.qr_color||row.qr_color||'#003049').slice(0,9),bg_color:String(b.bg_color||row.bg_color||'#FFFFFF').slice(0,9),updated_at:new Date().toISOString()};
    const rows=await write(`qr_codes?id=eq.${enc(row.id)}`,'PATCH',payload);return Response.json({qr:rows?.[0]||null});
  }
  if(action==='archive'||action==='restore'){
    const row=await own(String(b.id||''));
    await write(`qr_codes?id=eq.${enc(row.id)}`,'PATCH',{status:action==='archive'?'archived':'active',updated_at:new Date().toISOString()});return Response.json({ok:true});
  }
  if(action==='delete'){
    const row=await own(String(b.id||''));
    await write(`qr_codes?id=eq.${enc(row.id)}`,'DELETE',undefined,'return=minimal');return Response.json({ok:true});
  }
  throw Object.assign(new Error('Unknown QR action.'),{status:400});
}

export default async(req:Request)=>{
  try{
    const id=await requireIdentity(req);const admin=id.role==='admin';
    if(req.method==='GET'){
      const clientId=admin?new URL(req.url).searchParams.get('client_id'):id.client?.id;
      if(!admin&&!clientId) return Response.json({qrs:[],scans:[],clients:[]});
      const filter=clientId?`client_id=eq.${encodeURIComponent(clientId)}&`:'';
      const qrs=await json(`qr_codes?${filter}select=*&order=created_at.desc&limit=250`);
      const qrIds=(qrs||[]).map((q:any)=>q.id);
      let scans:any[]=[];
      if(qrIds.length){const inList=qrIds.map((x:string)=>`"${x}"`).join(',');scans=await json(`qr_scan_events?qr_id=in.(${encodeURIComponent(inList)})&select=*&order=scanned_at.desc&limit=300`).catch(()=>[])}
      const clients=admin?await json('clients?select=id,business_name,owner_email,status&status=neq.archived&order=business_name.asc&limit=500').catch(()=>[]):[];
      return Response.json({qrs,scans,clients,role:id.role,client:id.client});
    }
    if(!admin){
      if(req.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405});
      return await clientQrAction(req,id);
    }
    if(req.method==='POST'){
      const b=await req.json().catch(()=>({}));const action=String(b.action||'create');
      if(action==='create'){
        const destination=cleanUrl(b.destination);if(!destination)throw Object.assign(new Error('Enter a valid http/https destination.'),{status:400});
        const payload={client_id:b.client_id||null,code:code(),name:String(b.name||'New QR').trim().slice(0,120),business_name:String(b.business_name||'').trim().slice(0,160)||null,qr_type:String(b.qr_type||'website'),destination,mode:b.mode==='dynamic'?'dynamic':'static',status:'active',cta:String(b.cta||'').trim().slice(0,120)||null,qr_color:String(b.qr_color||'#003049'),bg_color:String(b.bg_color||'#FFFFFF'),frame_style:String(b.frame_style||'rounded'),logo_data:b.logo_data?String(b.logo_data).slice(0,300000):null,metadata:{show_vms:b.show_vms!==false,phase:5}};
        const rows=await write('qr_codes','POST',payload);return Response.json({qr:rows?.[0]||null});
      }
      if(action==='update'){
        const qrId=String(b.id||'');if(!qrId)throw Object.assign(new Error('QR id required.'),{status:400});const destination=cleanUrl(b.destination);if(!destination)throw Object.assign(new Error('Enter a valid destination.'),{status:400});
        const payload={client_id:b.client_id||null,name:String(b.name||'QR').trim().slice(0,120),business_name:String(b.business_name||'').trim().slice(0,160)||null,qr_type:String(b.qr_type||'website'),destination,mode:b.mode==='dynamic'?'dynamic':'static',cta:String(b.cta||'').trim().slice(0,120)||null,qr_color:String(b.qr_color||'#003049'),bg_color:String(b.bg_color||'#FFFFFF'),frame_style:String(b.frame_style||'rounded'),logo_data:b.logo_data?String(b.logo_data).slice(0,300000):null,metadata:{...(b.metadata||{}),show_vms:b.show_vms!==false,phase:5},updated_at:new Date().toISOString()};
        const rows=await write(`qr_codes?id=eq.${encodeURIComponent(qrId)}`,'PATCH',payload);return Response.json({qr:rows?.[0]||null});
      }
      if(action==='archive'){await write(`qr_codes?id=eq.${encodeURIComponent(String(b.id||''))}`,'PATCH',{status:'archived',updated_at:new Date().toISOString()});return Response.json({ok:true})}
      if(action==='restore'){await write(`qr_codes?id=eq.${encodeURIComponent(String(b.id||''))}`,'PATCH',{status:'active',updated_at:new Date().toISOString()});return Response.json({ok:true})}
      if(action==='delete'){const qrId=String(b.id||'');if(!qrId)throw Object.assign(new Error('QR id required.'),{status:400});await write(`qr_codes?id=eq.${encodeURIComponent(qrId)}`,'DELETE',undefined,'return=minimal');return Response.json({ok:true})}
      throw Object.assign(new Error('Unknown QR action.'),{status:400});
    }
    return Response.json({error:'Method not allowed.'},{status:405});
  }catch(e){return err(e)}
};
export const config:Config={path:'/api/qr'};
