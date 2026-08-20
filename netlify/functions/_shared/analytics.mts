import { supabaseEnv } from './auth.mts';

type Row = Record<string, any>;
type RangeKey = '30d'|'90d'|'6m'|'12m'|'all';

type Window = { key:RangeKey; start:Date|null; end:Date; previousStart:Date|null; previousEnd:Date|null; label:string };

const DAY=86400000;
const ACTIVE_SUBS=new Set(['active','trialing']);
const ACTIVE_CLIENTS=new Set(['active','client','current','']);

function env(name:string){return Netlify.env.get(name)||''}
function clean(v:any,n=5000){return String(v??'').trim().slice(0,n)}
function lower(v:any){return clean(v,250).toLowerCase()}
function num(v:any){const n=Number(v);return Number.isFinite(n)?n:0}
function iso(d:Date){return d.toISOString()}
function date(v:any){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function monthKey(v:any){const d=v instanceof Date?v:date(v);return d?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`:''}
function monthLabel(key:string){const [y,m]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,1)).toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'})}
function pct(current:number,previous:number){if(previous===0)return current===0?0:null;return ((current-previous)/Math.abs(previous))*100}
function within(v:any,start:Date|null,end:Date){const d=date(v);return !!d&&(!start||d>=start)&&d<=end}
function before(v:any,end:Date){const d=date(v);return !!d&&d<=end}
function after(v:any,start:Date){const d=date(v);return !!d&&d>start}
function cadenceMonthly(amount:any,cadence:any){const a=num(amount),c=lower(cadence);if(c.includes('year')||c.includes('annual'))return a/12;if(c.includes('week'))return a*52/12;if(c.includes('quarter'))return a/3;return a}
function sum(rows:any[],fn:(x:any)=>number){return rows.reduce((a,x)=>a+fn(x),0)}
function countBy(rows:Row[],fn:(x:Row)=>string){const m=new Map<string,number>();for(const r of rows){const k=fn(r)||'Unknown';m.set(k,(m.get(k)||0)+1)}return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value)}

function rangeWindow(raw:string):Window{
  const key=(['30d','90d','6m','12m','all'].includes(raw)?raw:'30d') as RangeKey;
  const end=new Date();
  if(key==='all')return{key,start:null,end,previousStart:null,previousEnd:null,label:'All time'};
  const days=key==='30d'?30:key==='90d'?90:key==='6m'?183:365;
  const start=new Date(end.getTime()-days*DAY);
  const previousEnd=new Date(start.getTime()-1);
  const previousStart=new Date(previousEnd.getTime()-days*DAY);
  return{key,start,end,previousStart,previousEnd,label:key==='30d'?'Last 30 days':key==='90d'?'Last 90 days':key==='6m'?'Last 6 months':'Last 12 months'};
}

function headers(json=false,prefer='',range=''){
  const {serviceKey}=supabaseEnv();
  if(!serviceKey)throw Object.assign(new Error('Supabase server configuration is incomplete.'),{status:503});
  const h:Record<string,string>={apikey:serviceKey};
  if(!serviceKey.startsWith('sb_secret_'))h.Authorization=`Bearer ${serviceKey}`;
  if(json)h['Content-Type']='application/json';if(prefer)h.Prefer=prefer;if(range)h.Range=range;return h;
}
async function request(path:string,init:RequestInit={}){
  const {url}=supabaseEnv();if(!url)throw Object.assign(new Error('Supabase server configuration is incomplete.'),{status:503});
  const h=new Headers(init.headers||{});Object.entries(headers(!!init.body)).forEach(([k,v])=>{if(!h.has(k))h.set(k,v)});
  return fetch(`${url.replace(/\/$/,'')}/rest/v1/${path}`,{...init,headers:h});
}
export async function readAll(path:string,pageSize=1000){
  const out:any[]=[];let start=0;
  for(let page=0;page<100;page++){
    const end=start+pageSize-1;
    const r=await request(path,{headers:{Range:`${start}-${end}`}});const text=await r.text();
    if(!r.ok)throw new Error(`Analytics database read failed (${r.status})${text?`: ${text.slice(0,220)}`:''}`);
    const rows=text?JSON.parse(text):[];if(!Array.isArray(rows))return rows;out.push(...rows);if(rows.length<pageSize)break;start+=pageSize;
  }
  return out;
}
export async function write(path:string,method:'POST'|'PATCH'|'DELETE',body?:any,prefer='return=representation'){
  const r=await request(path,{method,headers:prefer?{Prefer:prefer}:{},body:body==null?undefined:JSON.stringify(body)});const text=await r.text();
  if(!r.ok)throw new Error(`Analytics database update failed (${r.status})${text?`: ${text.slice(0,220)}`:''}`);return text?JSON.parse(text):null;
}

function monthKeys(count=12){const now=new Date(),keys:string[]=[];for(let i=count-1;i>=0;i--){keys.push(`${new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1)).getUTCFullYear()}-${String(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1)).getUTCMonth()+1).padStart(2,'0')}`)}return keys}
function monthEnd(key:string){const[y,m]=key.split('-').map(Number);return new Date(Date.UTC(y,m,0,23,59,59,999))}

function subscriptionActiveAt(s:Row,at:Date){
  const created=date(s.created_at);if(!created||created>at)return false;
  const canceled=date(s.canceled_at);if(canceled&&canceled<=at)return false;
  return true;
}
function revenueRows(invoices:Row[],checkouts:Row[]){
  const inv=invoices.filter(x=>lower(x.status)==='paid'&&x.paid_at).map(x=>({client_id:x.client_id,at:x.paid_at,amount:num(x.amount_paid),kind:x.subscription_id?'recurring':'invoice',service:clean(x.metadata?.service_name||x.metadata?.service_key||'')}));
  const one=checkouts.filter(x=>lower(x.status)==='complete'||lower(x.status)==='completed').filter(x=>lower(x.mode)==='payment').filter(x=>x.completed_at||x.updated_at).map(x=>({client_id:x.client_id,at:x.completed_at||x.updated_at,amount:num(x.service_amount)+num(x.activation_fee),kind:'one_time',service:clean(x.metadata?.service_name||x.service_key||'')}));
  return [...inv,...one];
}
function linkhubTotals(pages:Row[]){return pages.reduce((o,p)=>{const d=p.published_data||{};o.views+=num(d.views);o.clicks+=num(d.clicks);if(lower(p.status)==='published')o.published++;return o},{views:0,clicks:0,published:0})}

export async function buildAnalytics(rangeRaw='30d'){
  const window=rangeWindow(rangeRaw);
  const [clients,leads,services,jobs,bookings,subs,invoices,checkouts,qrCodes,qrScans,linkhubs,snapshots,deliveries,runs]=await Promise.all([
    readAll('clients?select=id,business_name,status,created_at,converted_at,lead_source'),
    readAll('intake_requests?select=id,business_name,stage,status,source,service_ids,created_at,converted_at,converted_client_id,lost_reason'),
    readAll('client_services?select=id,client_id,catalog_service_id,service_name,service_status,billing_status,agreed_price,billing_cadence,created_at,start_date'),
    readAll('service_jobs?select=id,client_id,catalog_service_id,service_name,title,status,priority,created_at,scheduled_start,completed_at,canceled_at'),
    readAll('booking_requests?select=id,client_id,request_type,status,service_name,created_at,resolved_at'),
    readAll('billing_subscriptions?select=id,client_id,status,amount,currency,cadence,cancel_at_period_end,canceled_at,current_period_end,metadata,created_at'),
    readAll('billing_invoices?select=id,client_id,subscription_id,status,amount_due,amount_paid,currency,paid_at,due_at,created_at,metadata'),
    readAll('billing_checkout_sessions?select=provider_session_id,client_id,service_key,mode,status,service_amount,activation_fee,currency,completed_at,created_at,updated_at,metadata'),
    readAll('qr_codes?select=id,client_id,name,status,scan_count,last_scanned_at,created_at'),
    readAll('qr_scan_events?select=id,qr_id,client_id,scanned_at,device_type'),
    readAll('linkhub_pages?select=client_id,slug,status,published_at,updated_at,published_data'),
    readAll('analytics_daily_snapshots?select=snapshot_date,metrics,created_at&order=snapshot_date.asc'),
    readAll('automation_deliveries?select=id,rule_key,audience,channel,status,created_at,sent_at'),
    readAll('automation_runs?select=id,status,source,started_at,completed_at,scanned_count,sent_count,failed_count&order=started_at.desc&limit=200')
  ]);

  const revenues=revenueRows(invoices,checkouts);
  const currentActiveClients=clients.filter(c=>ACTIVE_CLIENTS.has(lower(c.status))||!lower(c.status)||lower(c.status)==='active');
  const currentActiveSubs=subs.filter(s=>ACTIVE_SUBS.has(lower(s.status)));
  const mrr=sum(currentActiveSubs,s=>cadenceMonthly(s.amount,s.cadence));
  const periodRevenue=revenues.filter(r=>within(r.at,window.start,window.end));
  const recurringCollected=sum(periodRevenue.filter(r=>r.kind==='recurring'),r=>r.amount);
  const oneTimeRevenue=sum(periodRevenue.filter(r=>r.kind==='one_time'),r=>r.amount);
  const otherCollected=sum(periodRevenue.filter(r=>r.kind==='invoice'),r=>r.amount);
  const cashCollected=recurringCollected+oneTimeRevenue+otherCollected;
  const allRevenue=sum(revenues,r=>r.amount);
  const revenueClients=new Set(revenues.filter(r=>r.client_id&&r.amount>0).map(r=>r.client_id));
  const avgClientValue=revenueClients.size?allRevenue/revenueClients.size:0;

  const periodLeads=leads.filter(x=>within(x.created_at,window.start,window.end));
  const convertedPeriod=periodLeads.filter(x=>!!x.converted_at||!!x.converted_client_id);
  const leadConversion=periodLeads.length?convertedPeriod.length/periodLeads.length*100:0;
  const periodJobs=jobs.filter(x=>within(x.created_at,window.start,window.end));
  const completedJobs=jobs.filter(x=>within(x.completed_at,window.start,window.end));
  const periodScans=qrScans.filter(x=>within(x.scanned_at,window.start,window.end));
  const newClients=clients.filter(x=>within(x.created_at,window.start,window.end));

  const activeAtStart=window.start?subs.filter(s=>{const created=date(s.created_at);const canceled=date(s.canceled_at);return !!created&&created<window.start!&&(!canceled||canceled>=window.start!)}):[];
  const churned=subs.filter(s=>within(s.canceled_at,window.start,window.end));
  const churnRate=window.start&&activeAtStart.length?churned.length/activeAtStart.length*100:0;

  const prevRevenue=window.previousStart&&window.previousEnd?sum(revenues.filter(r=>within(r.at,window.previousStart,window.previousEnd!)),r=>r.amount):0;
  const prevLeads=window.previousStart&&window.previousEnd?leads.filter(x=>within(x.created_at,window.previousStart,window.previousEnd!)).length:0;
  const prevJobs=window.previousStart&&window.previousEnd?jobs.filter(x=>within(x.created_at,window.previousStart,window.previousEnd!)).length:0;
  const prevClients=window.previousStart&&window.previousEnd?clients.filter(x=>within(x.created_at,window.previousStart,window.previousEnd!)).length:0;
  const prevScans=window.previousStart&&window.previousEnd?qrScans.filter(x=>within(x.scanned_at,window.previousStart,window.previousEnd!)).length:0;

  const months=monthKeys(12);
  const monthly=months.map(key=>{
    const rev=revenues.filter(r=>monthKey(r.at)===key);
    const mEnd=monthEnd(key);
    const snapInMonth=snapshots.filter(s=>String(s.snapshot_date||'').slice(0,7)===key).sort((a,b)=>String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
    const snap=snapInMonth[snapInMonth.length-1];
    return{
      key,label:monthLabel(key),
      cashCollected:sum(rev,r=>r.amount),
      recurringCollected:sum(rev.filter(r=>r.kind==='recurring'),r=>r.amount),
      oneTimeRevenue:sum(rev.filter(r=>r.kind==='one_time'),r=>r.amount),
      mrr:sum(subs.filter(s=>subscriptionActiveAt(s,mEnd)),s=>cadenceMonthly(s.amount,s.cadence)),
      newClients:clients.filter(x=>monthKey(x.created_at)===key).length,
      leads:leads.filter(x=>monthKey(x.created_at)===key).length,
      conversions:leads.filter(x=>monthKey(x.converted_at)===key).length,
      projects:jobs.filter(x=>monthKey(x.created_at)===key).length,
      completedProjects:jobs.filter(x=>monthKey(x.completed_at)===key).length,
      qrScans:qrScans.filter(x=>monthKey(x.scanned_at)===key).length,
      linkhubViews:snap?num(snap.metrics?.linkhubViews):null,
      linkhubClicks:snap?num(snap.metrics?.linkhubClicks):null
    };
  });

  const last=monthly.at(-1),prior=monthly.at(-2);
  const mom={
    revenue:pct(num(last?.cashCollected),num(prior?.cashCollected)),
    mrr:pct(num(last?.mrr),num(prior?.mrr)),
    clients:pct(num(last?.newClients),num(prior?.newClients)),
    leads:pct(num(last?.leads),num(prior?.leads)),
    projects:pct(num(last?.projects),num(prior?.projects)),
    qrScans:pct(num(last?.qrScans),num(prior?.qrScans))
  };

  const serviceMap=new Map<string,{name:string,activeClients:Set<string>,assignments:number,jobs:number,mrr:number,revenue:number}>();
  const ensure=(name:string)=>{const k=clean(name)||'Unknown service';if(!serviceMap.has(k))serviceMap.set(k,{name:k,activeClients:new Set(),assignments:0,jobs:0,mrr:0,revenue:0});return serviceMap.get(k)!};
  for(const s of services){const x=ensure(s.service_name||s.catalog_service_id);x.assignments++;if(lower(s.service_status)==='active'&&s.client_id)x.activeClients.add(s.client_id)}
  for(const j of jobs)ensure(j.service_name||j.catalog_service_id).jobs++;
  for(const s of currentActiveSubs){const x=ensure(s.metadata?.service_name||s.metadata?.service_key||'Recurring service');x.mrr+=cadenceMonthly(s.amount,s.cadence)}
  for(const r of revenues){if(r.service)ensure(r.service).revenue+=r.amount}
  const popularServices=[...serviceMap.values()].map(x=>({name:x.name,activeClients:x.activeClients.size,assignments:x.assignments,jobs:x.jobs,mrr:x.mrr,revenue:x.revenue})).sort((a,b)=>(b.activeClients+b.assignments+b.jobs)-(a.activeClients+a.assignments+a.jobs)).slice(0,10);

  const clientRevenue=new Map<string,number>();for(const r of revenues)if(r.client_id)clientRevenue.set(r.client_id,(clientRevenue.get(r.client_id)||0)+r.amount);
  const clientName=new Map(clients.map(c=>[c.id,c.business_name||'Client']));
  const topClients=[...clientRevenue.entries()].map(([clientId,revenue])=>({clientId,name:clientName.get(clientId)||'Client',revenue})).sort((a,b)=>b.revenue-a.revenue).slice(0,8);

  const linkhub=linkhubTotals(linkhubs);
  const openInvoices=invoices.filter(i=>!['paid','void','canceled','cancelled'].includes(lower(i.status)));
  const overdueInvoices=openInvoices.filter(i=>i.due_at&&new Date(i.due_at)<window.end);
  const activeJobs=jobs.filter(j=>!['completed','canceled','cancelled'].includes(lower(j.status)));
  const upcoming7d=activeJobs.filter(j=>j.scheduled_start&&new Date(j.scheduled_start)>=window.end&&new Date(j.scheduled_start)<=new Date(window.end.getTime()+7*DAY));
  const pendingBookings=bookings.filter(b=>['new','reviewing'].includes(lower(b.status)));

  const periodDeliveries=deliveries.filter(d=>within(d.created_at,window.start,window.end));
  const sent=periodDeliveries.filter(d=>d.status==='sent').length,failed=periodDeliveries.filter(d=>d.status==='failed').length,skipped=periodDeliveries.filter(d=>d.status==='skipped').length;

  const insights:string[]=[];
  if(mrr>0)insights.push(`Current recurring revenue is ${mrr.toLocaleString('en-US',{style:'currency',currency:'USD'})} MRR across ${currentActiveSubs.length} active subscription${currentActiveSubs.length===1?'':'s'}.`);
  if(periodLeads.length&&leadConversion<25)insights.push(`Lead conversion is ${leadConversion.toFixed(1)}% for ${window.label.toLowerCase()}, leaving room to improve follow-up and qualification.`);
  if(overdueInvoices.length)insights.push(`${overdueInvoices.length} invoice${overdueInvoices.length===1?' is':'s are'} overdue with ${sum(overdueInvoices,x=>num(x.amount_due)).toLocaleString('en-US',{style:'currency',currency:'USD'})} outstanding.`);
  if(periodJobs.length&&completedJobs.length/Math.max(1,periodJobs.length)>=.75)insights.push(`Project completion is strong: ${completedJobs.length} completed against ${periodJobs.length} projects opened in the selected period.`);
  if(!insights.length)insights.push('VMS is still building its production history. Phase 8 will accumulate daily snapshots and trend data automatically as real client activity grows.');

  return{
    generatedAt:new Date().toISOString(),range:{key:window.key,label:window.label,start:window.start?.toISOString()||null,end:window.end.toISOString()},
    kpis:{mrr,cashCollected,recurringCollected,oneTimeRevenue,otherCollected,avgClientValue,activeClients:currentActiveClients.length,activeSubscriptions:currentActiveSubs.length,churnRate,leadConversion,leads:periodLeads.length,convertedLeads:convertedPeriod.length,projectVolume:periodJobs.length,completedProjects:completedJobs.length,qrScans:periodScans.length},
    comparison:{cashCollected:pct(cashCollected,prevRevenue),newClients:pct(newClients.length,prevClients),leads:pct(periodLeads.length,prevLeads),projects:pct(periodJobs.length,prevJobs),qrScans:pct(periodScans.length,prevScans)},
    mom,monthly,
    revenue:{allTime:allRevenue,openInvoiceAmount:sum(openInvoices,x=>num(x.amount_due)),overdueInvoiceAmount:sum(overdueInvoices,x=>num(x.amount_due)),openInvoices:openInvoices.length,overdueInvoices:overdueInvoices.length,topClients},
    growth:{newClients:newClients.length,leadStages:countBy(leads,x=>clean(x.stage||x.status||'New')),leadSources:countBy(leads,x=>clean(x.source||'Unknown')),clientSources:countBy(clients,x=>clean(x.lead_source||'Unknown'))},
    services:{popular:popularServices,activeAssignments:services.filter(s=>lower(s.service_status)==='active').length},
    operations:{activeJobs:activeJobs.length,upcoming7d:upcoming7d.length,pendingBookings:pendingBookings.length,statuses:countBy(jobs,x=>clean(x.status||'Unknown')),bookingTypes:countBy(bookings,x=>clean(x.request_type||'Unknown'))},
    engagement:{activeQrCodes:qrCodes.filter(q=>!['archived','disabled','canceled'].includes(lower(q.status))).length,qrScans:periodScans.length,qrDevices:countBy(periodScans,x=>clean(x.device_type||'Unknown')),publishedLinkHubs:linkhub.published,linkhubViews:linkhub.views,linkhubClicks:linkhub.clicks,linkhubSnapshotDays:snapshots.length},
    automation:{deliveries:periodDeliveries.length,sent,failed,skipped,successRate:(sent+failed)>0?sent/(sent+failed)*100:100,lastRun:runs[0]||null},
    insights,
    definitions:{
      mrr:'Active/trialing subscription amounts normalized to monthly value.',
      cashCollected:'Paid invoices plus completed one-time checkout payments in the selected period.',
      oneTimeRevenue:'Completed payment-mode checkout service amount plus activation fee.',
      avgClientValue:'All-time collected revenue divided by clients with recorded revenue.',
      churn:'Subscriptions canceled during the selected period divided by subscriptions active at period start.',
      leadConversion:'Leads created in the selected period that converted to a client.',
      linkhub:'Current LinkHub counters come from the published LinkHub record; daily Phase 8 snapshots preserve trend history going forward.'
    }
  };
}

export async function saveDailySnapshot(){
  const data=await buildAnalytics('30d');
  const d=new Date(),snapshotDate=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  const metrics={
    mrr:data.kpis.mrr,activeClients:data.kpis.activeClients,activeSubscriptions:data.kpis.activeSubscriptions,
    cashCollected30d:data.kpis.cashCollected,allTimeRevenue:data.revenue.allTime,activeServices:data.services.activeAssignments,
    openLeads:data.growth.leadStages.filter((x:any)=>!['won','lost'].includes(lower(x.label))).reduce((a:number,x:any)=>a+x.value,0),
    projectVolume30d:data.kpis.projectVolume,qrScans30d:data.kpis.qrScans,
    linkhubViews:data.engagement.linkhubViews,linkhubClicks:data.engagement.linkhubClicks,publishedLinkHubs:data.engagement.publishedLinkHubs
  };
  const rows=await write('analytics_daily_snapshots?on_conflict=snapshot_date','POST',{snapshot_date:snapshotDate,metrics,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=representation');
  return rows?.[0]||{snapshot_date:snapshotDate,metrics};
}
