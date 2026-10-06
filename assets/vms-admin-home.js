/* VMS Admin v2 · Home — what needs you today.
   Live: /api/analytics (MRR, clients, QR scans + monthly trends), /api/leads (new leads, follow-ups, pipeline),
   activity_events (recent activity + alerts that need action). Tool states synced by vms-state.js add
   billing issues, overdue projects, waiting audits, missing client files and LinkHub problems. */
(()=>{
'use strict';
const V=window.VMSv2,root=document.getElementById('pgRoot');if(!V||!root)return;
const {ic,esc,api,money,num,kpi,ago,actions,sheet,closeSheet}=V;
const S={an:null,leads:null,acts:[],err:''};
const lower=v=>String(v??'').trim().toLowerCase();
const parse=k=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):null}catch{return null}};
const first=keys=>{for(const k of keys){const v=parse(k);if(v!==null)return v}return null};
const list=(v,keys)=>{if(Array.isArray(v))return v;if(v&&typeof v==='object')for(const k of keys||[])if(Array.isArray(v[k]))return v[k];return []};
const real=x=>x&&!/@example\.|\.example$/.test([x.id,x.client,x.email].map(lower).join(' '));
const active=v=>!['archived','canceled','cancelled','completed','declined','deleted'].includes(lower(v));
const overdue=v=>{if(!v)return false;const d=new Date(String(v).slice(0,10)+'T23:59:59');return !isNaN(d)&&d<new Date()};
const stage=l=>{const s=lower(l.status||'new');return ['new','contacted','qualified','won','lost'].includes(s)?s:'new'};
function tools(){const billing=first(['vms_billing_subscriptions_v3'])||{},work=first(['vms_work_admin_v2','vms_work_admin_v1'])||{},files=first(['vms_files_assets_v2','vms_files_assets_v1'])||{};
  return {billingIssues:list(billing,['subscriptions']).filter(real).filter(s=>!s.archived&&['past due','grace','suspended','failed','payment failed'].includes(lower(s.status))),
    overdueProjects:list(work,['projects']).filter(real).filter(p=>active(p.status)&&overdue(p.dueDate)),
    auditRequests:list(first(['vms_phase5_requests_v1']),['requests']).filter(real).filter(r=>active(r.status)),
    fileRequests:list(files,['requests']).filter(real).filter(r=>!['fulfilled','received','complete','completed','canceled'].includes(lower(r.status))&&(overdue(r.dueDate)||lower(r.status).includes('reminder'))),
    hubAttention:list(first(['vms_linkhub_admin_v2']),['hubs']).filter(real).filter(h=>['grace','suspended','past due','disabled'].includes(lower(h.status||h.serviceStatus||h.billingStatus)))}}
async function load(){const tasks=[api('/api/analytics?range=30d').then(d=>S.an=d).catch(e=>S.err=e.message),api('/api/leads').then(d=>S.leads=d.leads||[]).catch(()=>S.leads=S.leads||[]),
  (async()=>{try{const sb=await VMSAuth.client();const r=await sb.from('activity_events').select('id,title,detail,created_at,event_type,needs_action,resolved,client_id,lead_id').order('created_at',{ascending:false}).limit(40);S.acts=r.data||[]}catch{S.acts=[]}})()];
  await Promise.allSettled(tasks);render()}
