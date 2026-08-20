import type { Config } from '@netlify/functions';
import { jsonError, requireAdmin } from './_shared/auth.mts';
import { automationCapabilities, emitEventRule, read, runAutomationCycle, write } from './_shared/automations.mts';

function clean(v:any,max=5000){return String(v??'').trim().slice(0,max)}
async function dashboard(){
  const [rules,deliveries,runs,clients]=await Promise.all([
    read('automation_rules?select=*&order=category.asc,name.asc'),
    read('automation_deliveries?select=*&order=created_at.desc&limit=120'),
    read('automation_runs?select=*&order=started_at.desc&limit=30'),
    read('clients?status=neq.archived&select=id,business_name,contact_name,owner_email,status&order=business_name.asc')
  ]);
  return {rules:rules||[],deliveries:deliveries||[],runs:runs||[],clients:clients||[],capabilities:automationCapabilities()};
}
export default async(req:Request)=>{
  try{
    await requireAdmin(req);
    if(req.method==='GET')return Response.json(await dashboard());
    if(req.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405});
    const body:any=await req.json().catch(()=>({})),action=clean(body.action,80);
    if(action==='update_rule'){
      const key=clean(body.rule_key,160);if(!key)throw Object.assign(new Error('Choose an automation rule.'),{status:400});
      const current=(await read(`automation_rules?rule_key=eq.${encodeURIComponent(key)}&select=*&limit=1`))?.[0];if(!current)throw Object.assign(new Error('Automation rule not found.'),{status:404});
      const patch:any={updated_at:new Date().toISOString()};
      for(const field of ['enabled','in_app_enabled','email_enabled'])if(typeof body[field]==='boolean')patch[field]=body[field];
      if(body.lead_minutes!==undefined){const n=body.lead_minutes===null?null:Number(body.lead_minutes);if(n!==null&&(!Number.isFinite(n)||n<0||n>525600))throw Object.assign(new Error('Lead time is invalid.'),{status:400});patch.lead_minutes=n}
      const rows=await write(`automation_rules?rule_key=eq.${encodeURIComponent(key)}`,'PATCH',patch);return Response.json({rule:rows?.[0]||null});
    }
    if(action==='run_now')return Response.json(await runAutomationCycle('manual'));
    if(action==='event'){
      const ruleKey=clean(body.rule_key,160),clientId=clean(body.client_id,100),subject=clean(body.subject,300),message=clean(body.message,5000);
      if(!ruleKey||!clientId||!subject||!message)throw Object.assign(new Error('Rule, client, subject, and message are required.'),{status:400});
      const client=(await read(`clients?id=eq.${encodeURIComponent(clientId)}&select=id,business_name,owner_email&limit=1`))?.[0];if(!client)throw Object.assign(new Error('Client not found.'),{status:404});
      const result=await emitEventRule(ruleKey,{clientId,sourceType:clean(body.source_type,100)||'admin_event',sourceId:clean(body.source_id,180)||crypto.randomUUID(),subject,message,needsAction:!!body.needs_action,metadata:{manual:true,...(body.metadata||{})}});
      return Response.json({ok:true,result});
    }
    throw Object.assign(new Error('Unknown automation action.'),{status:400});
  }catch(e){return jsonError(e)}
};
export const config:Config={path:'/api/automations'};
