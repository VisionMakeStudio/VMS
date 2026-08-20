import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin, supabaseEnv } from "./_shared/auth.mts";

type Row=Record<string,any>;
const clean=(v:any,n=1000)=>String(v??"").trim().slice(0,n);

function headers(serviceKey:string,json=false,prefer=""){
  const h:Record<string,string>={apikey:serviceKey};
  if(!serviceKey.startsWith("sb_secret_"))h.Authorization=`Bearer ${serviceKey}`;
  if(json)h["Content-Type"]="application/json";
  if(prefer)h.Prefer=prefer;
  return h;
}
async function rest(path:string,init:RequestInit={}){
  const {url,serviceKey}=supabaseEnv();
  const h=new Headers(init.headers||{});
  Object.entries(headers(serviceKey,!!init.body)).forEach(([k,v])=>{if(!h.has(k))h.set(k,v)});
  return fetch(`${url}/rest/v1/${path}`,{...init,headers:h});
}
async function read(path:string){
  const r=await rest(path);const t=await r.text();
  if(!r.ok)throw Object.assign(new Error(`Audit database read failed (${r.status})${t?`: ${t.slice(0,220)}`:""}`),{status:502});
  return t?JSON.parse(t):[];
}
async function write(path:string,method:"POST"|"PATCH"|"DELETE",body?:any,prefer="return=representation"){
  const r=await rest(path,{method,headers:prefer?{Prefer:prefer}:{},body:body==null?undefined:JSON.stringify(body)});const t=await r.text();
  if(!r.ok)throw Object.assign(new Error(`Audit database update failed (${r.status})${t?`: ${t.slice(0,220)}`:""}`),{status:502});
  return t?JSON.parse(t):null;
}
async function clientIdForBusiness(businessName:string){
  if(!businessName)return null;
  const rows=await read(`clients?business_name=eq.${encodeURIComponent(businessName)}&select=id&limit=1`).catch(()=>[]);
  return Array.isArray(rows)&&rows[0]?.id?String(rows[0].id):null;
}

async function saveAudit(body:Row){
  const businessName=clean(body.business_name,180);
  if(!businessName)throw Object.assign(new Error("Business name is required."),{status:400});
  const localId=clean(body.local_id,160)||null;
  const record={
    client_id:await clientIdForBusiness(businessName),
    business_name:businessName,
    status:clean(body.status,40)||"draft",
    scores:body.scoring&&typeof body.scoring==="object"?body.scoring:{},
    findings:{
      industry:clean(body.industry,180),
      website_url:clean(body.website_url,600),
      google_url:clean(body.google_url,600),
      internal_notes:clean(body.internal_notes,5000),
      final_notes:body.final_notes&&typeof body.final_notes==="object"?body.final_notes:{},
      assessment_notes:body.assessment_notes&&typeof body.assessment_notes==="object"?body.assessment_notes:{},
      ai_audit:body.ai_audit&&typeof body.ai_audit==="object"?body.ai_audit:null,
      local_id:localId,
    },
    updated_at:new Date().toISOString(),
  };
  if(localId){
    const existing=await read(`audit_records?findings->>local_id=eq.${encodeURIComponent(localId)}&select=id&order=updated_at.desc&limit=1`).catch(()=>[]);
    if(existing?.[0]?.id){
      const rows=await write(`audit_records?id=eq.${encodeURIComponent(existing[0].id)}`,"PATCH",record);
      return rows?.[0]||null;
    }
  }
  const rows=await write("audit_records","POST",record);
  return rows?.[0]||null;
}

async function deleteAudit(body:Row){
  const id=clean(body.id,80),localId=clean(body.local_id,160);
  if(!id&&!localId)throw Object.assign(new Error("Audit ID is required."),{status:400});
  const filter=id?`id=eq.${encodeURIComponent(id)}`:`findings->>local_id=eq.${encodeURIComponent(localId)}`;
  const rows=await write(`audit_records?${filter}`,"DELETE",undefined,"return=representation");
  return {deleted:Array.isArray(rows)?rows.length:0,localId:localId||null,id:id||null};
}

export default async(req:Request)=>{
  try{
    await requireAdmin(req);
    if(req.method==="POST")return Response.json({ok:true,audit:await saveAudit(await req.json().catch(()=>({}))) });
    if(req.method==="DELETE")return Response.json({ok:true,...await deleteAudit(await req.json().catch(()=>({}))) });
    return Response.json({error:"Method not allowed."},{status:405});
  }catch(error){return jsonError(error)}
};

export const config:Config={path:"/api/audits"};
