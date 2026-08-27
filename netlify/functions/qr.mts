import type {Config} from '@netlify/functions';
import {cleanUrl,code,err,json,requireIdentity,write} from './_shared/qr.mts';

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
    if(!admin)throw Object.assign(new Error('Admin access required.'),{status:403});
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
