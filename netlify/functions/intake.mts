import type { Config, Context } from "@netlify/functions";

function clean(value:any,max=5000){return String(value??"").trim().slice(0,max)}
function serviceIds(value:any){return [...new Set((Array.isArray(value)?value:[]).map(v=>clean(v,120)).filter(Boolean))].slice(0,40)}
function normalizeWebsite(value:any){const raw=clean(value,400);if(!raw)return "";if(/^https?:\/\//i.test(raw))return raw;if(/^\/\//.test(raw))return `https:${raw}`;return `https://${raw.replace(/^\/+/,"")}`}
function dbHeaders(secret:string,json=false,prefer=""){const h:Record<string,string>={apikey:secret};if(!secret.startsWith("sb_secret_"))h.Authorization=`Bearer ${secret}`;if(json)h["Content-Type"]="application/json";if(prefer)h.Prefer=prefer;return h}
function tracking(body:any){const out:Record<string,string>={};for(const key of ['promoCode','landingPath','utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const v=clean(body?.[key],key==='landingPath'?600:240);if(v)out[key.replace('promoCode','promo_code').replace('landingPath','landing_path')]=v}return out}

export default async(req:Request,_context:Context)=>{
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  try{
    const body:any=await req.json();
    if(!body?.businessName||!body?.email)return Response.json({error:"Business name and email are required."},{status:400});
    const selected=serviceIds(body.serviceIds),meta=tracking(body);
    const record={business_name:clean(body.businessName,160),contact_name:clean(body.contactName,160),email:clean(body.email,240).toLowerCase(),phone:clean(body.phone,80),website:normalizeWebsite(body.website),goal:clean(body.goal,240),contact_method:clean(body.contactMethod||"Email",60),contact_time:clean(body.contactTime,120)||null,service_ids:selected,message:clean(body.message,5000),status:"new",source:clean(body.source||"public-website",120),lead_score:selected.length?60:50,metadata:meta,updated_at:new Date().toISOString()};
    const url=Netlify.env.get("SUPABASE_URL"),secretKey=Netlify.env.get("SUPABASE_SECRET_KEY")||Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!secretKey)return Response.json({error:"VMS intake is not configured yet. Please email info@visionmakestudio.com."},{status:503});
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
