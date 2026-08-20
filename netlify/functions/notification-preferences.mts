import type { Config } from '@netlify/functions';
import { jsonError, requireUser, supabaseEnv } from './_shared/auth.mts';

type Row=Record<string,any>;
const CATEGORY_FIELDS=['billing','scheduling','onboarding','project','files','client'];
function clean(v:any,max=500){return String(v??'').trim().slice(0,max)}
function lower(v:any){return clean(v,240).toLowerCase()}
function headers(secret:string,json=false,prefer=''){const h:Record<string,string>={apikey:secret};if(!secret.startsWith('sb_secret_'))h.Authorization=`Bearer ${secret}`;if(json)h['Content-Type']='application/json';if(prefer)h.Prefer=prefer;return h}
async function db(path:string,init:RequestInit={}){const{url,serviceKey}=supabaseEnv();const h=new Headers(init.headers||{});Object.entries(headers(serviceKey,!!init.body)).forEach(([k,v])=>{if(!h.has(k))h.set(k,v)});const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/${path}`,{...init,headers:h});const t=await r.text();if(!r.ok)throw Object.assign(new Error(`Notification preference request failed (${r.status})${t?`: ${t.slice(0,180)}`:''}`),{status:r.status>=500?502:r.status});return t?JSON.parse(t):null}
async function getClient(req:Request){const user=await requireUser(req),email=lower(user.email);if(!email)throw Object.assign(new Error('Your Portal account has no email address.'),{status:400});const rows=await db(`clients?owner_email=ilike.${encodeURIComponent(email)}&select=id,business_name,owner_email,status&limit=1`);const client=rows?.[0];if(!client?.id)throw Object.assign(new Error('Your VMS client account was not found.'),{status:404});return client}
function defaults(clientId:string){return{client_id:clientId,email_enabled:true,in_app_enabled:true,billing:true,scheduling:true,onboarding:true,project:true,files:true,client:true}}
export default async(req:Request)=>{
  try{
    const client=await getClient(req);
    if(req.method==='GET'){
      const rows=await db(`notification_preferences?client_id=eq.${encodeURIComponent(client.id)}&select=*&limit=1`),preferences={...defaults(client.id),...(rows?.[0]||{})};
      return Response.json({client,preferences,capabilities:{emailConfigured:!!Netlify.env.get('RESEND_API_KEY')}});
    }
    if(req.method!=='POST'&&req.method!=='PATCH')return Response.json({error:'Method not allowed.'},{status:405});
    const body:Row=await req.json().catch(()=>({})),patch:Row={client_id:client.id,updated_at:new Date().toISOString()};
    for(const field of ['email_enabled','in_app_enabled',...CATEGORY_FIELDS])if(typeof body[field]==='boolean')patch[field]=body[field];
    const rows=await db('notification_preferences?on_conflict=client_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(patch)});
    return Response.json({ok:true,client,preferences:{...defaults(client.id),...(rows?.[0]||patch)},capabilities:{emailConfigured:!!Netlify.env.get('RESEND_API_KEY')}});
  }catch(e){return jsonError(e)}
};
export const config:Config={path:'/api/notification-preferences'};
