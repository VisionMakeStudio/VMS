import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin, supabaseEnv } from "./_shared/auth.mts";

type Row = Record<string, any>;
const clean = (v:any,n=500)=>String(v??"").trim().slice(0,n);

function headers(json=false,prefer=""){
  const { serviceKey } = supabaseEnv();
  const h:Record<string,string> = { apikey: serviceKey };
  if (!serviceKey.startsWith("sb_secret_")) h.Authorization = `Bearer ${serviceKey}`;
  if (json) h["Content-Type"] = "application/json";
  if (prefer) h.Prefer = prefer;
  return h;
}
async function db(path:string,init:RequestInit={}){
  const { url } = supabaseEnv();
  const h = new Headers(init.headers||{});
  Object.entries(headers(!!init.body)).forEach(([k,v])=>{ if(!h.has(k)) h.set(k,v); });
  return fetch(`${url}/rest/v1/${path}`,{...init,headers:h});
}
async function read(path:string){
  const r=await db(path); const t=await r.text();
  if(!r.ok) throw Object.assign(new Error(`Cleanup read failed (${r.status})${t?`: ${t.slice(0,220)}`:""}`),{status:502});
  return t?JSON.parse(t):[];
}
async function write(path:string,method:"DELETE"|"PATCH",body?:any,prefer="return=minimal"){
  const r=await db(path,{method,headers:prefer?{Prefer:prefer}:{},body:body==null?undefined:JSON.stringify(body)}); const t=await r.text();
  if(!r.ok) throw Object.assign(new Error(`Cleanup update failed (${r.status})${t?`: ${t.slice(0,220)}`:""}`),{status:502});
  return t?JSON.parse(t):null;
}
async function leadById(id:string){
  const rows=await read(`intake_requests?id=eq.${encodeURIComponent(id)}&select=id,business_name,contact_name,email,status,converted_client_id&limit=1`);
  if(!rows?.[0]) throw Object.assign(new Error("Lead not found."),{status:404});
  return rows[0] as Row;
}
async function stripeFootprint(clientId:string){
  const qs=[
    `billing_customers?client_id=eq.${encodeURIComponent(clientId)}&select=provider_customer_id&limit=1`,
    `billing_checkout_sessions?client_id=eq.${encodeURIComponent(clientId)}&select=provider_session_id&limit=1`,
    `billing_subscriptions?client_id=eq.${encodeURIComponent(clientId)}&select=provider_subscription_id&limit=1`,
    `billing_invoices?client_id=eq.${encodeURIComponent(clientId)}&select=provider_invoice_id&limit=1`,
    `billing_payments?client_id=eq.${encodeURIComponent(clientId)}&select=provider_payment_id&limit=1`,
  ];
  const rows=await Promise.all(qs.map(q=>read(q).catch(()=>[])));
  return rows.some(x=>Array.isArray(x)&&x.length>0);
}
async function inspectLead(id:string){
  const lead=await leadById(id);
  return {
    id:lead.id,
    businessName:lead.business_name||lead.contact_name||lead.email||"This lead",
    converted:!!lead.converted_client_id,
    clientId:lead.converted_client_id||null,
    canDeleteClient:lead.converted_client_id ? !(await stripeFootprint(String(lead.converted_client_id))) : false,
  };
}
async function removeLeadOnly(id:string){
  const lead=await leadById(id);
  if(!lead.converted_client_id){
    await write(`activity_events?lead_id=eq.${encodeURIComponent(id)}`,"DELETE").catch(()=>null);
  }
  await write(`automation_deliveries?source_type=eq.intake_request&source_id=eq.${encodeURIComponent(id)}`,"DELETE").catch(()=>null);
  await write(`intake_requests?id=eq.${encodeURIComponent(id)}`,"DELETE");
  return {id,deleted:true,clientPreserved:!!lead.converted_client_id};
}
async function removeLeadAndClient(id:string){
  const lead=await leadById(id);
  const clientId=clean(lead.converted_client_id,80);
  if(!clientId) return removeLeadOnly(id);
  if(await stripeFootprint(clientId)){
    throw Object.assign(new Error("This client already has Stripe billing history or a Stripe checkout. Archive the client instead of permanently deleting it so billing records are not orphaned."),{status:409,code:"billing_history"});
  }
  await write(`automation_deliveries?client_id=eq.${encodeURIComponent(clientId)}`,"DELETE").catch(()=>null);
  await write(`automation_deliveries?source_type=eq.intake_request&source_id=eq.${encodeURIComponent(id)}`,"DELETE").catch(()=>null);
  await write(`automation_event_queue?client_id=eq.${encodeURIComponent(clientId)}`,"DELETE").catch(()=>null);
  await write(`qr_scan_events?client_id=eq.${encodeURIComponent(clientId)}`,"DELETE").catch(()=>null);
  await write(`qr_codes?client_id=eq.${encodeURIComponent(clientId)}`,"DELETE").catch(()=>null);
  await write(`clients?id=eq.${encodeURIComponent(clientId)}`,"DELETE");
  await write(`intake_requests?id=eq.${encodeURIComponent(id)}`,"DELETE");
  return {id,clientId,deleted:true,clientDeleted:true};
}

export default async(req:Request)=>{
  try{
    await requireAdmin(req);
    if(req.method!=="POST") return Response.json({error:"Method not allowed."},{status:405});
    const body:Row=await req.json().catch(()=>({}));
    const action=clean(body.action,60),id=clean(body.id,80);
    if(!id) throw Object.assign(new Error("Lead ID is required."),{status:400});
    if(action==="inspect_lead") return Response.json({ok:true,lead:await inspectLead(id)});
    if(action==="delete_lead") return Response.json({ok:true,result:await removeLeadOnly(id)});
    if(action==="delete_lead_client") return Response.json({ok:true,result:await removeLeadAndClient(id)});
    return Response.json({error:"Unknown cleanup action."},{status:400});
  }catch(error){return jsonError(error)}
};

export const config:Config={path:"/api/admin-cleanup"};
