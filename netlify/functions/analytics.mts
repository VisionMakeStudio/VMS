import type { Config } from '@netlify/functions';
import { jsonError, requireAdmin } from './_shared/auth.mts';
import { buildAnalytics, saveDailySnapshot } from './_shared/analytics.mts';

export default async(req:Request)=>{
  try{
    await requireAdmin(req);
    const u=new URL(req.url);
    if(req.method==='GET')return Response.json(await buildAnalytics(u.searchParams.get('range')||'30d'));
    if(req.method==='POST'){
      const body:any=await req.json().catch(()=>({}));
      if(body.action==='snapshot')return Response.json({ok:true,snapshot:await saveDailySnapshot()});
      return Response.json({error:'Unknown analytics action.'},{status:400});
    }
    return Response.json({error:'Method not allowed.'},{status:405});
  }catch(e){return jsonError(e)}
};
export const config:Config={path:'/api/analytics'};
