import type {Config} from '@netlify/functions';
import {db,device,err,json,write} from './_shared/qr.mts';

export default async(req:Request)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD')return Response.json({error:'Method not allowed.'},{status:405});
    const u=new URL(req.url),parts=u.pathname.split('/').filter(Boolean),code=String(parts.at(-1)||'').toLowerCase();
    if(!/^[a-z0-9]{8,24}$/.test(code))return new Response('QR not found',{status:404});
    const rows=await json(`qr_codes?code=eq.${encodeURIComponent(code)}&status=eq.active&select=*&limit=1`);const qr=rows?.[0];if(!qr)return new Response('QR not found',{status:404});
    if(req.method==='GET'&&qr.mode==='dynamic'){
      const ua=(req.headers.get('user-agent')||'').slice(0,500),kind=device(ua);
      if(kind!=='bot'){
        // Inserting the scan fires the Phase 4 trigger that atomically increments qr_codes.scan_count.
        await write('qr_scan_events','POST',{qr_id:qr.id,client_id:qr.client_id||null,device_type:kind,user_agent:ua,referrer:(req.headers.get('referer')||'').slice(0,500),metadata:{source:'dynamic_qr'}},'return=minimal').catch(()=>null);
        await write('activity_events','POST',{client_id:qr.client_id||null,event_type:'qr_scan',title:`QR scanned · ${qr.name}`,detail:`${kind}${qr.business_name?` · ${qr.business_name}`:''}`,needs_action:false,resolved:false},'return=minimal').catch(()=>null);
      }
    }
    return new Response(null,{status:302,headers:{Location:qr.destination,'Cache-Control':'no-store'}});
  }catch(e){return err(e)}
};
export const config:Config={path:'/q/:code'};
