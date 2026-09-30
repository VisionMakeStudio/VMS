import type { Config, Context } from "@netlify/functions";

function clean(value:any,max=5000){return String(value??"").trim().slice(0,max)}
function serviceIds(value:any){return [...new Set((Array.isArray(value)?value:[]).map(v=>clean(v,120)).filter(Boolean))].slice(0,40)}
function normalizeWebsite(value:any){const raw=clean(value,400);if(!raw)return "";if(/^https?:\/\//i.test(raw))return raw;if(/^\/\//.test(raw))return `https:${raw}`;return `https://${raw.replace(/^\/+/,"")}`}
function dbHeaders(secret:string,json=false,prefer=""){const h:Record<string,string>={apikey:secret};if(!secret.startsWith("sb_secret_"))h.Authorization=`Bearer ${secret}`;if(json)h["Content-Type"]="application/json";if(prefer)h.Prefer=prefer;return h}
function tracking(body:any){const out:Record<string,string>={};for(const key of ['promoCode','landingPath','utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const v=clean(body?.[key],key==='landingPath'?600:240);if(v)out[key.replace('promoCode','promo_code').replace('landingPath','landing_path')]=v}return out}


/* ---------- Spam protection ----------
   Real visitors load the form page, which fetches a signed token from GET /api/intake.
   Bots that post straight to the API have no valid token. Tokens are signed with a
   server-side secret, must be at least 4 seconds old (humans need longer to type),
   and expire after 4 hours. Extra layers: a hidden trap field, a per-address rate
   limit, and a one-hour duplicate check per email. */
const TOKEN_MIN_AGE_MS=4000,TOKEN_MAX_AGE_MS=4*60*60*1000;
const ipHits=new Map<string,number[]>();
function signingKey(){return Netlify.env.get("INTAKE_SIGNING_KEY")||Netlify.env.get("SUPABASE_SECRET_KEY")||Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}
async function hmacHex(message:string,key:string){
  const enc=new TextEncoder();
  const k=await crypto.subtle.importKey("raw",enc.encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",k,enc.encode(message));
  return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function issueToken(){const ts=String(Date.now());return `${ts}.${await hmacHex("vms-intake:"+ts,signingKey())}`}
async function tokenOk(token:any){
  const key=signingKey();if(!key)return true; // never lock real leads out if the site is mis-configured
  const [ts,sig]=String(token||"").split(".");
  if(!ts||!sig||!/^\d{10,15}$/.test(ts))return false;
  const expected=await hmacHex("vms-intake:"+ts,key);
  if(expected.length!==sig.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);
  if(diff!==0)return false;
  const age=Date.now()-Number(ts);
  return age>=TOKEN_MIN_AGE_MS&&age<=TOKEN_MAX_AGE_MS;
}
function rateLimited(ip:string){
  if(!ip)return false;
  const now=Date.now(),window=10*60*1000,list=(ipHits.get(ip)||[]).filter(t=>now-t<window);
  list.push(now);ipHits.set(ip,list);
  if(ipHits.size>2000){for(const [k,v] of ipHits){if(!v.some(t=>now-t<window))ipHits.delete(k)}}
  return list.length>5;
}
const quietSuccess=()=>Response.json({ok:true,saved:true,notified:false,leadId:null});

export default async(req:Request,context:Context)=>{
  if(req.method==="GET"){return Response.json({token:await issueToken()},{headers:{"Cache-Control":"no-store"}})}
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  try{
    const body:any=await req.json();
    // 1) hidden trap field: real people never fill it in
    if(clean(body?.companyWebsite,200))return quietSuccess();
    // 2) must carry a valid, aged token from a real page load
    if(!(await tokenOk(body?.intakeToken)))return Response.json({error:"Please refresh the page and try again."},{status:400});
    // 3) slow down repeat submissions from one address
    const ip=String((context as any)?.ip||req.headers.get("x-nf-client-connection-ip")||"");
    if(rateLimited(ip))return Response.json({error:"Too many requests. Please wait a few minutes and try again, or email info@visionmakestudio.com."},{status:429});
    if(!body?.businessName||!body?.email)return Response.json({error:"Business name and email are required."},{status:400});
    const selected=serviceIds(body.serviceIds),meta=tracking(body);
    const record={business_name:clean(body.businessName,160),contact_name:clean(body.contactName,160),email:clean(body.email,240).toLowerCase(),phone:clean(body.phone,80),website:normalizeWebsite(body.website),goal:clean(body.goal,240),contact_method:clean(body.contactMethod||"Email",60),contact_time:clean(body.contactTime,120)||null,service_ids:selected,message:clean(body.message,5000),status:"new",source:clean(body.source||"public-website",120),lead_score:selected.length?60:50,metadata:meta,updated_at:new Date().toISOString()};
    const url=Netlify.env.get("SUPABASE_URL"),secretKey=Netlify.env.get("SUPABASE_SECRET_KEY")||Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!secretKey)return Response.json({error:"VMS intake is not configured yet. Please email info@visionmakestudio.com."},{status:503});
    // 4) same email in the last hour = same person clicking twice; do not create another lead or email
    try{
      const since=new Date(Date.now()-60*60*1000).toISOString();
      const dupRes=await fetch(`${url}/rest/v1/intake_requests?email=eq.${encodeURIComponent(record.email)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`,{headers:dbHeaders(secretKey)});
      if(dupRes.ok){const found:any[]=await dupRes.json();if(found?.length)return Response.json({ok:true,saved:true,notified:false,leadId:found[0].id})}
    }catch{/* if the check fails, continue and save the lead */}
    const dbResponse=await fetch(`${url}/rest/v1/intake_requests`,{method:"POST",headers:dbHeaders(secretKey,true,"return=representation"),body:JSON.stringify(record)});
    if(!dbResponse.ok){const detail=await dbResponse.text();console.error("VMS intake database write failed",dbResponse.status,detail);return Response.json({error:"Your request could not be saved. Please try again or email VMS."},{status:502})}
    const rows:any[]=await dbResponse.json(),leadId=rows?.[0]?.id||null;if(!leadId)throw new Error("Lead save did not return an ID.");
    const serviceDetail=selected.length?` · ${selected.length} selected service${selected.length===1?'':'s'}`:'';
    await fetch(`${url}/rest/v1/activity_events`,{method:"POST",headers:dbHeaders(secretKey,true,"return=minimal"),body:JSON.stringify({lead_id:leadId,event_type:"lead_activity",title:`New lead · ${record.business_name}`,detail:`${record.contact_name||record.email} submitted a website inquiry${serviceDetail}.`,needs_action:true,resolved:false,metadata:{source:record.source,action:"new_lead",service_ids:selected,promo_code:meta.promo_code||null}})}).catch(()=>null);
    const subject=`New VMS Lead — ${record.business_name}`;
    const message=`New website lead\n\nBusiness: ${record.business_name}\nContact: ${record.contact_name||'—'}\nEmail: ${record.email}\nPhone: ${record.phone||'—'}\nWebsite: ${record.website||'—'}\nGoal: ${record.goal||'—'}\nPreferred contact: ${record.contact_method}${record.contact_time?` · ${record.contact_time}`:""}\nSelected services: ${selected.join(', ')||'General inquiry'}\nPromotion: ${meta.promo_code||'None'}\nSource: ${record.source}\n\n${record.message||''}`;
    const queue=await fetch(`${url}/rest/v1/automation_event_queue`,{method:"POST",headers:dbHeaders(secretKey,true,"return=minimal"),body:JSON.stringify({rule_key:"new_lead_admin",event_key:`new-lead:${leadId}`,client_id:null,source_type:"lead",source_id:leadId,subject,message,needs_action:true,metadata:{lead_id:leadId,reply_to:record.email,service_ids:selected,url:`${new URL(req.url).origin}/admin/leads.html`,button_label:'Open CRM Lead'},status:"pending",next_attempt_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
    const notified=queue.ok;if(!queue.ok)console.error("VMS intake notification queue failed",queue.status,await queue.text());
    return Response.json({ok:true,saved:true,notified,leadId});
  }catch(error:any){console.error("VMS intake failed",error);return Response.json({error:error?.message||"Request could not be submitted."},{status:500})}
};
export const config:Config={path:"/api/intake"};
