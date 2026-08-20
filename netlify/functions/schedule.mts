import type { Config } from "@netlify/functions";
import { jsonError, requireUser, supabaseEnv } from "./_shared/auth.mts";

type Row = Record<string, any>;
const TZ = "America/New_York";
const JOB_STATUSES = new Set(["draft","scheduled","confirmed","in_progress","post_production","ready","completed","canceled"]);
const PRIORITIES = new Set(["low","normal","high","urgent"]);
const LOCATIONS = new Set(["onsite","remote","studio","other"]);
const REQUEST_TYPES = new Set(["new","reschedule","cancel"]);

function clean(v:any,max=4000){return String(v??"").trim().slice(0,max)}
function lower(v:any){return clean(v,240).toLowerCase()}
function dateIso(v:any,required=false){
  if(v==null||v===""){if(required)throw Object.assign(new Error("A date and time are required."),{status:400});return null}
  const d=new Date(v);if(Number.isNaN(d.getTime()))throw Object.assign(new Error("Invalid date or time."),{status:400});return d.toISOString()
}
function headers(secret:string,json=false,prefer=""){
  const h:Record<string,string>={apikey:secret};
  if(!secret.startsWith("sb_secret_"))h.Authorization=`Bearer ${secret}`;
  if(json)h["Content-Type"]="application/json";
  if(prefer)h.Prefer=prefer;
  return h;
}
async function db(path:string,init:RequestInit={}){
  const {url,serviceKey}=supabaseEnv();
  const h=new Headers(init.headers||{});
  Object.entries(headers(serviceKey)).forEach(([k,v])=>{if(!h.has(k))h.set(k,v)});
  if(init.body&&!h.has("Content-Type"))h.set("Content-Type","application/json");
  return fetch(`${url}/rest/v1/${path}`,{...init,headers:h});
}
async function read(path:string){
  const r=await db(path);if(!r.ok){const t=await r.text().catch(()=>"");throw Object.assign(new Error(`Scheduling database read failed (${r.status})${t?`: ${t.slice(0,180)}`:""}`),{status:502})}
  return r.json();
}
async function write(path:string,method:"POST"|"PATCH"|"DELETE",body?:any,prefer="return=representation"){
  const r=await db(path,{method,headers:prefer?{Prefer:prefer}:{},body:body==null?undefined:JSON.stringify(body)});
  if(!r.ok){const t=await r.text().catch(()=>"");throw Object.assign(new Error(`Scheduling database update failed (${r.status})${t?`: ${t.slice(0,180)}`:""}`),{status:502})}
  const t=await r.text();return t?JSON.parse(t):null;
}
async function actor(req:Request){
  const user=await requireUser(req);
  const rows=await read(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`);
  const admin=rows?.[0]?.role==="admin";
  let client:any=null;
  if(!admin){
    const email=lower(user.email);
    if(!email)throw Object.assign(new Error("Your Portal account has no email address."),{status:400});
    const clients=await read(`clients?owner_email=ilike.${encodeURIComponent(email)}&select=*&limit=1`);
    client=clients?.[0]||null;
  }
  return {user,admin,client};
}
function requireAdmin(a:any){if(!a.admin)throw Object.assign(new Error("VMS Admin access required."),{status:403})}
function requireClient(a:any){if(!a.client?.id)throw Object.assign(new Error("No VMS client profile is linked to this Portal account."),{status:403})}
async function activity(clientId:string,title:string,detail:string,needsAction=false,metadata:Row={}){
  await write("activity_events","POST",{client_id:clientId,event_type:"schedule_activity",title,detail,needs_action:needsAction,resolved:!needsAction,metadata},"return=minimal");
}
function overlaps(aStart:string,aEnd:string,bStart:string,bEnd:string){
  return new Date(aStart).getTime()<new Date(bEnd).getTime()&&new Date(aEnd).getTime()>new Date(bStart).getTime();
}
async function conflict(start:string,end:string,excludeId:string|null=null){
  const jobs:any[]=await read("service_jobs?status=not.in.(completed,canceled)&scheduled_start=not.is.null&scheduled_end=not.is.null&select=id,title,scheduled_start,scheduled_end,assigned_to,status");
  return jobs.find(j=>j.id!==excludeId&&overlaps(start,end,j.scheduled_start,j.scheduled_end))||null;
}
async function listAdmin(){
  const [jobs,requests,clients,services,catalog,rules,blackouts]=await Promise.all([
    read("service_jobs?select=*&order=scheduled_start.asc.nullslast"),
    read("booking_requests?select=*&order=created_at.desc"),
    read("clients?status=neq.archived&select=id,business_name,contact_name,owner_email,phone,status&order=business_name.asc"),
    read("client_services?service_status=eq.active&select=id,client_id,catalog_service_id,service_name,agreed_price,billing_cadence&order=created_at.asc"),
    read("service_catalog?status=eq.Published&select=id,name,category,pricing_model,one_time_price,recurring_price,cadence&order=display_order.asc"),
    read("availability_rules?select=*&order=weekday.asc,start_time.asc"),
    read("schedule_blackouts?select=*&order=starts_at.asc")
  ]);
  return {mode:"admin",jobs,requests,clients,services,catalog,rules,blackouts};
}
async function listClient(a:any){
  requireClient(a);const id=a.client.id;
  const [jobs,requests,services,rules,blackouts]=await Promise.all([
    read(`service_jobs?client_id=eq.${encodeURIComponent(id)}&client_visible=eq.true&status=neq.draft&select=*&order=scheduled_start.asc.nullslast`),
    read(`booking_requests?client_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc`),
    read(`client_services?client_id=eq.${encodeURIComponent(id)}&service_status=eq.active&select=id,catalog_service_id,service_name,billing_cadence&order=created_at.asc`),
    read("availability_rules?active=eq.true&select=id,weekday,start_time,end_time,timezone,catalog_service_id,slot_minutes,buffer_minutes,lead_time_hours&order=weekday.asc,start_time.asc"),
    read("schedule_blackouts?ends_at=gte.now()&select=starts_at,ends_at&order=starts_at.asc")
  ]);
  return {mode:"client",client:a.client,jobs,requests,services,rules,blackouts};
}
async function saveJob(a:any,b:Row){
  requireAdmin(a);
  const id=clean(b.id,80)||null,clientId=clean(b.client_id,80);
  if(!clientId)throw Object.assign(new Error("Choose a client."),{status:400});
  const start=dateIso(b.scheduled_start,true)!,end=dateIso(b.scheduled_end,true)!;
  if(new Date(end).getTime()<=new Date(start).getTime())throw Object.assign(new Error("End time must be after start time."),{status:400});
  const c=await conflict(start,end,id);
  if(c&&!b.allow_conflict)throw Object.assign(new Error(`Schedule conflict with "${c.title}".`),{status:409,conflict:c});
  const catalogId=clean(b.catalog_service_id,120)||null;
  let serviceName=clean(b.service_name,180);
  if(!serviceName&&catalogId){
    const rows=await read(`service_catalog?id=eq.${encodeURIComponent(catalogId)}&select=name&limit=1`);serviceName=rows?.[0]?.name||"VMS Service";
  }
  if(!serviceName)serviceName="VMS Service";
  const st=JOB_STATUSES.has(clean(b.status,30))?clean(b.status,30):"scheduled";
  const pr=PRIORITIES.has(clean(b.priority,30))?clean(b.priority,30):"normal";
  const loc=LOCATIONS.has(clean(b.location_type,30))?clean(b.location_type,30):"onsite";
  const payload={
    client_id:clientId,catalog_service_id:catalogId,service_name:serviceName,title:clean(b.title,180)||serviceName,
    status:st,priority:pr,scheduled_start:start,scheduled_end:end,timezone:clean(b.timezone,80)||TZ,
    location_type:loc,address:clean(b.address,500)||null,assigned_to:clean(b.assigned_to,160)||null,
    client_notes:clean(b.client_notes,3000)||null,internal_notes:clean(b.internal_notes,3000)||null,
    reminder_at:b.reminder_at?dateIso(b.reminder_at):null,client_visible:b.client_visible!==false,
    source:clean(b.source,80)||"admin",completed_at:st==="completed"?new Date().toISOString():null,
    canceled_at:st==="canceled"?new Date().toISOString():null,updated_at:new Date().toISOString()
  };
  const rows=id?await write(`service_jobs?id=eq.${encodeURIComponent(id)}`,"PATCH",payload):await write("service_jobs","POST",payload);
  const job=rows?.[0];if(!job)throw Object.assign(new Error("The job could not be saved."),{status:502});
  await activity(clientId,id?"Service job updated":"Service job scheduled",`${job.title} · ${new Date(start).toLocaleString("en-US")}`,false,{job_id:job.id,action:id?"job_update":"job_create"});
  return {job,conflict:c||null};
}
async function jobStatus(a:any,b:Row){
  requireAdmin(a);const id=clean(b.id,80),st=clean(b.status,40);
  if(!id||!JOB_STATUSES.has(st))throw Object.assign(new Error("Valid job and status required."),{status:400});
  const old=(await read(`service_jobs?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0];
  if(!old)throw Object.assign(new Error("Job not found."),{status:404});
  const now=new Date().toISOString(),rows=await write(`service_jobs?id=eq.${encodeURIComponent(id)}`,"PATCH",{
    status:st,completed_at:st==="completed"?now:null,canceled_at:st==="canceled"?now:null,updated_at:now
  });
  await activity(old.client_id,"Service status updated",`${old.title} is now ${st.replace(/_/g," ")}.`,false,{job_id:id,action:"status",status:st});
  return rows?.[0];
}
async function bookingRequest(a:any,b:Row){
  requireClient(a);
  const type=REQUEST_TYPES.has(clean(b.request_type,30))?clean(b.request_type,30):"new";
  const clientId=a.client.id,jobId=clean(b.job_id,80)||null;
  let serviceId=clean(b.catalog_service_id,120)||null,serviceName=clean(b.service_name,180)||null;
  if(type!=="new"){
    const job=(await read(`service_jobs?id=eq.${encodeURIComponent(jobId||"none")}&client_id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`))?.[0];
    if(!job)throw Object.assign(new Error("That scheduled service is not linked to your account."),{status:404});
    serviceId=job.catalog_service_id;serviceName=job.service_name;
  }else{
    if(!serviceId)throw Object.assign(new Error("Choose a service."),{status:400});
    const assigned=(await read(`client_services?client_id=eq.${encodeURIComponent(clientId)}&catalog_service_id=eq.${encodeURIComponent(serviceId)}&service_status=eq.active&select=service_name&limit=1`))?.[0];
    if(!assigned)throw Object.assign(new Error("That service is not active on your VMS account."),{status:403});
    serviceName=assigned.service_name;
  }
  let start:null|string=null,end:null|string=null,alt:null|string=null;
  if(type!=="cancel"){
    start=dateIso(b.requested_start,true);end=dateIso(b.requested_end,true);
    if(new Date(end!).getTime()<=new Date(start!).getTime())throw Object.assign(new Error("End time must be after start time."),{status:400});
    alt=b.alternate_start?dateIso(b.alternate_start):null;
  }
  const loc=LOCATIONS.has(clean(b.location_type,30))?clean(b.location_type,30):"onsite";
  const rows=await write("booking_requests","POST",{
    client_id:clientId,job_id:jobId,request_type:type,catalog_service_id:serviceId,service_name:serviceName,
    requested_start:start,requested_end:end,alternate_start:alt,timezone:clean(b.timezone,80)||TZ,location_type:loc,
    address:clean(b.address,500)||null,client_note:clean(b.client_note,3000)||null,status:"new",updated_at:new Date().toISOString()
  });
  const req=rows?.[0];await activity(clientId,type==="new"?"New booking request":type==="reschedule"?"Reschedule requested":"Cancellation requested",
    `${serviceName||"VMS service"} requires Admin review.`,true,{booking_request_id:req?.id,job_id:jobId,request_type:type});
  return req;
}
async function cancelOwnRequest(a:any,b:Row){
  requireClient(a);const id=clean(b.id,80);
  const row=(await read(`booking_requests?id=eq.${encodeURIComponent(id)}&client_id=eq.${encodeURIComponent(a.client.id)}&select=*&limit=1`))?.[0];
  if(!row||!["new","reviewing"].includes(row.status))throw Object.assign(new Error("That request can no longer be canceled."),{status:400});
  const rows=await write(`booking_requests?id=eq.${encodeURIComponent(id)}`,"PATCH",{status:"canceled",resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  return rows?.[0];
}
async function decideRequest(a:any,b:Row){
  requireAdmin(a);const id=clean(b.id,80),decision=clean(b.decision,20);
  if(!["approve","decline","reviewing"].includes(decision))throw Object.assign(new Error("Invalid request decision."),{status:400});
  const req=(await read(`booking_requests?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0];
  if(!req)throw Object.assign(new Error("Booking request not found."),{status:404});
  if(decision==="reviewing"){
    const rows=await write(`booking_requests?id=eq.${encodeURIComponent(id)}`,"PATCH",{status:"reviewing",admin_note:clean(b.admin_note,3000)||null,updated_at:new Date().toISOString()});
    return {request:rows?.[0],job:null};
  }
  if(decision==="decline"){
    const rows=await write(`booking_requests?id=eq.${encodeURIComponent(id)}`,"PATCH",{status:"declined",admin_note:clean(b.admin_note,3000)||null,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    await activity(req.client_id,"Booking request declined",`${req.service_name||"VMS service"} request was declined.`,false,{booking_request_id:id,action:"decline"});
    return {request:rows?.[0],job:null};
  }
  let job:any=null;
  if(req.request_type==="cancel"){
    job=(await read(`service_jobs?id=eq.${encodeURIComponent(req.job_id)}&select=*&limit=1`))?.[0];
    if(!job)throw Object.assign(new Error("The linked job was not found."),{status:404});
    const rows=await write(`service_jobs?id=eq.${encodeURIComponent(job.id)}`,"PATCH",{status:"canceled",canceled_at:new Date().toISOString(),updated_at:new Date().toISOString()});job=rows?.[0]||job;
  }else{
    const start=dateIso(b.scheduled_start||req.requested_start,true)!,end=dateIso(b.scheduled_end||req.requested_end,true)!;
    const exclude=req.request_type==="reschedule"?req.job_id:null,c=await conflict(start,end,exclude);
    if(c&&!b.allow_conflict)throw Object.assign(new Error(`Schedule conflict with "${c.title}".`),{status:409,conflict:c});
    if(req.request_type==="reschedule"){
      const rows=await write(`service_jobs?id=eq.${encodeURIComponent(req.job_id)}`,"PATCH",{
        scheduled_start:start,scheduled_end:end,status:"scheduled",address:clean(b.address||req.address,500)||null,
        assigned_to:clean(b.assigned_to,160)||null,updated_at:new Date().toISOString()
      });job=rows?.[0];
    }else{
      const rows=await write("service_jobs","POST",{
        client_id:req.client_id,catalog_service_id:req.catalog_service_id,service_name:req.service_name||"VMS Service",
        title:clean(b.title,180)||req.service_name||"VMS Service",status:"scheduled",priority:"normal",
        scheduled_start:start,scheduled_end:end,timezone:req.timezone||TZ,location_type:req.location_type||"onsite",
        address:clean(b.address||req.address,500)||null,assigned_to:clean(b.assigned_to,160)||null,
        client_notes:req.client_note||null,internal_notes:clean(b.admin_note,3000)||null,client_visible:true,source:"client-request",
        updated_at:new Date().toISOString()
      });job=rows?.[0];
    }
  }
  const rrows=await write(`booking_requests?id=eq.${encodeURIComponent(id)}`,"PATCH",{
    status:"approved",job_id:job?.id||req.job_id||null,admin_note:clean(b.admin_note,3000)||null,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()
  });
  await activity(req.client_id,req.request_type==="cancel"?"Cancellation approved":req.request_type==="reschedule"?"Reschedule approved":"Booking confirmed",
    req.service_name||"VMS service",false,{booking_request_id:id,job_id:job?.id||req.job_id,action:"approve",request_type:req.request_type});
  return {request:rrows?.[0],job};
}
async function saveRule(a:any,b:Row){
  requireAdmin(a);const id=clean(b.id,80)||null,weekday=Number(b.weekday),start=clean(b.start_time,20),end=clean(b.end_time,20);
  if(!Number.isInteger(weekday)||weekday<0||weekday>6||!start||!end)throw Object.assign(new Error("Weekday, start, and end times are required."),{status:400});
  const payload={weekday,start_time:start,end_time:end,timezone:clean(b.timezone,80)||TZ,catalog_service_id:clean(b.catalog_service_id,120)||null,
    slot_minutes:Math.max(15,Math.min(720,Number(b.slot_minutes)||60)),buffer_minutes:Math.max(0,Math.min(240,Number(b.buffer_minutes)||0)),
    lead_time_hours:Math.max(0,Math.min(2160,Number(b.lead_time_hours)||24)),active:b.active!==false,updated_at:new Date().toISOString()};
  const rows=id?await write(`availability_rules?id=eq.${encodeURIComponent(id)}`,"PATCH",payload):await write("availability_rules","POST",payload);return rows?.[0];
}
async function deleteRule(a:any,b:Row){requireAdmin(a);await write(`availability_rules?id=eq.${encodeURIComponent(clean(b.id,80))}`,"DELETE",undefined,"return=minimal");return true}
async function saveBlackout(a:any,b:Row){
  requireAdmin(a);const start=dateIso(b.starts_at,true)!,end=dateIso(b.ends_at,true)!;
  if(new Date(end).getTime()<=new Date(start).getTime())throw Object.assign(new Error("Blackout end must be after start."),{status:400});
  const rows=await write("schedule_blackouts","POST",{starts_at:start,ends_at:end,reason:clean(b.reason,500)||null});return rows?.[0];
}
async function deleteBlackout(a:any,b:Row){requireAdmin(a);await write(`schedule_blackouts?id=eq.${encodeURIComponent(clean(b.id,80))}`,"DELETE",undefined,"return=minimal");return true}

export default async(req:Request)=>{
  try{
    const a=await actor(req);
    if(req.method==="GET")return Response.json(a.admin?await listAdmin():await listClient(a));
    if(req.method!=="POST")return new Response("Method not allowed",{status:405});
    const b:Row=await req.json(),action=clean(b.action,60);
    if(action==="job-save")return Response.json({ok:true,...await saveJob(a,b)});
    if(action==="job-status")return Response.json({ok:true,job:await jobStatus(a,b)});
    if(action==="booking-request")return Response.json({ok:true,request:await bookingRequest(a,b)});
    if(action==="request-cancel")return Response.json({ok:true,request:await cancelOwnRequest(a,b)});
    if(action==="request-decision")return Response.json({ok:true,...await decideRequest(a,b)});
    if(action==="availability-save")return Response.json({ok:true,rule:await saveRule(a,b)});
    if(action==="availability-delete")return Response.json({ok:true,deleted:await deleteRule(a,b)});
    if(action==="blackout-save")return Response.json({ok:true,blackout:await saveBlackout(a,b)});
    if(action==="blackout-delete")return Response.json({ok:true,deleted:await deleteBlackout(a,b)});
    return Response.json({error:"Unknown scheduling action."},{status:400});
  }catch(error:any){
    if(error?.status===409)return Response.json({error:error.message,conflict:error.conflict||null},{status:409});
    return jsonError(error);
  }
};
export const config:Config={path:"/api/schedule"};