function render(){const L=S.leads||[],T=tools(),k=(S.an&&S.an.kpis)||{},mo=(S.an&&S.an.monthly)||[],e=(S.an&&S.an.engagement)||{},col=key=>mo.map(x=>Number(x[key])||0);
  const h=new Date().getHours(),hello=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  const att=[];
  L.filter(l=>stage(l)==='new').slice(0,3).forEach(l=>att.push(['inbox','info','New request: '+(l.business_name||l.contact_name||'new lead'),[l.goal||l.source,ago(l.created_at)].filter(Boolean).join(' · '),[['Open','/admin/leads.html?lead='+encodeURIComponent(l.id),1],['Start audit','/admin/audit.html']]]));
  L.filter(l=>l.follow_up_at&&!['won','lost'].includes(stage(l))&&new Date(l.follow_up_at)<Date.now()).slice(0,3).forEach(l=>att.push(['cal','warn','Follow up with '+(l.business_name||'a lead'),'Was due '+ago(l.follow_up_at),[['Open lead','/admin/leads.html?lead='+encodeURIComponent(l.id),1]]]));
  T.billingIssues.forEach(s=>att.push(['card','bad',(s.client||s.service||'A subscription')+' payment needs attention',[s.service,s.status].filter(Boolean).join(' · '),[['Billing','/admin/billing.html',1]]]));
  T.overdueProjects.forEach(p=>att.push(['cal','bad',(p.name||p.title||'A project')+' is overdue',[p.client,p.dueDate&&'Due '+new Date(p.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})].filter(Boolean).join(' · '),[['Open project','/admin/projects.html',1]]]));
  T.auditRequests.forEach(a=>att.push(['audit','warn',(a.businessName||a.business||a.client||'A business')+' audit is waiting',a.status||'Needs review',[['Open audit','/admin/audit.html',1]]]));
  T.fileRequests.forEach(r=>att.push(['file','warn',(r.name||'A requested file')+' is still needed',[r.client,r.status].filter(Boolean).join(' · '),[['Files','/admin/files.html']]]));
  T.hubAttention.forEach(x=>att.push(['link','warn',(x.client||x.businessName||'A client')+' LinkHub needs attention',x.status||x.serviceStatus||'',[['LinkHub','/admin/linkhub.html']]]));
  S.acts.filter(a=>a.needs_action&&!a.resolved).slice(0,4).forEach(a=>att.push(['bell','warn',a.title||'An update needs action',[a.detail,ago(a.created_at)].filter(Boolean).join(' · '),[['Open','/admin/activity.html']]]));
  document.getElementById('pgTitle').textContent=hello;document.getElementById('pgSub').textContent=att.length?(att.length===1?'1 thing needs you today.':att.length+' things need you today.'):'You are all caught up.';
  const open=L.filter(l=>!['won','lost'].includes(stage(l))),nw=L.filter(l=>stage(l)==='new').length;
  const ST=[['new','New','var(--blue)'],['contacted','Contacted','var(--orange)'],['qualified','Qualified','var(--pri)'],['won','Won','var(--ok)']],cnt={};ST.forEach(s=>cnt[s[0]]=L.filter(l=>stage(l)===s[0]).length);
  const ACTI={lead_activity:'inbox',qr_scan:'qr',linkhub_view:'link',linkhub_click:'link',payment:'card',billing:'card',audit:'audit',file:'file',client:'users'};
  const feed=S.acts.filter(a=>!['linkhub_view','qr_scan'].includes(a.event_type)).slice(0,7);
  root.innerHTML=`${S.err&&!S.an?`<div class="note warn" style="margin-bottom:14px">Business numbers could not load right now. ${esc(S.err)}</div>`:''}
  <div class="kpis">${kpi('Monthly recurring',S.an?money(k.mrr):'–',S.an?money(k.cashCollected):'','collected · 30 days',col('mrr'),'/admin/billing.html')}${kpi('Active clients',S.an?num(k.activeClients):'–',S.an&&S.an.growth?'+'+num(S.an.growth.newClients):'','last 30 days',col('newClients'),'/admin/clients.html')}${kpi('Open leads',S.leads?num(open.length):'–',num(nw)+' new','waiting',col('leads'),'/admin/leads.html')}${kpi('QR scans',S.an?num(e.qrScans):'–',num(e.activeQrCodes),'active codes',col('qrScans'),'/admin/qr.html')}</div>
  <div class="grid2"><section class="card"><div class="card-h"><h3>Needs your attention</h3><a class="lnk2" href="/admin/leads.html">All leads</a></div><div class="list">${att.length?att.slice(0,7).map(a=>`<div class="li att"><span class="lic ${a[1]}">${ic(a[0])}</span><span style="min-width:0"><b>${esc(a[2])}</b>${a[3]?`<span class="s">${esc(a[3])}</span>`:''}</span><span class="end" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${a[4].map(x=>`<a class="btn ${x[2]?'gh':'ghost'} sm" href="${esc(x[1])}">${esc(x[0])}</a>`).join('')}</span></div>`).join(''):'<div class="empty"><b>Nothing waiting</b>Nice work.</div>'}</div></section>
   <div class="stack"><section class="card"><div class="card-h"><h3>Pipeline</h3><a class="lnk2" href="/admin/leads.html">Open CRM</a></div><div class="fbar" role="img" aria-label="Leads by stage">${ST.map(s=>`<i style="flex:${Math.max(cnt[s[0]],.3)};background:${s[2]}"></i>`).join('')}</div><div class="fleg">${ST.map(s=>`<a href="/admin/leads.html?stage=${s[0]}"><span><i style="background:${s[2]}"></i>${s[1]}</span><em>${S.leads?cnt[s[0]]:'–'}</em></a>`).join('')}</div></section>
   <section class="card"><div class="card-h"><h3>Recent activity</h3><a class="lnk2" href="/admin/activity.html">All</a></div><div class="list">${feed.length?feed.map(a=>`<a class="li" href="${a.lead_id?'/admin/leads.html?lead='+encodeURIComponent(a.lead_id):'/admin/activity.html'}"><span class="lic">${ic(ACTI[a.event_type]||'bell')}</span><span style="min-width:0"><b>${esc(a.title||'Studio update')}</b><span class="s">${esc(ago(a.created_at))}${a.detail?' · '+esc(a.detail):''}</span></span><span></span></a>`).join(''):'<div class="empty">Updates from your tools show up here.</div>'}</div></section></div></div>`}
const QUICK=[['inbox','Lead','/admin/leads.html'],['users','Client','/admin/clients.html'],['audit','Audit','/admin/audit.html'],['qr','QR code','/admin/qr.html'],['card','Sale','/admin/billing.html'],['cal','Request or project','/admin/projects.html'],['link','LinkHub','/admin/linkhub.html'],['bolt','Promotion','/admin/promotions.html']];
actions(`<button class="btn pri sm" type="button" data-quick>${ic('plus')}<span class="lbl">Create</span></button>`);
document.addEventListener('click',e=>{if(e.target.closest('[data-quick]'))sheet('Create',`<div class="list">${QUICK.map(q=>`<a class="li" href="${q[2]}"><span class="lic">${ic(q[0])}</span><span><b>${q[1]}</b></span>${ic('arrow')}</a>`).join('')}</div>`)});
root.innerHTML='<div class="kpis">'+'<div class="skel" style="height:118px"></div>'.repeat(4)+'</div><div class="grid2"><div class="skel" style="height:340px"></div><div class="skel" style="height:340px"></div></div>';
addEventListener('storage',()=>S.leads&&render());
V.ready().then(load);
})();
