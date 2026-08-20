import type { Config } from "@netlify/functions";
import { jsonError, requireUser, supabaseEnv } from "./_shared/auth.mts";

function headers(secret:string){const h:Record<string,string>={apikey:secret};if(!secret.startsWith('sb_secret_'))h.Authorization=`Bearer ${secret}`;return h}
async function get(url:string,secret:string,path:string){const r=await fetch(`${url}/rest/v1/${path}`,{headers:headers(secret)});if(!r.ok)throw Object.assign(new Error(`Could not load onboarding data (${r.status}).`),{status:502});return r.json()}

export default async(req:Request)=>{
  try{
    if(req.method!=="GET")return new Response("Method not allowed",{status:405});
    const user=await requireUser(req),email=String(user.email||"").trim().toLowerCase();
    if(!email)throw Object.assign(new Error("Your Portal account does not have an email address."),{status:400});
    const {url,serviceKey}=supabaseEnv();
    const clients=await get(url,serviceKey,`clients?owner_email=ilike.${encodeURIComponent(email)}&select=id,business_name,contact_name,owner_email,phone,status&limit=1`);
    const client=clients?.[0];
    if(!client)return Response.json({client:null,onboarding:null,tasks:[],services:[]});
    const [onboarding,tasks,services]=await Promise.all([
      get(url,serviceKey,`client_onboarding?client_id=eq.${encodeURIComponent(client.id)}&select=*&limit=1`),
      get(url,serviceKey,`client_onboarding_tasks?client_id=eq.${encodeURIComponent(client.id)}&select=*&order=created_at.asc`),
      get(url,serviceKey,`client_services?client_id=eq.${encodeURIComponent(client.id)}&select=id,service_name,service_status,billing_status,catalog_service_id,agreed_price,billing_cadence&order=created_at.asc`)
    ]);
    return Response.json({client,onboarding:onboarding?.[0]||null,tasks:tasks||[],services:services||[]});
  }catch(error){return jsonError(error)}
};
export const config:Config={path:"/api/onboarding"};
