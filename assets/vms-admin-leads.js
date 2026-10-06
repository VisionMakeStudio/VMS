/* VMS Admin v2 · CRM / Leads — every inquiry (intake_requests) through /api/leads.
   Stage, score, follow-up, services, notes, convert to client, onboarding tasks, portal invite,
   new lead by hand, and delete (via /api/admin-cleanup). */
(()=>{
'use strict';
const V=window.VMSv2,root=document.getElementById('pgRoot');if(!V||!root)return;
const {ic,esc,toast,sheet,closeSheet,api,ago,date,actions,confirmSheet,sel}=V;
const $=(s,r=root)=>r.querySelector(s),$$=(s,r=root)=>[...r.querySelectorAll(s)];
const STAGES=[['new','New','info'],['contacted','Contacted','warn'],['qualified','Qualified','warn'],['won','Won','ok'],['lost','Lost','bad']];
const SN=Object.fromEntries(STAGES.map(s=>[s[0],s]));
const q0=new URLSearchParams(location.search);
const S={d:{leads:[],notes:[],activities:[],catalog:[],onboarding:[],tasks:[]},sel:null,stage:SN[q0.get('stage')]?q0.get('stage'):'all',due:false,q:'',loading:true,err:'',want:q0.get('lead')};
const stage=l=>{const s=String(l.status||'new').toLowerCase();return SN[s]?s:'new'};
const isDue=l=>l.follow_up_at&&!['won','lost'].includes(stage(l))&&new Date(l.follow_up_at)<Date.now();
const ini=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const lead=()=>S.d.leads.find(l=>l.id===S.sel)||null;
const wide=()=>matchMedia('(min-width:1000px)').matches;
const localIn=v=>{if(!v)return'';const d=new Date(v);if(isNaN(d))return'';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
const call=(body)=>api('/api/leads',{method:'POST',body});

async function load(keep){S.loading=true;try{const d=await api('/api/leads');S.d={leads:d.leads||[],notes:d.notes||[],activities:d.activities||[],catalog:d.catalog||[],onboarding:d.onboarding||[],tasks:d.tasks||[]};S.err='';
  if(S.want&&S.d.leads.some(l=>l.id===S.want)){S.sel=S.want;S.want=null}else if(!keep||!S.d.leads.some(l=>l.id===S.sel))S.sel=wide()?(S.d.leads[0]||{}).id||null:null}
  catch(e){S.err=e.message}S.loading=false;render()}
function list(){const q=S.q.trim().toLowerCase();return S.d.leads.filter(l=>{if(q&&![l.business_name,l.contact_name,l.email,l.phone,l.website,l.goal,l.source].join(' ').toLowerCase().includes(q))return false;if(S.stage!=='all'&&stage(l)!==S.stage)return false;if(S.due&&!isDue(l))return false;return true})}

function render(){
  if(S.loading&&!S.d.leads.length){root.innerHTML='<div class="skel" style="height:46px;margin-bottom:12px"></div><div class="split"><div class="skel" style="height:420px"></div><div class="skel" style="height:420px"></div></div>';return}
  if(S.err){root.innerHTML=`<div class="note bad"><b>Could not load leads.</b> ${esc(S.err)} <button class="btn gh sm" type="button" data-reload>Try again</button></div>`;return}
  const L=S.d.leads,rows=list(),cnt=k=>L.filter(l=>stage(l)===k).length,due=L.filter(isDue).length;
  root.innerHTML=`<div class="toolbar"><label class="search">${ic('search')}<input class="inp" id="lq" type="search" placeholder="Search leads" value="${esc(S.q)}" aria-label="Search leads"></label></div>
  <div class="pills" style="margin-bottom:14px">${[['all','All',L.length]].concat(STAGES.map(s=>[s[0],s[1],cnt(s[0])])).map(p=>`<button type="button" class="pill" data-stage="${p[0]}" aria-pressed="${S.stage===p[0]&&!S.due}">${p[1]} <em>${p[2]}</em></button>`).join('')}<button type="button" class="pill" data-due aria-pressed="${S.due}">Follow-up due <em>${due}</em></button></div>
  <div class="split"><section class="card"><div class="card-h"><h3>${rows.length} of ${L.length} leads</h3><button class="btn ghost sm" type="button" data-reload>${ic('refresh')}Refresh</button></div><div class="list" id="llist">
   ${rows.length?rows.map(l=>{const s=SN[stage(l)];return `<button type="button" class="li" data-lead="${esc(l.id)}"${l.id===S.sel?' aria-current="page"':''}><span class="av sm">${esc(ini(l.business_name))}</span><span style="min-width:0"><b>${esc(l.business_name||'Unnamed business')}</b><span class="s">${esc([l.contact_name,l.source].filter(Boolean).join(' · ')||l.email||'')}</span></span><span class="end"><span class="chip ${s[2]}">${s[1]}</span>${isDue(l)?'<small style="color:var(--bad)">Follow-up due</small>':`<small>${esc(ago(l.created_at))}</small>`}</span></button>`}).join(''):`<div class="empty"><b>${L.length?'No matching leads':'No leads yet'}</b>${L.length?'Try another filter.':'New website checkups and inquiries land here automatically.'}</div>`}</div></section>
   ${wide()?`<section class="card sticky" id="ldet">${detail()}</section>`:''}</div>`;
  if(wide())bindDetail($('#ldet'))}

function detail(){const l=lead();if(!l)return '<div class="empty"><b>Pick a lead</b>Its details, notes and next steps show here.</div>';
  const s=SN[stage(l)],picked=new Set(l.service_ids||[]),svc=S.d.catalog.filter(x=>String(x.status||'').toLowerCase()==='published'),converted=!!l.converted_client_id;
  const tl=[...S.d.notes.filter(n=>n.lead_id===l.id).map(n=>({k:'note',t:'Note',d:n.note,w:n.created_at})),...S.d.activities.filter(a=>a.lead_id===l.id).map(a=>({k:'act',t:a.title,d:a.detail,w:a.created_at}))].sort((a,b)=>new Date(b.w)-new Date(a.w));
  let web=String(l.website||'').trim();if(web&&!/^https?:\/\//i.test(web))web='https://'+web;
  const nextS=STAGES[Math.min(3,STAGES.findIndex(x=>x[0]===stage(l))+1)];
  return `<div class="det-h"><span class="av">${esc(ini(l.business_name))}</span><div style="flex:1;min-width:0"><h3>${esc(l.business_name||'Unnamed business')}</h3><span class="s">${esc([l.contact_name,l.source].filter(Boolean).join(' · '))}</span></div><span class="chip ${s[2]}">${s[1]}</span></div>
   <div class="row" style="margin-bottom:12px">${l.email?`<a class="btn gh sm" href="mailto:${esc(l.email)}">${ic('mail')}Email</a>`:''}${l.phone?`<a class="btn gh sm" href="tel:${esc(String(l.phone).replace(/[^+0-9]/g,''))}">${ic('phone')}Call</a>`:''}${web?`<a class="btn gh sm" href="${esc(web)}" target="_blank" rel="noopener">${ic('globe')}Website</a>`:''}</div>
   <div class="kv"><div class="r"><span>Contact</span><b>${esc([l.email,l.phone].filter(Boolean).join(' · ')||'—')}</b></div><div class="r"><span>Goal</span><b>${esc(l.goal||'Not specified')}</b></div><div class="r"><span>Received</span><b>${esc(date(l.created_at,true))}</b></div></div>
   ${l.message?`<div class="fld" style="margin-top:12px"><span class="l">Their message</span><div class="insight" style="white-space:pre-wrap">${esc(l.message)}</div></div>`:''}
   <div class="row" style="margin:14px 0"><a class="btn pri sm" href="/admin/audit.html">${ic('audit')}Start audit</a>${!['won','lost'].includes(stage(l))&&nextS[0]!==stage(l)?`<button class="btn gh sm" type="button" data-next="${nextS[0]}">Move to ${nextS[1]} ${ic('arrow')}</button>`:''}</div>
   <div class="stack" style="gap:12px"><div class="fgrid">
    <div class="fld"><label for="lSt">Stage</label><select id="lSt" class="sel">${sel('',STAGES.map(x=>[x[0],x[1]]),stage(l))}</select></div>
    <div class="fld"><label for="lSc">Lead score</label><input id="lSc" class="inp" type="number" min="0" max="100" value="${Number(l.lead_score||50)}"></div>
    <div class="fld"><label for="lCm">Best way to reach</label><select id="lCm" class="sel">${sel('',[['','Not set'],'Email','Phone','Text','In person'],l.contact_method||'')}</select></div>
    <div class="fld"><label for="lCt">Best time</label><input id="lCt" class="inp" value="${esc(l.contact_time||'')}" placeholder="e.g. Weekday mornings"></div>
    <div class="fld"><label for="lFu">Follow up on</label><input id="lFu" class="inp" type="datetime-local" value="${localIn(l.follow_up_at)}"></div>
    <div class="fld"${stage(l)==='lost'?'':' hidden'} id="lLrW"><label for="lLr">Why it was lost</label><input id="lLr" class="inp" value="${esc(l.lost_reason||'')}"></div>
    <div class="fld full"><label for="lSum">Internal summary</label><textarea id="lSum" class="inp" rows="3">${esc(l.internal_summary||'')}</textarea></div></div>
    <div class="fld"><span class="l">Services they want</span><div class="ckgrid">${svc.length?svc.map(x=>{const p=x.recurring_price!=null?`$${Number(x.recurring_price).toFixed(2)}${x.cadence?' / '+x.cadence:''}`:x.one_time_price!=null?`$${Number(x.one_time_price).toFixed(2)}`:x.pricing_model||'Quote';return `<label class="ck"><input type="checkbox" data-svc="${esc(x.id)}"${picked.has(x.id)?' checked':''}><span><b>${esc(x.name)}</b><span>${esc(x.category||'Service')} · ${esc(p)}</span></span></label>`}).join(''):'<p class="muted">No published services in the catalog.</p>'}</div></div>
    <div class="row"><button class="btn pri" type="button" data-save>${ic('check')}Save lead</button><span class="sp"></span><button class="btn dg sm" type="button" data-del>${ic('trash')}Delete</button></div></div>
   ${converted?onboarding(l):`<div class="trow" style="margin-top:16px"><div><b>Ready to start work?</b><span>Turns this lead into a client with the services checked above.</span></div><button class="btn acc sm" type="button" data-convert>Convert to client</button></div>`}
   <div style="margin-top:18px"><div class="card-h" style="margin-bottom:8px"><h3>Notes & activity</h3></div><div class="row" style="flex-wrap:nowrap;margin-bottom:8px"><input id="lNote" class="inp" placeholder="Add a private note"><button class="btn gh" type="button" data-note>Add</button></div>
    <div class="tl">${tl.length?tl.map(x=>`<div class="it ${x.k==='note'?'note':''}"><i></i><div><b>${esc(x.t)}</b><span>${esc(x.d||'')}</span></div><time>${esc(ago(x.w))}</time></div>`).join(''):'<div class="empty">No notes yet.</div>'}</div></div>`}
function onboarding(l){const ob=S.d.onboarding.find(o=>o.client_id===l.converted_client_id),t=S.d.tasks.filter(x=>x.client_id===l.converted_client_id),done=t.filter(x=>x.status==='complete'||x.status==='waived').length,pct=t.length?Math.round(done/t.length*100):0;
  return `<div class="card flat" style="margin-top:16px"><div class="card-h"><h3>Onboarding</h3><a class="lnk2" href="/admin/clients.html">Open client</a></div><div class="row" style="font-size:13.5px;margin-bottom:6px"><span class="muted">${pct}% done · ${esc(ob&&ob.status?String(ob.status).replace(/_/g,' '):'in progress')}</span></div><div class="prog"><i style="width:${pct}%"></i></div>
   <div class="trow" style="margin-top:12px"><div><b>Client Portal invite</b><span>${ob&&ob.portal_invited_at?'Sent '+esc(date(ob.portal_invited_at,true)):'Not sent yet'}</span></div><button class="btn gh sm" type="button" data-invite>${ob&&ob.portal_invited_at?'Send again':'Send invite'}</button></div>
   <div class="list" style="margin-top:8px">${t.length?t.map(x=>`<div class="li" style="grid-template-columns:auto minmax(0,1fr) auto"><input type="checkbox" data-task="${esc(x.id)}"${x.status==='complete'?' checked':''} style="width:20px;height:20px;accent-color:var(--ok)" aria-label="Done"><span><b style="${x.status==='waived'?'text-decoration:line-through;opacity:.6':''}">${esc(x.title)}</b><span class="s">${x.status==='complete'?'Done':x.status==='waived'?'Skipped':'To do'}</span></span><button class="btn ghost sm" type="button" data-waive="${esc(x.id)}">${x.status==='waived'?'Restore':'Skip'}</button></div>`).join(''):'<div class="empty">No onboarding tasks yet.</div>'}</div></div>`}

function bindDetail(box){if(!box)return;const st=$('#lSt',box);if(st)st.onchange=()=>{$('#lLrW',box).hidden=st.value!=='lost'}}
function vals(box){return {status:$('#lSt',box).value,lead_score:$('#lSc',box).value,contact_method:$('#lCm',box).value,contact_time:$('#lCt',box).value,follow_up_at:$('#lFu',box).value?new Date($('#lFu',box).value).toISOString():null,lost_reason:$('#lLr',box).value,internal_summary:$('#lSum',box).value,service_ids:$$('[data-svc]:checked',box).map(x=>x.dataset.svc)}}
async function act(box,t){const d=t.dataset,l=lead();if(!l)return;
  if('save' in d||d.next){const v=vals(box);if(d.next)v.status=d.next;t.disabled=true;try{await call(Object.assign({action:'update',id:l.id},v));toast(d.next?'Moved to '+SN[d.next][1]:'Lead saved');await load(true);refreshSheet()}catch(e){toast(e.message,'error')}finally{t.disabled=false}}
  if('note' in d){const n=$('#lNote',box).value.trim();if(!n)return;t.disabled=true;try{await call({action:'note',id:l.id,note:n});toast('Note added');await load(true);refreshSheet()}catch(e){toast(e.message,'error')}finally{t.disabled=false}}
  if('convert' in d){if(!(await confirmSheet('Convert to client?',`${esc(l.business_name||'This lead')} becomes a VMS client with the services you checked. Onboarding tasks are created for you.`,'Convert to client')))return;try{await call({action:'convert',id:l.id,service_ids:$$('[data-svc]:checked',box).map(x=>x.dataset.svc)});toast('Converted to client');await load(true);refreshSheet()}catch(e){toast(e.message,'error')}}
  if('invite' in d){t.disabled=true;try{const r=await call({action:'invite',id:l.id});toast(r.message||'Portal invite sent');await load(true);refreshSheet()}catch(e){toast(e.message,'error')}finally{t.disabled=false}}
  if(d.waive){const x=S.d.tasks.find(k=>k.id===d.waive);try{await call({action:'onboarding-task',task_id:d.waive,status:x&&x.status==='waived'?'pending':'waived'});await load(true);refreshSheet()}catch(e){toast(e.message,'error')}}
  if('del' in d)delLead(l)}
async function delLead(l){try{const info=(await api('/api/admin-cleanup',{method:'POST',body:{action:'inspect_lead',id:l.id}})).lead||{};const name=esc(info.businessName||l.business_name||'this lead');
  const html=info.converted?`<p class="muted">${name} is already a client. ${info.canDeleteClient?'Remove only the lead and keep the client, or permanently remove both.':'It has payment history, so the client cannot be deleted here. Archive the client in Clients instead.'}</p>`:`<p class="muted">This permanently removes ${name}, its private notes and follow-up records.</p>`;
  sheet('Delete lead?',html+`<div class="row" style="margin-top:16px"><button class="btn acc" type="button" data-x="lead">${info.converted?'Delete lead only':'Delete lead'}</button>${info.converted&&info.canDeleteClient?'<button class="btn dg" type="button" data-x="both">Delete lead + client</button>':''}<button class="btn gh" type="button" data-x="no">Cancel</button></div>`,b=>b.onclick=async e=>{const t=e.target.closest('[data-x]');if(!t)return;closeSheet();if(t.dataset.x==='no')return;
    if(t.dataset.x==='both'&&!(await confirmSheet('Delete the client too?','The client record and its related VMS records are removed for good. This cannot be undone.','Delete both',true)))return;
    try{await api('/api/admin-cleanup',{method:'POST',body:{action:t.dataset.x==='both'?'delete_lead_client':'delete_lead',id:l.id}});toast('Deleted');S.sel=null;await load(false)}catch(err){toast(err.message,'error')}})}catch(e){toast(e.message,'error')}}
function openSheet(){sheet('Lead','<div id="lsheet"></div>',b=>{const box=$('#lsheet',b);box.innerHTML=detail();bindDetail(box);box.onclick=e=>{const t=e.target.closest('button');if(t)act(box,t)};box.onchange=e=>{const c=e.target.closest('[data-task]');if(c)taskChange(c)}})}
function refreshSheet(){const box=document.getElementById('lsheet');if(box&&document.getElementById('v2Sheet').open){box.innerHTML=detail();bindDetail(box)}}
async function taskChange(c){try{await call({action:'onboarding-task',task_id:c.dataset.task,status:c.checked?'complete':'pending'});await load(true);refreshSheet()}catch(e){toast(e.message,'error')}}
function newLead(){sheet('New lead',`<form id="nlf" class="formsheet"><div class="fld"><label for="nB">Business name</label><input id="nB" class="inp" required></div><div class="fld"><label for="nC">Contact name</label><input id="nC" class="inp"></div><div class="fld"><label for="nE">Email</label><input id="nE" class="inp" type="email" required></div><div class="fld"><label for="nP">Phone</label><input id="nP" class="inp" inputmode="tel"></div><div class="fld"><label for="nW">Website</label><input id="nW" class="inp" inputmode="url"></div><div class="fld"><label for="nG">What they want</label><input id="nG" class="inp" placeholder="e.g. New website + Google Maps"></div><div class="fld"><label for="nS">Where they came from</label><select id="nS" class="sel">${sel('',['Phone call','Walk-in','Referral','Instagram','QR flyer','Event','Other'],'Phone call')}</select></div><div class="fld"><label for="nM">Notes</label><textarea id="nM" class="inp" rows="3"></textarea></div><button class="btn pri block" type="submit">${ic('plus')}Add lead</button></form>`,
  b=>{const f=b.querySelector('#nlf');f.onsubmit=async e=>{e.preventDefault();const btn=f.querySelector('[type=submit]');btn.disabled=true;try{const r=await call({action:'create',business_name:f.nB.value,contact_name:f.nC.value,email:f.nE.value,phone:f.nP.value,website:f.nW.value,goal:f.nG.value,source:f.nS.value,message:f.nM.value});closeSheet();toast('Lead added');S.sel=r.lead&&r.lead.id;S.stage='all';await load(true);if(!wide()&&S.sel)openSheet()}catch(err){toast(err.message,'error');btn.disabled=false}};setTimeout(()=>f.nB.focus(),80)})}

root.addEventListener('click',e=>{const t=e.target.closest('button');if(!t||!root.contains(t))return;const d=t.dataset;
  if('reload' in d)return load(true);
  if(d.stage){S.stage=d.stage;S.due=false;return render()}
  if('due' in d){S.due=!S.due;S.stage='all';return render()}
  if(d.lead){S.sel=d.lead;if(wide()){render()}else{render();openSheet()}return}
  const box=t.closest('#ldet');if(box)act(box,t)});
root.addEventListener('change',e=>{const c=e.target.closest('[data-task]');if(c)taskChange(c)});
root.addEventListener('input',e=>{if(e.target.id==='lq'){S.q=e.target.value;const p=e.target.selectionStart;render();const n=$('#lq');n.focus();n.setSelectionRange(p,p)}});
let wasWide=wide();addEventListener('resize',()=>{if(wide()!==wasWide){wasWide=wide();render()}});
actions(`<button class="btn pri sm" type="button" data-newlead>${ic('plus')}<span class="lbl">New lead</span></button>`);
document.addEventListener('click',e=>{if(e.target.closest('[data-newlead]'))newLead()});
render();V.ready().then(()=>load(false)).then(()=>{if(!wide()&&S.sel)openSheet()});
})();
