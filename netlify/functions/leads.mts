import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin, supabaseEnv } from "./_shared/auth.mts";

type AnyRow = Record<string, any>;
const ALLOWED_STAGES = new Set(["new", "contacted", "qualified", "won", "lost"]);

function headers(serviceKey: string, json = false, prefer = "") {
  const h: Record<string, string> = { apikey: serviceKey };
  if (!serviceKey.startsWith("sb_secret_")) h.Authorization = `Bearer ${serviceKey}`;
  if (json) h["Content-Type"] = "application/json";
  if (prefer) h.Prefer = prefer;
  return h;
}
const clean=(v:any,max=2000)=>String(v??"").trim().slice(0,max);
const cleanEmail=(v:any)=>clean(v,240).toLowerCase();
const stage=(v:any)=>{const s=clean(v,30).toLowerCase();return ALLOWED_STAGES.has(s)?s:"new"};
const score=(v:any)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(0,Math.min(100,n)):50};
const serviceIds=(v:any)=>[...new Set((Array.isArray(v)?v:[]).map(x=>clean(x,120)).filter(Boolean))].slice(0,40);
const slug=(v:any)=>clean(v,150).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"service";

async function db(path:string,init:RequestInit={}){const{url,serviceKey}=supabaseEnv();const h=new Headers(init.headers||{});for(const[k,v]of Object.entries(headers(serviceKey)))if(!h.has(k))h.set(k,v);if(init.body&&!h.has("Content-Type"))h.set("Content-Type","application/json");return fetch(`${url}/rest/v1/${path}`,{...init,headers:h})}
async function read(path:string){const r=await db(path);if(!r.ok)throw Object.assign(new Error(`CRM database read failed (${r.status}).`),{status:502});return r.json()}
async function write(path:string,method:"POST"|"PATCH"|"DELETE",body?:any,prefer="return=representation"){const r=await db(path,{method,headers:prefer?{Prefer:prefer}:{},body:body==null?undefined:JSON.stringify(body)});if(!r.ok){const d=await r.text().catch(()=>"");throw Object.assign(new Error(`CRM database update failed (${r.status})${d?`: ${d.slice(0,180)}`:""}`),{status:502})}const t=await r.text();return t?JSON.parse(t):null}
async function activity(leadId:string,clientId:string|null,title:string,detail="",needsAction=false,metadata:AnyRow={}){await write("activity_events","POST",{lead_id:leadId,client_id:clientId,event_type:"lead_activity",title,detail,needs_action:needsAction,resolved:!needsAction,metadata},"return=minimal")}
async function getLead(id:string){const rows=await read(`intake_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);if(!rows?.[0])throw Object.assign(new Error("Lead not found."),{status:404});return rows[0]}

async function syncFollowUpTask(lead:AnyRow,dueAt:string|null){const existing=await read(`crm_tasks?lead_id=eq.${encodeURIComponent(lead.id)}&task_type=eq.follow_up&status=eq.open&select=*&order=created_at.desc&limit=1`);const task=existing?.[0];if(!dueAt||["won","lost"].includes(stage(lead.status))){if(task?.id)await write(`crm_tasks?id=eq.${encodeURIComponent(task.id)}`,"PATCH",{status:"canceled",updated_at:new Date().toISOString()},"return=minimal");return null}const payload={lead_id:lead.id,client_id:lead.converted_client_id||null,title:`Follow up · ${lead.business_name||lead.email||"Lead"}`,task_type:"follow_up",priority:Number(lead.lead_score||50)>=80?"high":"normal",status:"open",due_at:dueAt,completed_at:null,note:`Preferred contact: ${lead.contact_method||"Not specified"}${lead.contact_time?` · ${lead.contact_time}`:""}`,metadata:{source:"phase5-crm"},updated_at:new Date().toISOString()};if(task?.id){const rows=await write(`crm_tasks?id=eq.${encodeURIComponent(task.id)}`,"PATCH",payload);return rows?.[0]||null}const rows=await write("crm_tasks","POST",payload);return rows?.[0]||null}

async function listAll(){const[leads,notes,activities,catalog,onboarding,tasks]=await Promise.all([read("intake_requests?select=*&order=created_at.desc"),read("lead_notes?select=*&order=created_at.desc&limit=1000"),read("activity_events?lead_id=not.is.null&select=*&order=created_at.desc&limit=1500"),read("service_catalog?select=id,name,category,pricing_model,one_time_price,recurring_price,cadence,status,sales_mode&order=display_order.asc"),read("client_onboarding?select=*&order=updated_at.desc"),read("client_onboarding_tasks?select=*&order=created_at.asc")]);return{leads,notes,activities,catalog,onboarding,tasks}}

async function updateLead(user:any,body:AnyRow){const id=clean(body.id,80),before=await getLead(id),nextStage=body.status==null?stage(before.status):stage(body.status);const payload:AnyRow={status:nextStage,contact_method:clean(body.contact_method??before.contact_method,60)||null,contact_time:clean(body.contact_time??before.contact_time,120)||null,follow_up_at:body.follow_up_at?new Date(body.follow_up_at).toISOString():null,lead_score:score(body.lead_score??before.lead_score),lost_reason:nextStage==="lost"?(clean(body.lost_reason??before.lost_reason,1200)||null):null,service_ids:serviceIds(body.service_ids??before.service_ids),internal_summary:clean(body.internal_summary??before.internal_summary,4000)||null,updated_at:new Date().toISOString()};const rows=await write(`intake_requests?id=eq.${encodeURIComponent(id)}`,"PATCH",payload),updated=rows?.[0]||{...before,...payload};await syncFollowUpTask(updated,payload.follow_up_at);if(stage(before.status)!==nextStage)await activity(id,before.converted_client_id||null,`Lead moved to ${nextStage}`,`Stage changed from ${stage(before.status)} to ${nextStage}.`,nextStage==="new"||nextStage==="contacted",{actor:user.id,action:"stage_change"});else await activity(id,before.converted_client_id||null,"Lead details updated","Follow-up, contact preferences, services, or internal summary were updated.",false,{actor:user.id,action:"update"});return updated}
async function addNote(user:any,body:AnyRow){const lead=await getLead(clean(body.id,80)),note=clean(body.note,5000);if(!note)throw Object.assign(new Error("Note cannot be empty."),{status:400});const rows=await write("lead_notes","POST",{lead_id:lead.id,note,created_by:user.id});await activity(lead.id,lead.converted_client_id||null,"Internal note added",note.slice(0,350),false,{actor:user.id,action:"note"});return rows?.[0]}

function paymentState(service:any){const model=String(service.pricing_model||"").toLowerCase();const amount=Number(/recurring/i.test(service.pricing_model||"")?service.recurring_price:service.one_time_price)||0;const free=model==="free"||amount<=0;return free?{service_status:"active",billing_status:"active",payment_required:false}:{service_status:"pending",billing_status:"awaiting_payment",payment_required:true}}

async function recomputeOnboarding(clientId:string){const all=await read(`client_onboarding_tasks?client_id=eq.${encodeURIComponent(clientId)}&select=status,required`);const required=(all||[]).filter((x:any)=>x.required!==false);const done=required.length>0&&required.every((x:any)=>x.status==="complete"||x.status==="waived");await write(`client_onboarding?client_id=eq.${encodeURIComponent(clientId)}`,"PATCH",{status:done?"complete":"in_progress",completed_at:done?new Date().toISOString():null,updated_at:new Date().toISOString()},"return=minimal");return done}

async function convertLead(user:any,body:AnyRow){const lead=await getLead(clean(body.id,80));if(lead.converted_client_id){const rows=await read(`clients?id=eq.${encodeURIComponent(lead.converted_client_id)}&select=*&limit=1`);return{client:rows?.[0]||{id:lead.converted_client_id},alreadyConverted:true}}const email=cleanEmail(lead.email);if(!email)throw Object.assign(new Error("Lead email is required before conversion."),{status:400});let existing=await read(`clients?owner_email=ilike.${encodeURIComponent(email)}&select=*&limit=1`),client=existing?.[0];const clientPayload={business_name:clean(lead.business_name,180)||"VMS Client",owner_email:email,contact_name:clean(lead.contact_name,180)||null,phone:clean(lead.phone,80)||null,status:"active",preferred_contact_method:lead.contact_method||null,preferred_contact_time:lead.contact_time||null,lead_source:lead.source||null,converted_at:new Date().toISOString()};if(client?.id){const rows=await write(`clients?id=eq.${encodeURIComponent(client.id)}`,"PATCH",clientPayload);client=rows?.[0]||{...client,...clientPayload}}else{const rows=await write("clients","POST",clientPayload);client=rows?.[0]}if(!client?.id)throw Object.assign(new Error("Client conversion did not return a client record."),{status:502});
  const ids=serviceIds(body.service_ids??lead.service_ids);let selectedCatalog:any[]=[];
  if(ids.length){
    const filter=ids.map((x:string)=>`id.eq.${x.replace(/[,()]/g,"")}`).join(",");
    selectedCatalog=(await read(`service_catalog?or=(${encodeURIComponent(filter)})&select=id,name,category,pricing_model,one_time_price,recurring_price,cadence,sales_mode,metadata`)) as AnyRow[];
    const current=(await read(`client_services?client_id=eq.${encodeURIComponent(client.id)}&select=id,catalog_service_id,service_key,billing_status,service_status,metadata`)) as AnyRow[];
    const byKey=new Map<string,AnyRow>();
    for(const row of current||[]){
      const catalogKey=clean(row.catalog_service_id,120);
      const serviceKey=clean(row.service_key,120);
      if(catalogKey)byKey.set(catalogKey,row);
      if(serviceKey)byKey.set(serviceKey,row);
    }
    for(const s of selectedCatalog||[]){
      const st=paymentState(s);
      const old:AnyRow|undefined=byKey.get(clean(s.id,120));
      const payload={
        client_id:client.id,
        service_key:s.id||slug(s.name),
        service_name:s.name,
        service_status:st.service_status,
        billing_status:st.billing_status,
        catalog_service_id:s.id,
        agreed_price:s.recurring_price??s.one_time_price??null,
        billing_cadence:s.cadence||null,
        price_locked:true,
        metadata:{
          ...(old?.metadata||{}),
          source:"phase5-lead-conversion",
          lead_id:lead.id,
          payment_required:st.payment_required,
          sales_mode:s.sales_mode||null,
          pricing_model:s.pricing_model||null,
          family:s.metadata?.family||null
        },
        updated_at:new Date().toISOString()
      };
      if(old?.id)await write(`client_services?id=eq.${encodeURIComponent(String(old.id))}`,"PATCH",payload,"return=minimal");
      else await write("client_services","POST",payload,"return=minimal");
    }
  }
  const now=new Date().toISOString();const onboardingRows=await write("client_onboarding","POST",{client_id:client.id,status:"in_progress",preferred_contact_method:lead.contact_method||null,preferred_contact_time:lead.contact_time||null,updated_at:now},"resolution=merge-duplicates,return=representation");const baseTasks=[["confirm-business-info","Confirm business & contact information"],["confirm-services","Confirm selected services and scope"],["collect-assets","Collect logo, photos, brand assets, and required access"],["contact-preferences","Confirm preferred contact method and time"],["portal-invite","Send Client Portal welcome / invitation"],["initial-setup-review","Complete initial VMS setup review"]];const taskRows=[...baseTasks.map(([key,title])=>({client_id:client.id,task_key:key,title,required:true,metadata:{source:"phase5"}})),...(selectedCatalog||[]).map((s:any)=>({client_id:client.id,task_key:`service-${slug(s.id)}`,title:`Set up ${s.name}`,required:true,metadata:{source:"phase5",service_id:s.id}}))];if(taskRows.length)await write("client_onboarding_tasks","POST",taskRows,"resolution=ignore-duplicates,return=minimal");await write(`intake_requests?id=eq.${encodeURIComponent(lead.id)}`,"PATCH",{status:"won",converted_client_id:client.id,converted_at:now,updated_at:now,service_ids:ids});await write(`crm_tasks?lead_id=eq.${encodeURIComponent(lead.id)}&task_type=eq.follow_up&status=eq.open`,"PATCH",{status:"canceled",updated_at:now},"return=minimal");await write(`activity_events?lead_id=eq.${encodeURIComponent(lead.id)}`,"PATCH",{client_id:client.id},"return=minimal");const awaiting=(selectedCatalog||[]).filter((s:any)=>paymentState(s).payment_required).length;await activity(lead.id,client.id,"Lead converted to client",awaiting?`${client.business_name} is now a VMS client with ${awaiting} service${awaiting===1?"":"s"} awaiting payment.`:`${client.business_name} is now an active VMS client.`,false,{actor:user.id,action:"convert",awaiting_payment:awaiting});return{client,onboarding:onboardingRows?.[0]||null,awaitingPayment:awaiting}}

async function updateTask(user:any,body:AnyRow){const id=clean(body.task_id,80),status=["pending","complete","waived"].includes(clean(body.status,20))?clean(body.status,20):"pending";const rows=await write(`client_onboarding_tasks?id=eq.${encodeURIComponent(id)}`,"PATCH",{status,completed_at:status==="complete"?new Date().toISOString():null,updated_at:new Date().toISOString()}),task=rows?.[0];if(!task)throw Object.assign(new Error("Onboarding task not found."),{status:404});await recomputeOnboarding(task.client_id);const linked=await read(`intake_requests?converted_client_id=eq.${encodeURIComponent(task.client_id)}&select=id&limit=1`);if(linked?.[0]?.id)await activity(linked[0].id,task.client_id,`Onboarding task ${status}`,task.title,false,{actor:user.id,action:"onboarding_task",task_id:task.id});return task}

async function sendInvite(req:Request,user:any,body:AnyRow){const lead=await getLead(clean(body.id,80));if(!lead.converted_client_id)throw Object.assign(new Error("Convert this lead to a client before sending the Portal invitation."),{status:400});const email=cleanEmail(lead.email);if(!email)throw Object.assign(new Error("Client email is required for Portal access."),{status:400});const{url,serviceKey}=supabaseEnv(),redirectTo=new URL("/portal/onboarding.html",new URL(req.url).origin).href,h=headers(serviceKey,true);const invite=await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,{method:"POST",headers:h,body:JSON.stringify({email,data:{business_name:lead.business_name,vms_client_id:lead.converted_client_id}})});const text=await invite.text();let result:any=text;try{result=JSON.parse(text)}catch{}let alreadyUser=false;if(!invite.ok){const message=String(result?.msg||result?.message||result?.error_description||result||"Could not invite this client.");if(/already|registered|exists/i.test(message))alreadyUser=true;else throw Object.assign(new Error(message),{status:invite.status||502})}const now=new Date().toISOString();await write(`client_onboarding?client_id=eq.${encodeURIComponent(lead.converted_client_id)}`,"PATCH",{portal_invited_at:now,welcome_sent_at:now,updated_at:now},"return=minimal");await write(`clients?id=eq.${encodeURIComponent(lead.converted_client_id)}`,"PATCH",{portal_invited_at:now,onboarding_status:"invited",updated_at:now},"return=minimal").catch(()=>null);const tasks=await read(`client_onboarding_tasks?client_id=eq.${encodeURIComponent(lead.converted_client_id)}&task_key=eq.portal-invite&select=id&limit=1`);if(tasks?.[0]?.id)await write(`client_onboarding_tasks?id=eq.${encodeURIComponent(tasks[0].id)}`,"PATCH",{status:"complete",completed_at:now,updated_at:now},"return=minimal");const done=await recomputeOnboarding(lead.converted_client_id);await write(`clients?id=eq.${encodeURIComponent(lead.converted_client_id)}`,"PATCH",{onboarding_status:done?"complete":"in_progress",updated_at:now},"return=minimal").catch(()=>null);await activity(lead.id,lead.converted_client_id,"Portal welcome sent",alreadyUser?"Client already has Portal authentication; magic-link sign-in is available.":`Portal invitation sent to ${email}.`,false,{actor:user.id,action:"portal_invite"});return{invited:!alreadyUser,alreadyUser,message:alreadyUser?"This email already has Portal access. They can use the Member Portal magic-link sign-in.":`Portal invitation sent to ${email}.`}}

/* Batch 4: leads added by hand in Admin (walk-ins, calls, referrals). */
async function createLead(user:any,body:AnyRow){const business=clean(body.business_name,160),email=cleanEmail(body.email);if(!business)throw Object.assign(new Error("Add the business name."),{status:400});if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Object.assign(new Error("Add a valid email address."),{status:400});
const rows=await write("intake_requests","POST",{business_name:business,contact_name:clean(body.contact_name,160)||null,email,phone:clean(body.phone,60)||null,website:clean(body.website,300)||null,goal:clean(body.goal,300)||null,message:clean(body.message,5000)||null,source:clean(body.source,80)||"Added by VMS",status:"new",stage:"new",metadata:{created_by:"admin",admin_email:user?.email||null}});const lead=rows?.[0];if(lead)await activity(lead.id,null,"Lead added by VMS",clean(body.source,80)||"Added by hand");return lead}
export default async(req:Request)=>{try{const user=await requireAdmin(req);if(req.method==="GET")return Response.json(await listAll());if(req.method!=="POST")return new Response("Method not allowed",{status:405});const body:AnyRow=await req.json(),action=clean(body.action,50);if(action==="create")return Response.json({ok:true,lead:await createLead(user,body)});if(action==="update")return Response.json({ok:true,lead:await updateLead(user,body)});if(action==="note")return Response.json({ok:true,note:await addNote(user,body)});if(action==="convert")return Response.json({ok:true,...await convertLead(user,body)});if(action==="onboarding-task")return Response.json({ok:true,task:await updateTask(user,body)});if(action==="invite")return Response.json({ok:true,...await sendInvite(req,user,body)});return Response.json({error:"Unknown CRM action."},{status:400})}catch(error){return jsonError(error)}};
export const config:Config={path:"/api/leads"};
