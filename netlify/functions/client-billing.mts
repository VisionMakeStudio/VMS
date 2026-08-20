import type { Config } from "@netlify/functions";
import { jsonError, requireClient, supabaseJson } from "./_shared/billing.mts";

export default async(req:Request)=>{
  if(req.method!=='GET')return Response.json({error:'Method not allowed.'},{status:405});
  try{
    const {client}=await requireClient(req);
    const [services,catalog,subs,invoices,payments]=await Promise.all([
      supabaseJson(`client_services?client_id=eq.${encodeURIComponent(client.id)}&select=*&order=created_at.desc`),
      supabaseJson('service_catalog?status=eq.Published&select=id,name,pricing_model,one_time_price,recurring_price,cadence,sales_mode,portal_visible,metadata'),
      supabaseJson(`billing_subscriptions?client_id=eq.${encodeURIComponent(client.id)}&select=*&order=created_at.desc`),
      supabaseJson(`billing_invoices?client_id=eq.${encodeURIComponent(client.id)}&select=*&order=created_at.desc`),
      supabaseJson(`billing_payments?client_id=eq.${encodeURIComponent(client.id)}&select=*&order=created_at.desc`).catch(()=>[])
    ]);
    return Response.json({client,services,catalog,subscriptions:subs,invoices,payments});
  }catch(e){return jsonError(e)}
};
export const config:Config={path:'/api/client-billing'};
