import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin, supabaseEnv } from "./_shared/auth.mts";

type Row=Record<string,any>;
const clean=(v:any,n=2000)=>String(v??'').trim().slice(0,n);
function headers(json=false,prefer=''){const{serviceKey}=supabaseEnv();const h:Record<string,string>={apikey:serviceKey};if(!serviceKey.startsWith('sb_secret_'))h.Authorization=`Bearer ${serviceKey}`;if(json)h['Content-Type']='application/json';if(prefer)h.Prefer=prefer;return h}
async function db(path:string,init:RequestInit={}){const{url}=supabaseEnv();const h=new Headers(init.headers||{});Object.entries(headers(!!init.body)).forEach(([k,v])=>{if(!h.has(k))h.set(k,v)});return fetch(`${url}/rest/v1/${path}`,{...init,headers:h})}
async function read(path:string){const r=await db(path);const t=await r.text();if(!r.ok)throw Object.assign(new Error(`Client database read failed (${r.status})${t?`: ${t.slice(0,200)}`:''}`),{status:502});return t?JSON.parse(t):[]}
async function write(path:string,method:'POST'|'PATCH'|'DELETE',body?:any,prefer='return=representation'){const r=await db(path,{method,headers:prefer?{Prefer:prefer}:{},body:body==null?undefined:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Object.assign(new Error(`Client database update failed (${r.status})${t?`: ${t.slice(0,220)}`:''}`),{status:502});return t?JSON.parse(t):null}

function displayStatus(client:Row,services:Row[],subs:Row[],invoices:Row[],onboarding:Row|null){
  if(String(client.status||'').toLowerCase()==='archived')return 'Archived';
  const badSub=subs.some(s=>['past_due','unpaid','incomplete','incomplete_expired'].includes(String(s.status||'').toLowerCase()));
  const badService=services.some(s=>['past_due','failed','unpaid','incomplete','suspended'].includes(String(s.billing_status||'').toLowerCase()));
  const overdue=invoices.some(i=>String(i.status).toLowerCase()==='open'&&i.due_at&&new Date(i.due_at).getTime()<Date.now());
  if(badSub||badService||overdue)return 'Needs Attention';
  if(services.some(s=>['awaiting_payment','pending'].includes(String(s.billing_status||'').toLowerCase())))return 'Awaiting Payment';
  if(String(client.status||'').toLowerCase()==='paused')return 'Paused';
  if(onboarding&&['not_invited','in_progress'].includes(String(onboarding.status||''))&&services.length===0)return 'Needs Attention';
  return 'Active';
}

async function list(){
  const [clients,services,subs,invoices,payments,onboarding,tasks,jobs]=await Promise.all([
    read('clients?select=*&order=created_at.desc'),
    read('client_services?select=*&order=created_at.desc'),
    read('billing_subscriptions?select=*&order=created_at.desc'),
    read('billing_invoices?select=*&order=created_at.desc'),
    read('billing_payments?select=*&order=created_at.desc').catch(()=>[]),
    read('client_onboarding?select=*&order=updated_at.desc'),
    read('client_onboarding_tasks?select=*&order=created_at.asc'),
    read('service_jobs?select=*&order=created_at.desc')
  ]);
  const by=(rows:Row[],key:string)=>rows.reduce((m:Map<string,Row[]>,r:Row)=>{const k=String(r[key]||'');if(!m.has(k))m.set(k,[]);m.get(k)!.push(r);return m},new Map<string,Row[]>());
  const svc=by(services,'client_id'),sub=by(subs,'client_id'),inv=by(invoices,'client_id'),pay=by(payments,'client_id'),task=by(tasks,'client_id'),job=by(jobs,'client_id');
  const on=new Map((onboarding||[]).map((x:Row)=>[String(x.client_id),x]));
  return {clients:(clients||[]).map((c:Row)=>{const id=String(c.id),cs=svc.get(id)||[],bs=sub.get(id)||[],bi=inv.get(id)||[],o=on.get(id)||null;return {...c,display_status:displayStatus(c,cs,bs,bi,o),services:cs,subscriptions:bs,invoices:bi,payments:pay.get(id)||[],onboarding:o,onboarding_tasks:task.get(id)||[],jobs:job.get(id)||[]}})};
}

async function action(body:Row){const kind=clean(body.action,60);if(kind==='add'||kind==='update'){const id=clean(body.id,80);const payload:Row={business_name:clean(body.business_name,180)||'VMS Client',owner_email:clean(body.owner_email,240).toLowerCase(),contact_name:clean(body.contact_name,180)||null,phone:clean(body.phone,80)||null,status:clean(body.status,40).toLowerCase()||'active',preferred_contact_method:clean(body.preferred_contact_method,60)||null,preferred_contact_time:clean(body.preferred_contact_time,120)||null,metadata:typeof body.metadata==='object'&&body.metadata?body.metadata:{},updated_at:new Date().toISOString()};if(!payload.owner_email)throw Object.assign(new Error('Client email is required.'),{status:400});if(kind==='update'){if(!id)throw Object.assign(new Error('Client ID is required.'),{status:400});const rows=await write(`clients?id=eq.${encodeURIComponent(id)}`,'PATCH',payload);return rows?.[0]||null}const rows=await write('clients','POST',payload);return rows?.[0]||null}
  const id=clean(body.id,80);if(!id)throw Object.assign(new Error('Client ID is required.'),{status:400});
  if(kind==='archive'){const rows=await write(`clients?id=eq.${encodeURIComponent(id)}`,'PATCH',{status:'archived',updated_at:new Date().toISOString()});return rows?.[0]||null}
  if(kind==='restore'){const rows=await write(`clients?id=eq.${encodeURIComponent(id)}`,'PATCH',{status:'active',updated_at:new Date().toISOString()});return rows?.[0]||null}
  if(kind==='delete'){await write(`clients?id=eq.${encodeURIComponent(id)}`,'DELETE',undefined,'return=minimal');return {id,deleted:true}}
  if(kind==='service-status'){const serviceId=clean(body.service_id,80);if(!serviceId)throw Object.assign(new Error('Service ID is required.'),{status:400});const payload:Row={updated_at:new Date().toISOString()};if(body.service_status!=null)payload.service_status=clean(body.service_status,40).toLowerCase();if(body.billing_status!=null)payload.billing_status=clean(body.billing_status,40).toLowerCase();if(body.agreed_price!=null&&body.agreed_price!=='')payload.agreed_price=Number(body.agreed_price);const rows=await write(`client_services?id=eq.${encodeURIComponent(serviceId)}`,'PATCH',payload);return rows?.[0]||null}
  throw Object.assign(new Error('Unknown client action.'),{status:400});
}

export default async(req:Request)=>{try{await requireAdmin(req);if(req.method==='GET')return Response.json(await list());if(req.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405});return Response.json({ok:true,result:await action(await req.json().catch(()=>({})))})}catch(e){return jsonError(e)}};
export const config:Config={path:'/api/admin-clients'};
