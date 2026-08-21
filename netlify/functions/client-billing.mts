import type { Config } from "@netlify/functions";
import { jsonError, requireClient, stripeRequest, supabaseJson, supabaseWrite, unixToIso } from "./_shared/billing.mts";

const clean=(v:any,n=600)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const now=()=>new Date().toISOString();

async function loadAccount(clientId:string){
  const [services,catalog,subs,invoices,payments]=await Promise.all([
    supabaseJson(`client_services?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`),
    supabaseJson('service_catalog?status=eq.Published&select=id,name,pricing_model,one_time_price,recurring_price,cadence,sales_mode,portal_visible,metadata'),
    supabaseJson(`billing_subscriptions?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`),
    supabaseJson(`billing_invoices?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`),
    supabaseJson(`billing_payments?client_id=eq.${encodeURIComponent(clientId)}&select=*&order=created_at.desc`).catch(()=>[])
  ]);
  return{services,catalog,subscriptions:subs,invoices,payments};
}

async function announceCancellation(client:any,sub:any,reason:string,effective:string|null){
  const label=clean(sub?.metadata?.service_name||sub?.metadata?.service_key||'VMS subscription',180);
  const dateText=effective?new Date(effective).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/New_York'}):'the end of the current paid period';
  const detail=`${label} will stop renewing after ${dateText}. Access remains available through the paid-through date.`;
  const meta={required:true,subscription_id:sub.id,provider_subscription_id:sub.provider_subscription_id||null,effective_date:effective,reason:reason||null,button_label:'Open Billing',url:'https://visionmakestudio.com/portal/?section=billing'};
  await supabaseWrite('activity_events','POST',{
    client_id:client.id,event_type:'subscription_cancellation_scheduled',title:'Subscription cancellation scheduled',detail,needs_action:false,resolved:false,
    metadata:{visibility:'client',source:'client_portal',...meta},created_at:now()
  },'return=minimal').catch(()=>null);
  await supabaseWrite('activity_events','POST',{
    client_id:client.id,event_type:'subscription_cancel_request_admin',title:'Client scheduled subscription cancellation',detail:`${client.business_name}: ${detail}${reason?` Reason: ${reason}`:''}`,needs_action:true,resolved:false,
    metadata:{visibility:'admin',source:'client_portal',...meta},created_at:now()
  },'return=minimal').catch(()=>null);
  await supabaseWrite('automation_event_queue','POST',{
    rule_key:'subscription_cancelled_client',event_key:`subscription_cancelled_client:${sub.id}:${effective||'period_end'}`,client_id:client.id,source_type:'billing_subscription',source_id:sub.id,
    subject:'Your VMS subscription cancellation is scheduled',message:`Your ${label} subscription will remain active through ${dateText}, then it will stop renewing. Your VMS account history and service records will stay saved.`,status:'pending',metadata:meta,created_at:now(),updated_at:now()
  },'return=minimal').catch(()=>null);
  await supabaseWrite('automation_event_queue','POST',{
    rule_key:'subscription_cancel_request_admin',event_key:`subscription_cancel_request_admin:${sub.id}:${effective||'period_end'}`,client_id:client.id,source_type:'billing_subscription',source_id:sub.id,
    subject:'Client scheduled a subscription cancellation',message:`${client.business_name} scheduled cancellation of ${label} after ${dateText}.${reason?` Reason: ${reason}`:''}`,status:'pending',metadata:{...meta,required:true,button_label:'Open Billing',url:'https://visionmakestudio.com/admin/billing.html'},created_at:now(),updated_at:now()
  },'return=minimal').catch(()=>null);
}

export default async(req:Request)=>{
  try{
    const {client}=await requireClient(req);
    if(req.method==='GET')return Response.json({client,...await loadAccount(client.id)});
    if(req.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405});

    const body=await req.json().catch(()=>({}));
    const action=clean(body?.action,80).toLowerCase();
    const subscriptionId=clean(body?.subscriptionId||body?.subscription_id,160);
    if(action!=='cancel_at_period_end')throw Object.assign(new Error('Unsupported subscription action.'),{status:400});
    if(!subscriptionId)throw Object.assign(new Error('Choose a subscription first.'),{status:400});

    const rows=await supabaseJson(`billing_subscriptions?id=eq.${encodeURIComponent(subscriptionId)}&client_id=eq.${encodeURIComponent(client.id)}&select=*&limit=1`);
    const sub=Array.isArray(rows)?rows[0]:null;
    if(!sub)throw Object.assign(new Error('This subscription is not connected to your VMS account.'),{status:404});
    const status=String(sub.status||'').toLowerCase();
    if(['canceled','cancelled','incomplete_expired'].includes(status))throw Object.assign(new Error('This subscription is already canceled.'),{status:409});
    if(sub.cancel_at_period_end)return Response.json({ok:true,alreadyScheduled:true,subscription:sub});

    let effective=sub.current_period_end||null;
    let stripeSub:any=null;
    if(String(sub.provider||'').toLowerCase()==='stripe'&&sub.provider_subscription_id){
      const params=new URLSearchParams();params.set('cancel_at_period_end','true');
      stripeSub=await stripeRequest(`subscriptions/${encodeURIComponent(sub.provider_subscription_id)}`,params,'POST');
      effective=unixToIso(stripeSub?.current_period_end)||effective;
    }
    const updatedRows=await supabaseWrite(`billing_subscriptions?id=eq.${encodeURIComponent(sub.id)}&client_id=eq.${encodeURIComponent(client.id)}`,'PATCH',{
      cancel_at_period_end:true,current_period_end:effective||sub.current_period_end||null,
      metadata:{...(sub.metadata||{}),cancellation_requested_from:'client_portal',cancellation_reason:clean(body?.reason,300)||null,stripe_cancel_at_period_end:stripeSub?!!stripeSub.cancel_at_period_end:undefined},updated_at:now()
    });
    const updated=updatedRows?.[0]||{...sub,cancel_at_period_end:true,current_period_end:effective};
    await announceCancellation(client,updated,clean(body?.reason,300),effective);
    return Response.json({ok:true,subscription:updated,effectiveDate:effective});
  }catch(e){return jsonError(e)}
};
export const config:Config={path:'/api/client-billing'};
