import { supabaseEnv } from './auth.mts';

type Row = Record<string, any>;
export type AutomationRule = {
  rule_key:string; name:string; description?:string|null; category:string; trigger_type:'scheduled'|'event';
  enabled:boolean; audience:'client'|'admin'|'both'; in_app_enabled:boolean; email_enabled:boolean;
  lead_minutes?:number|null; config?:Row;
};
export type Candidate = {
  clientId?:string|null; sourceType:string; sourceId:string; subject:string; message:string;
  needsAction?:boolean; scheduledFor?:string|null; metadata?:Row;
};
type Counters={scanned:number;created:number;sent:number;skipped:number;failed:number;duplicates:number};

const TZ='America/New_York';
const ADMIN_EMAIL_DEFAULT='info@visionmakestudio.com';
const clientCache=new Map<string,Row|null>();
function env(name:string){return Netlify.env.get(name)||''}
function clean(v:any,max=5000){return String(v??'').trim().slice(0,max)}
function lower(v:any){return clean(v,240).toLowerCase()}
function iso(d:Date){return d.toISOString()}
function addMinutes(base:Date,minutes:number){return new Date(base.getTime()+minutes*60000)}
function addDays(base:Date,days:number){return new Date(base.getTime()+days*86400000)}
function formatWhen(v:any){if(!v)return'—';const d=new Date(v);if(Number.isNaN(d.getTime()))return'—';return d.toLocaleString('en-US',{timeZone:TZ,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}
function money(v:any,currency='USD'){const n=Number(v)||0;try{return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'USD').toUpperCase()}).format(n)}catch{return `$${n.toFixed(2)}`}}
function restHeaders(json=false,prefer=''){
  const {serviceKey}=supabaseEnv();
  if(!serviceKey)throw Object.assign(new Error('Supabase server configuration is incomplete.'),{status:503});
  const h:Record<string,string>={apikey:serviceKey};
  if(!serviceKey.startsWith('sb_secret_'))h.Authorization=`Bearer ${serviceKey}`;
  if(json)h['Content-Type']='application/json';if(prefer)h.Prefer=prefer;return h;
}
async function db(path:string,init:RequestInit={}){
  const {url}=supabaseEnv();if(!url)throw Object.assign(new Error('Supabase server configuration is incomplete.'),{status:503});
  const headers=new Headers(init.headers||{});Object.entries(restHeaders(!!init.body)).forEach(([k,v])=>{if(!headers.has(k))headers.set(k,v)});
  return fetch(`${url.replace(/\/$/,'')}/rest/v1/${path}`,{...init,headers});
}
export async function read(path:string){const r=await db(path);const text=await r.text();if(!r.ok)throw new Error(`Automation database read failed (${r.status})${text?`: ${text.slice(0,220)}`:''}`);return text?JSON.parse(text):null}
export async function write(path:string,method:'POST'|'PATCH'|'DELETE',body?:any,prefer='return=representation'){
  const h:Record<string,string>={};if(prefer)h.Prefer=prefer;const r=await db(path,{method,headers:h,body:body==null?undefined:JSON.stringify(body)});const text=await r.text();
  if(!r.ok){const e:any=new Error(`Automation database update failed (${r.status})${text?`: ${text.slice(0,220)}`:''}`);e.status=r.status;throw e}return text?JSON.parse(text):null;
}
async function clientFor(id?:string|null){
  if(!id)return null;if(clientCache.has(id))return clientCache.get(id)||null;
  const rows=await read(`clients?id=eq.${encodeURIComponent(id)}&select=id,business_name,contact_name,owner_email,status&limit=1`);const c=rows?.[0]||null;clientCache.set(id,c);return c;
}
function audiences(rule:AutomationRule){return rule.audience==='both'?['client','admin'] as const:[rule.audience] as const}
function baseDedupe(rule:AutomationRule,c:Candidate,audience:string,channel:string){return `${rule.rule_key}:${c.sourceType}:${c.sourceId}:${audience}:${channel}`.slice(0,900)}
async function existingActive(dedupe:string){const rows=await read(`automation_deliveries?dedupe_key=eq.${encodeURIComponent(dedupe)}&status=in.(processing,sent)&select=id,status&limit=1`);return rows?.[0]||null}
async function claim(rule:AutomationRule,c:Candidate,audience:'client'|'admin',channel:'in_app'|'email',recipient:string|null){
  const dedupe=baseDedupe(rule,c,audience,channel);if(await existingActive(dedupe))return null;
  try{
    const rows=await write('automation_deliveries','POST',{
      rule_key:rule.rule_key,client_id:c.clientId||null,source_type:c.sourceType,source_id:c.sourceId,audience,channel,recipient,
      subject:c.subject,message:c.message,status:'processing',dedupe_key:dedupe,scheduled_for:c.scheduledFor||null,
      metadata:{...(c.metadata||{}),needs_action:!!c.needsAction},updated_at:new Date().toISOString()
    });return rows?.[0]||null;
  }catch(e:any){if(Number(e?.status)===409)return null;throw e}
}
async function finish(id:string,status:'sent'|'skipped'|'failed',extra:Row={}){return write(`automation_deliveries?id=eq.${encodeURIComponent(id)}`,'PATCH',{status,sent_at:status==='sent'?new Date().toISOString():null,error:extra.error||null,metadata:extra.metadata||undefined,updated_at:new Date().toISOString()})}
async function logSkippedEmailOnce(rule:AutomationRule,c:Candidate,audience:'client'|'admin',recipient:string|null,reason:string){
  const dedupe=baseDedupe(rule,c,audience,'email');const seen=await read(`automation_deliveries?dedupe_key=eq.${encodeURIComponent(dedupe)}&status=eq.skipped&select=id&limit=1`);if(seen?.[0])return false;
  await write('automation_deliveries','POST',{rule_key:rule.rule_key,client_id:c.clientId||null,source_type:c.sourceType,source_id:c.sourceId,audience,channel:'email',recipient,subject:c.subject,message:c.message,status:'skipped',dedupe_key:dedupe,scheduled_for:c.scheduledFor||null,error:reason,metadata:c.metadata||{},updated_at:new Date().toISOString()},'return=minimal');return true;
}
async function deliverInApp(rule:AutomationRule,c:Candidate,audience:'client'|'admin'){
  const delivery=await claim(rule,c,audience,'in_app',null);if(!delivery)return {duplicate:true};
  try{
    await write('activity_events','POST',{
      client_id:audience==='client'?c.clientId||null:null,event_type:`automation_${rule.rule_key}`,title:c.subject,detail:c.message,
      needs_action:!!c.needsAction,resolved:false,
      metadata:{automation:true,rule_key:rule.rule_key,delivery_id:delivery.id,visibility:audience,target_client_id:c.clientId||null,source_type:c.sourceType,source_id:c.sourceId,...(c.metadata||{})}
    },'return=minimal');
    await finish(delivery.id,'sent');return {sent:true};
  }catch(e:any){await finish(delivery.id,'failed',{error:clean(e?.message||e,1000)}).catch(()=>null);return {failed:true};}
}
async function sendResend(to:string,subject:string,message:string){
  const key=env('RESEND_API_KEY');if(!key)throw Object.assign(new Error('RESEND_API_KEY is not configured.'),{code:'NOT_CONFIGURED'});
  const from=env('VMS_NOTIFICATION_FROM')||'VMS Notifications <notifications@visionmakestudio.com>';
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text:message})});
  if(!r.ok)throw new Error(`Email provider returned ${r.status}.`);return true;
}
async function deliverEmail(rule:AutomationRule,c:Candidate,audience:'client'|'admin'){
  const client=await clientFor(c.clientId||null),recipient=audience==='admin'?(env('VMS_ADMIN_EMAIL')||ADMIN_EMAIL_DEFAULT):lower(client?.owner_email);
  if(!recipient){const made=await logSkippedEmailOnce(rule,c,audience,null,'No recipient email is available.');return made?{skipped:true}:{duplicate:true}}
  if(!env('RESEND_API_KEY')){const made=await logSkippedEmailOnce(rule,c,audience,recipient,'RESEND_API_KEY is not configured.');return made?{skipped:true}:{duplicate:true}}
  const delivery=await claim(rule,c,audience,'email',recipient);if(!delivery)return {duplicate:true};
  try{await sendResend(recipient,c.subject,c.message);await finish(delivery.id,'sent');return {sent:true}}
  catch(e:any){await finish(delivery.id,'failed',{error:clean(e?.message||e,1000)}).catch(()=>null);return {failed:true}}
}
export async function deliverCandidate(rule:AutomationRule,c:Candidate){
  const out={created:0,sent:0,skipped:0,failed:0,duplicates:0};
  for(const audience of audiences(rule)){
    if(audience==='client'&&!c.clientId)continue;
    if(rule.in_app_enabled){const r=await deliverInApp(rule,c,audience);if(r.sent){out.created++;out.sent++}else if(r.failed){out.created++;out.failed++}else out.duplicates++}
    if(rule.email_enabled){const r=await deliverEmail(rule,c,audience);if(r.sent){out.created++;out.sent++}else if(r.skipped){out.created++;out.skipped++}else if(r.failed){out.created++;out.failed++}else out.duplicates++}
  }
  return out;
}
async function candidatesFor(rule:AutomationRule,now=new Date()):Promise<Candidate[]>{
  const key=rule.rule_key,lead=Number(rule.lead_minutes||0),window=Number(rule.config?.window_minutes||90),lookback=Number(rule.config?.lookback_days||7);
  if(key==='appointment_24h'){
    const target=addMinutes(now,lead),a=addMinutes(target,-window/2),b=addMinutes(target,window/2);
    const rows=await read(`service_jobs?status=in.(scheduled,confirmed)&client_visible=eq.true&scheduled_start=gte.${encodeURIComponent(iso(a))}&scheduled_start=lte.${encodeURIComponent(iso(b))}&select=id,client_id,title,service_name,status,scheduled_start,scheduled_end,address,location_type`);
    return (rows||[]).map((j:Row)=>({clientId:j.client_id,sourceType:'service_job',sourceId:j.id,subject:'Upcoming VMS service tomorrow',message:`${j.title||j.service_name} is scheduled for ${formatWhen(j.scheduled_start)}${j.address?` at ${j.address}`:''}.`,scheduledFor:j.scheduled_start,metadata:{job_id:j.id,status:j.status,address:j.address||null}}));
  }
  if(key==='invoice_due_3d'){
    const target=addMinutes(now,lead),a=addMinutes(target,-window/2),b=addMinutes(target,window/2);
    const rows=await read(`billing_invoices?status=in.(open,past_due,unpaid)&due_at=gte.${encodeURIComponent(iso(a))}&due_at=lte.${encodeURIComponent(iso(b))}&select=id,client_id,invoice_number,status,amount_due,currency,due_at,hosted_invoice_url`);
    return (rows||[]).map((x:Row)=>({clientId:x.client_id,sourceType:'billing_invoice',sourceId:x.id,subject:'VMS invoice due soon',message:`Invoice ${x.invoice_number||''} for ${money(x.amount_due,x.currency)} is due ${formatWhen(x.due_at)}.${x.hosted_invoice_url?` Pay/view: ${x.hosted_invoice_url}`:''}`,needsAction:true,scheduledFor:x.due_at,metadata:{invoice_id:x.id,invoice_url:x.hosted_invoice_url||null}}));
  }
  if(key==='invoice_overdue'){
    const rows=await read(`billing_invoices?status=in.(open,past_due,unpaid)&due_at=not.is.null&due_at=lt.${encodeURIComponent(iso(now))}&select=id,client_id,invoice_number,status,amount_due,currency,due_at,hosted_invoice_url`);
    return (rows||[]).map((x:Row)=>({clientId:x.client_id,sourceType:'billing_invoice',sourceId:x.id,subject:'VMS invoice overdue',message:`Invoice ${x.invoice_number||''} for ${money(x.amount_due,x.currency)} is overdue since ${formatWhen(x.due_at)}.${x.hosted_invoice_url?` Pay/view: ${x.hosted_invoice_url}`:''}`,needsAction:true,metadata:{invoice_id:x.id,invoice_url:x.hosted_invoice_url||null}}));
  }
  if(key==='payment_failed'){
    const since=addDays(now,-lookback),events=await read(`billing_events?event_type=eq.invoice.payment_failed&processed_at=gte.${encodeURIComponent(iso(since))}&select=provider_event_id,object_id,processed_at&order=processed_at.desc`);const out:Candidate[]=[];
    for(const e of events||[]){const invoices=await read(`billing_invoices?provider_invoice_id=eq.${encodeURIComponent(e.object_id||'none')}&select=id,client_id,invoice_number,amount_due,currency,hosted_invoice_url&limit=1`),x=invoices?.[0];if(x)out.push({clientId:x.client_id,sourceType:'billing_event',sourceId:e.provider_event_id,subject:'VMS payment failed',message:`A payment attempt for invoice ${x.invoice_number||''} (${money(x.amount_due,x.currency)}) did not go through.${x.hosted_invoice_url?` Review payment: ${x.hosted_invoice_url}`:''}`,needsAction:true,metadata:{invoice_id:x.id,provider_event_id:e.provider_event_id}})}return out;
  }
  if(key==='renewal_3d'){
    const target=addMinutes(now,lead),a=addMinutes(target,-window/2),b=addMinutes(target,window/2);
    const rows=await read(`billing_subscriptions?status=in.(active,trialing)&cancel_at_period_end=eq.false&current_period_end=gte.${encodeURIComponent(iso(a))}&current_period_end=lte.${encodeURIComponent(iso(b))}&select=id,client_id,status,amount,currency,cadence,current_period_end,metadata`);
    return (rows||[]).map((s:Row)=>({clientId:s.client_id,sourceType:'billing_subscription',sourceId:s.id,subject:'Upcoming VMS subscription renewal',message:`${s.metadata?.service_name||'Your VMS subscription'} is scheduled to renew ${formatWhen(s.current_period_end)} for ${money(s.amount,s.currency)}.`,scheduledFor:s.current_period_end,metadata:{subscription_id:s.id}}));
  }
  if(key==='abandoned_checkout_2h'){
    const before=addMinutes(now,-Math.max(lead,120)),since=addDays(now,-lookback);
    const rows=await read(`billing_checkout_sessions?status=in.(open,pending,created)&created_at=gte.${encodeURIComponent(iso(since))}&created_at=lte.${encodeURIComponent(iso(before))}&select=provider_session_id,client_id,service_key,mode,status,service_amount,activation_fee,currency,metadata,created_at`);
    return (rows||[]).map((s:Row)=>({clientId:s.client_id,sourceType:'checkout_session',sourceId:s.provider_session_id,subject:'Finish your VMS service checkout',message:`Your checkout for ${s.metadata?.service_name||s.service_key||'a VMS service'} is still open. You can return to your VMS Portal when you're ready to continue.`,needsAction:false,metadata:{provider_session_id:s.provider_session_id,service_key:s.service_key||null}}));
  }
  if(key==='onboarding_due_24h'){
    const cutoff=addMinutes(now,Math.max(lead,1440));
    const rows=await read(`client_onboarding_tasks?required=eq.true&status=in.(pending,in_progress)&due_at=not.is.null&due_at=lte.${encodeURIComponent(iso(cutoff))}&select=id,client_id,title,description,status,due_at,client_visible`);
    return (rows||[]).map((t:Row)=>({clientId:t.client_id,sourceType:'onboarding_task',sourceId:t.id,subject:'VMS onboarding item needs attention',message:`${t.title} is ${new Date(t.due_at).getTime()<now.getTime()?'overdue':'due soon'} (${formatWhen(t.due_at)}).${t.description?` ${t.description}`:''}`,needsAction:true,scheduledFor:t.due_at,metadata:{task_id:t.id,client_visible:t.client_visible}}));
  }
  if(key==='project_ready'){
    const rows=await read('service_jobs?status=eq.ready&client_visible=eq.true&select=id,client_id,title,service_name,status,scheduled_start,updated_at');
    return (rows||[]).map((j:Row)=>({clientId:j.client_id,sourceType:'service_job',sourceId:j.id,subject:'Your VMS project is ready',message:`${j.title||j.service_name} is ready. Open your VMS Client Portal for the latest update.`,metadata:{job_id:j.id,status:j.status}}));
  }
  if(['booking_request_admin','reschedule_request_admin','cancellation_request_admin'].includes(key)){
    const type=key==='booking_request_admin'?'new':key==='reschedule_request_admin'?'reschedule':'cancel';
    const rows=await read(`booking_requests?status=eq.new&request_type=eq.${type}&select=id,client_id,job_id,request_type,service_name,requested_start,requested_end,address,client_note,created_at`);
    const out:Candidate[]=[];for(const r of rows||[]){const cl=await clientFor(r.client_id);const name=cl?.business_name||cl?.contact_name||cl?.owner_email||'Client';out.push({clientId:r.client_id,sourceType:'booking_request',sourceId:r.id,subject:type==='new'?'New VMS booking request':type==='reschedule'?'VMS reschedule request':'VMS cancellation request',message:`${name} · ${r.service_name||'VMS service'}${r.requested_start?` · ${formatWhen(r.requested_start)}`:''}${r.client_note?` · ${r.client_note}`:''}`,needsAction:true,metadata:{booking_request_id:r.id,job_id:r.job_id||null,request_type:type}})}return out;
  }
  if(['subscription_cancel_request_admin','subscription_pause_request_admin'].includes(key)){
    const eventType=key==='subscription_cancel_request_admin'?'subscription_cancel_requested':'subscription_pause_requested',since=addDays(now,-lookback);
    const rows=await read(`activity_events?event_type=eq.${eventType}&created_at=gte.${encodeURIComponent(iso(since))}&select=id,client_id,title,detail,created_at,metadata&order=created_at.desc`);
    const out:Candidate[]=[];for(const a of rows||[]){const cl=await clientFor(a.client_id);out.push({clientId:a.client_id,sourceType:'activity_event',sourceId:a.id,subject:a.title||'VMS subscription request',message:`${cl?.business_name||cl?.owner_email||'Client'} · ${a.detail||'Subscription request submitted.'}`,needsAction:true,metadata:{activity_event_id:a.id,event_type:eventType}})}return out;
  }
  return [];
}
export async function getRule(ruleKey:string){const rows=await read(`automation_rules?rule_key=eq.${encodeURIComponent(ruleKey)}&select=*&limit=1`);return rows?.[0] as AutomationRule|undefined}
export async function emitEventRule(ruleKey:string,c:Candidate){const rule=await getRule(ruleKey);if(!rule||!rule.enabled)throw Object.assign(new Error('That automation rule is disabled or missing.'),{status:400});if(rule.trigger_type!=='event')throw Object.assign(new Error('That rule is not an event automation.'),{status:400});return deliverCandidate(rule,c)}
export function automationCapabilities(){return {emailConfigured:!!env('RESEND_API_KEY'),fromConfigured:!!env('VMS_NOTIFICATION_FROM'),adminEmail:env('VMS_ADMIN_EMAIL')||ADMIN_EMAIL_DEFAULT,schedule:'@hourly'}}
export async function runAutomationCycle(source:'scheduled'|'manual'='scheduled'){
  clientCache.clear();const started=new Date(),initial=await write('automation_runs','POST',{source,status:'running',started_at:started.toISOString(),metadata:{schedule:'@hourly'}}),run=initial?.[0];
  const totals:Counters={scanned:0,created:0,sent:0,skipped:0,failed:0,duplicates:0},ruleErrors:Row[]=[];
  try{
    const rules=(await read('automation_rules?enabled=eq.true&trigger_type=eq.scheduled&select=*&order=category.asc,name.asc')) as AutomationRule[];
    for(const rule of rules||[]){
      try{const candidates=await candidatesFor(rule,started);totals.scanned+=candidates.length;for(const c of candidates){const r=await deliverCandidate(rule,c);totals.created+=r.created;totals.sent+=r.sent;totals.skipped+=r.skipped;totals.failed+=r.failed;totals.duplicates+=r.duplicates}}
      catch(e:any){totals.failed++;ruleErrors.push({rule_key:rule.rule_key,error:clean(e?.message||e,1000)})}
    }
    const status=totals.failed||ruleErrors.length?'partial':'completed';if(run?.id)await write(`automation_runs?id=eq.${encodeURIComponent(run.id)}`,'PATCH',{status,completed_at:new Date().toISOString(),scanned_count:totals.scanned,created_count:totals.created,sent_count:totals.sent,skipped_count:totals.skipped,failed_count:totals.failed,metadata:{duplicates:totals.duplicates,rule_errors:ruleErrors,email_configured:!!env('RESEND_API_KEY')}});
    return {runId:run?.id||null,status,...totals,ruleErrors,capabilities:automationCapabilities()};
  }catch(e:any){if(run?.id)await write(`automation_runs?id=eq.${encodeURIComponent(run.id)}`,'PATCH',{status:'failed',completed_at:new Date().toISOString(),failed_count:totals.failed+1,error:clean(e?.message||e,1500),metadata:{duplicates:totals.duplicates,rule_errors:ruleErrors}}).catch(()=>null);throw e}
}
