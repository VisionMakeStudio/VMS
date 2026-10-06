/* VMS Admin v2 · Notifications & Activity — one feed for everything that happened across VMS.
   Data: vms_notifications_activity_v2 (synced to Supabase workspace_state by vms-state.js, same record shape as before)
   plus live activity_events from Supabase (imported as cloud-<id>; resolving one also resolves it in the database). */
(()=>{
'use strict';
const V=window.VMSv2,root=document.getElementById('pgRoot');if(!V||!root)return;
const {ic,esc,toast,sheet,closeSheet,num,kpi,actions,confirmSheet,sel}=V;
const KEY='vms_notifications_activity_v2';
const TYPES={Payment:'card',Client:'users',Project:'cal',File:'file',System:'gear',Audit:'audit',QR:'qr',Promotion:'tag','Manual Note':'edit'};
const NOISE=['linkhub_view','linkhub_click','qr_scan'];
const TARGETS=[['','No related tool'],['clients.html|Client Profile','Clients'],['projects.html|Projects & Requests','Projects & Requests'],['files.html|Files & Assets','Files & Assets'],['billing.html|Billing','Billing'],['audit.html|VMS Audit','VMS Audit'],['qr.html|QR Tools','QR Studio'],['promotions.html|Promotions','Promotions']];
const S={data:[],view:'all',q:'',f:{client:'',type:'',read:'',action:'',time:''},showF:false,sel:new Set(),selMode:false};
const parse=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch{return d}};
const nowIso=()=>new Date().toISOString();
const dOnly=d=>{const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const isToday=v=>dOnly(new Date(v))===dOnly(new Date());
const within=(v,n)=>{const x=(Date.now()-new Date(v).getTime())/864e5;return x>=0&&x<=n};
const when=v=>{const d=new Date(v),t=new Date(),y=new Date(t.getFullYear(),t.getMonth(),t.getDate()-1);return (dOnly(d)===dOnly(t)?'Today':dOnly(d)===dOnly(y)?'Yesterday':d.toLocaleDateString('en-US',{month:'short',day:'numeric'}))+' · '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})};
const full=v=>v?new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const stText=x=>x.needsAction&&x.resolved?'Resolved':x.needsAction?'Needs action':'Info';
const stTone=x=>x.needsAction&&x.resolved?'ok':x.needsAction&&x.priority==='Urgent'?'bad':x.needsAction?'warn':'';
const prTone=p=>p==='Urgent'?'bad':p==='High'?'warn':p==='Normal'?'info':'';
const live=()=>S.data.filter(x=>!x.deleted);
const itemFor=id=>S.data.find(x=>x.id===id);
function load(){const p=parse(KEY,[]);S.data=Array.isArray(p)?p:[]}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S.data))}catch{toast('Could not save on this device','error')}}
function clients(){const s=new Set();live().forEach(x=>x.client&&s.add(x.client));const c=parse('vms_clients_final_v1',[]);(Array.isArray(c)?c:[]).forEach(x=>x&&x.business&&s.add(x.business));
  const f=parse('vms_files_assets_v2',{})||{};[...(f.assets||[]),...(f.requests||[])].forEach(x=>x&&x.client&&s.add(x.client));const w=parse('vms_work_admin_v1',{})||{};[...(w.projects||[]),...(w.requests||[])].forEach(x=>x&&x.client&&s.add(x.client));
  S.cloudClients&&S.cloudClients.forEach(n=>s.add(n));return [...s].sort((a,b)=>a.localeCompare(b))}
const tabOk=x=>({all:1,action:x.needsAction&&!x.resolved,payments:x.type==='Payment',clients:x.type==='Client',projects:x.type==='Project',files:x.type==='File',system:x.type==='System'})[S.view];
function pass(x){const f=S.f,q=S.q.trim().toLowerCase();if(f.client&&x.client!==f.client)return false;if(f.type&&x.type!==f.type)return false;if(f.read==='unread'&&!x.unread)return false;if(f.read==='read'&&x.unread)return false;
  if(f.action==='open'&&!(x.needsAction&&!x.resolved))return false;if(f.action==='resolved'&&!(x.needsAction&&x.resolved))return false;if(f.action==='info'&&x.needsAction)return false;
  if(f.time==='today'&&!isToday(x.createdAt))return false;if(f.time&&f.time!=='today'&&!within(x.createdAt,+f.time))return false;
  return !q||[x.title,x.detail,x.client,x.type,x.source,x.priority,x.targetLabel].join(' ').toLowerCase().includes(q)}
const rows=()=>live().filter(x=>tabOk(x)&&pass(x)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

function render(){const d=live(),open=d.filter(x=>x.needsAction&&!x.resolved),vis=rows(),allSel=vis.length&&vis.every(x=>S.sel.has(x.id)),fOn=Object.values(S.f).filter(Boolean).length;
  const TABS=[['all','All',d.length],['action','Needs action',open.length],['payments','Payments',d.filter(x=>x.type==='Payment').length],['clients','Clients',d.filter(x=>x.type==='Client').length],['projects','Projects',d.filter(x=>x.type==='Project').length],['files','Files',d.filter(x=>x.type==='File').length],['system','System',d.filter(x=>x.type==='System').length]];
  root.innerHTML=`<div class="kpis">${kpi('Unread',num(d.filter(x=>x.unread).length),'','not reviewed yet')}${kpi('Needs action',num(open.length),open.filter(x=>x.priority==='Urgent').length?`<span class="down">${open.filter(x=>x.priority==='Urgent').length} urgent</span>`:'',open.filter(x=>x.priority==='Urgent').length?'':'open items')}${kpi('Today',num(d.filter(x=>isToday(x.createdAt)).length),'','events')}${kpi('Resolved',num(d.filter(x=>x.needsAction&&x.resolved&&x.resolvedAt&&within(x.resolvedAt,7)).length),'','this week')}</div>
  <div class="seg2" style="margin:16px 0 12px">${TABS.map(t=>`<button type="button" data-view="${t[0]}" aria-pressed="${S.view===t[0]}">${t[1]}<span class="cnt">${t[2]}</span></button>`).join('')}</div>
  <div class="toolbar"><label class="search">${ic('search')}<input class="inp" id="aq" type="search" placeholder="Search activity, client, payment, file or note" value="${esc(S.q)}"></label><button class="btn gh" type="button" data-filt aria-expanded="${S.showF}">${ic('filter')}Filter${fOn?' · '+fOn:''}</button><button class="btn gh" type="button" data-selmode aria-pressed="${S.selMode}">${ic('check')}${S.selMode?'Done':'Select'}</button></div>
  ${S.showF?`<div class="card fbox"><div class="fgrid5"><div class="fld"><label for="fc">Client</label><select class="sel" id="fc"><option value="">All clients</option>${clients().map(c=>`<option${c===S.f.client?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
   <div class="fld"><label for="ft">Type</label><select class="sel" id="ft">${sel('',[['','All types']].concat(Object.keys(TYPES)),S.f.type)}</select></div><div class="fld"><label for="fr">Read</label><select class="sel" id="fr">${sel('',[['','All'],['unread','Unread'],['read','Read']],S.f.read)}</select></div>
   <div class="fld"><label for="fa">Action</label><select class="sel" id="fa">${sel('',[['','All'],['open','Needs action'],['resolved','Resolved'],['info','Info only']],S.f.action)}</select></div><div class="fld"><label for="fw">Time</label><select class="sel" id="fw">${sel('',[['','Any time'],['today','Today'],['7','Last 7 days'],['30','Last 30 days']],S.f.time)}</select></div></div><button class="btn ghost sm" type="button" data-clear style="margin-top:10px">Clear filters</button></div>`:''}
  ${S.selMode?`<div class="bulk"><label class="bulk-all"><input type="checkbox" id="selAll"${allSel?' checked':''}><b>${S.sel.size} selected</b></label><div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn gh sm" type="button" data-bulk="read">Mark read</button><button class="btn gh sm" type="button" data-bulk="unread">Mark unread</button><button class="btn dg sm" type="button" data-bulk="del">${ic('trash')}Delete</button></div></div>`:''}
  <section class="card"><div class="list">${vis.length?vis.map(row).join(''):`<div class="empty"><b>${d.length?'Nothing matches this view':'No activity yet'}</b>${d.length?'Try another tab or clear filters.':'Payments, client requests, files and system updates show up here.'}</div>`}</div></section>`;
  const sa=root.querySelector('#selAll');if(sa)sa.indeterminate=!allSel&&vis.some(x=>S.sel.has(x.id))}
function row(x){const on=S.sel.has(x.id);return `<div class="li arow${x.unread?' unread':''}${on?' on':''}" data-id="${esc(x.id)}" role="button" tabindex="0">${S.selMode?`<input type="checkbox" class="acheck" data-pick="${esc(x.id)}"${on?' checked':''} aria-label="Select ${esc(x.title)}">`:''}<span class="lic ${stTone(x)}">${ic(TYPES[x.type]||'bell')}</span>
  <span style="min-width:0"><b>${x.unread?'<i class="udot" aria-label="Unread"></i>':''}${esc(x.title)}</b><span class="s">${esc(x.client||'General')} · ${esc(x.type)}${x.type==='Manual Note'&&x.area?' · '+esc(x.area):''}</span>${x.detail?`<span class="s aclip">${esc(x.detail)}</span>`:''}</span>
  <span class="end"><span class="chip ${stTone(x)}">${esc(stText(x))}</span><small>${esc(when(x.createdAt))}</small></span></div>`}

/* ── actions ── */
const logH=(x,t,d)=>{x.history=x.history||[];x.history.push({at:nowIso(),title:t,detail:d})};
function setRead(id,read){const x=itemFor(id);if(!x)return;x.unread=!read;logH(x,read?'Marked read':'Marked unread','VMS Admin');save();render();toast(read?'Marked read':'Marked unread')}
async function resolve(id){const x=itemFor(id);if(!x||!x.needsAction)return;x.resolved=!x.resolved;x.resolvedAt=x.resolved?nowIso():'';logH(x,x.resolved?'Resolved':'Reopened','VMS Admin');save();render();toast(x.resolved?'Item resolved':'Item reopened');
  if(x.id.startsWith('cloud-')){try{const sb=await VMSAuth.client();const r=await sb.from('activity_events').update({resolved:x.resolved}).eq('id',x.id.slice(6));if(r&&r.error)throw r.error}catch(e){console.warn('VMS activity resolve sync failed',e)}}}
async function remove(ids){ids=[...new Set(ids)].filter(itemFor);if(!ids.length)return false;const one=ids.length===1&&itemFor(ids[0]);
  if(!await confirmSheet(one?'Delete this notification?':`Delete ${ids.length} notifications?`,one?`“${esc(one.title)}” is removed from the Activity Center.`:'All selected notifications are removed from the Activity Center.',one?'Delete':`Delete ${ids.length}`,true))return false;
  const set=new Set(ids);S.data=S.data.filter(x=>!set.has(x.id)||x.id.startsWith('cloud-'));S.data.forEach(x=>{if(set.has(x.id)){x.deleted=true;x.unread=false}});ids.forEach(i=>S.sel.delete(i));save();render();toast(`${ids.length} notification${ids.length===1?'':'s'} deleted`);return true}
function detail(id,markRead=true){const x=itemFor(id);if(!x)return;if(markRead&&x.unread){x.unread=false;logH(x,'Marked read','Opened in Activity Center');save();render()}
  const hist=[{at:x.createdAt,title:'Activity recorded',detail:`${x.source||'VMS Admin'} · ${x.type}`},...(x.history||[])];if(x.resolvedAt&&!hist.some(h=>h.title==='Resolved'))hist.push({at:x.resolvedAt,title:'Resolved',detail:'VMS Admin'});
  sheet('Activity',`<div class="det-h"><span class="lic ${stTone(x)}">${ic(TYPES[x.type]||'bell')}</span><div style="min-width:0"><h3>${esc(x.title)}</h3><span class="s">${esc(x.client||'General VMS activity')}</span></div></div>
   <div class="row" style="gap:6px;flex-wrap:wrap"><span class="chip ${stTone(x)}">${esc(stText(x))}</span><span class="chip ${prTone(x.priority)}">${esc(x.priority||'Normal')} priority</span><span class="chip">${x.unread?'Unread':'Read'}</span></div>
   <div class="kv" style="margin-top:12px"><div class="r"><span>Type</span><b>${esc(x.type)}${x.area?' · '+esc(x.area):''}</b></div><div class="r"><span>Source</span><b>${esc(x.source||'VMS Admin')}</b></div><div class="r"><span>When</span><b>${esc(full(x.createdAt))}</b></div></div>
   <p class="fnote">${esc(x.detail||'No additional details.')}</p>
   ${x.target?`<a class="li" href="${esc(x.target)}" style="margin-top:8px"><span class="lic">${ic('arrow')}</span><span><b>${esc(x.targetLabel||'Related record')}</b><span class="s">Open in ${esc(x.source||'VMS Admin')}</span></span><span></span></a>`:''}
   <h4 class="fh4">History</h4><div class="tl">${hist.sort((a,b)=>new Date(b.at)-new Date(a.at)).map(h=>`<div class="it"><i></i><div><b>${esc(h.title)}</b><span>${esc(h.detail||'')}</span></div><time>${esc(full(h.at))}</time></div>`).join('')}</div>
   <div class="row" style="margin-top:16px;flex-wrap:wrap">${x.needsAction?`<button class="btn ${x.resolved?'gh':'pri'}" type="button" data-x="res">${ic(x.resolved?'refresh':'check')}${x.resolved?'Reopen':'Resolve'}</button>`:''}<button class="btn gh" type="button" data-x="read">${x.unread?'Mark read':'Mark unread'}</button><button class="btn dg" type="button" data-x="del">${ic('trash')}Delete</button></div>`,
   b=>b.onclick=async e=>{const t=e.target.closest('[data-x]');if(!t)return;const k=t.dataset.x;if(k==='res'){await resolve(id);return detail(id,false)}if(k==='read'){setRead(id,x.unread);return detail(id,false)}if(k==='del')await remove([id])})}
function noteSheet(){sheet('Add activity note',`<form id="nf" class="formsheet"><p class="muted" style="margin:0 0 12px">Record something so it shows in the company-wide history.</p><div class="fgrid">
  <div class="fld"><label for="nC">Client</label><select id="nC" class="sel"><option value="">General / no client</option>${clients().map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>
  <div class="fld"><label for="nA">Area</label><select id="nA" class="sel">${sel('',['Client','Project','File','Payment','System','Audit','QR','Promotion'],'Client')}</select></div>
  <div class="fld full"><label for="nT">Title</label><input id="nT" class="inp" required placeholder="e.g. Spoke with client about website photos"></div>
  <div class="fld"><label for="nP">Priority</label><select id="nP" class="sel">${sel('',['Normal','High','Urgent','Low'],'Normal')}</select></div><div class="fld"><label for="nR">Related tool</label><select id="nR" class="sel">${sel('',TARGETS,'')}</select></div>
  <div class="fld full"><label for="nX">Note</label><textarea id="nX" class="inp" rows="4" required placeholder="What happened, what was decided, or what to remember?"></textarea></div>
  <label class="ck full"><input type="checkbox" id="nN"><span><b>Needs VMS action</b><span>Stays in Needs action until it is resolved</span></span></label></div>
  <button class="btn pri" type="submit">${ic('plus')}Add note</button></form>`,b=>{const fm=b.querySelector('#nf');fm.onsubmit=e=>{e.preventDefault();const [target,targetLabel]=(fm.nR.value||'|').split('|');
  S.data.unshift({id:'note-'+Date.now(),type:'Manual Note',area:fm.nA.value,title:fm.nT.value.trim(),detail:fm.nX.value.trim(),client:fm.nC.value,source:'VMS Admin',createdAt:nowIso(),unread:false,needsAction:fm.nN.checked,resolved:false,priority:fm.nP.value,target:target||'',targetLabel:targetLabel||'',manual:true,history:[{at:nowIso(),title:'Manual note added',detail:'Area: '+fm.nA.value}]});
  save();closeSheet();render();toast('Activity note added')}})}
function importCloud(list){const typeFor=t=>{const x=String(t||'').toLowerCase();return x.includes('file')?'File':x.includes('qr')?'QR':/subscription|checkout|payment|billing|invoice/.test(x)?'Payment':/request|followup|lead|client|onboard/.test(x)?'Client':x.includes('audit')?'Audit':/project|schedule|job/.test(x)?'Project':'System'};
  const ex=new Map(S.data.map(x=>[x.id,x]));let changed=0;
  (list||[]).filter(r=>!NOISE.includes(r.event_type)).forEach(r=>{const id='cloud-'+r.id,prior=ex.get(id),m={id,type:typeFor(r.event_type),title:r.title||'VMS activity',detail:r.detail||'',client:r.clients&&r.clients.business_name||'',source:'Client Portal',createdAt:r.created_at||nowIso(),unread:true,needsAction:!!r.needs_action,resolved:!!r.resolved,priority:r.needs_action?'Normal':'Low',target:'',targetLabel:'',history:[]};
   if(prior){if(prior.deleted)return;const before=JSON.stringify(prior);Object.assign(prior,{...m,unread:prior.unread,resolved:prior.resolved||m.resolved,resolvedAt:prior.resolvedAt,history:prior.history||[]});if(JSON.stringify(prior)!==before)changed++}else{S.data.push(m);ex.set(id,m);changed++}});
  if(changed){save();render()}}

root.addEventListener('click',async e=>{const t=e.target.closest('button,[data-id],input[data-pick]');if(!t||!root.contains(t))return;const d=t.dataset;
  if(d.view){S.view=d.view;return render()}if('filt' in d){S.showF=!S.showF;return render()}if('clear' in d){S.f={client:'',type:'',read:'',action:'',time:''};S.q='';return render()}
  if('selmode' in d){S.selMode=!S.selMode;S.sel.clear();return render()}
  if(d.bulk){if(!S.sel.size)return toast('Select at least one notification','error');if(d.bulk==='del'){if(await remove([...S.sel])){S.selMode=false;render()}return}
    S.data.forEach(x=>{if(S.sel.has(x.id)){x.unread=d.bulk!=='read';logH(x,d.bulk==='read'?'Marked read':'Marked unread','Bulk action')}});save();render();return toast(d.bulk==='read'?'Selected marked read':'Selected marked unread')}
  if(d.pick){e.stopPropagation();S.sel.has(d.pick)?S.sel.delete(d.pick):S.sel.add(d.pick);return render()}
  if(d.id){if(S.selMode){S.sel.has(d.id)?S.sel.delete(d.id):S.sel.add(d.id);return render()}return detail(d.id)}});
root.addEventListener('change',e=>{const id=e.target.id,v=e.target.value;if(id==='selAll'){const vis=rows();e.target.checked?vis.forEach(x=>S.sel.add(x.id)):vis.forEach(x=>S.sel.delete(x.id));return render()}
  const m={fc:'client',ft:'type',fr:'read',fa:'action',fw:'time'}[id];if(m){S.f[m]=v;render()}});
root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.arow')){e.preventDefault();e.target.click()}});
root.addEventListener('input',e=>{if(e.target.id==='aq'){S.q=e.target.value;const p=e.target.selectionStart;render();const n=root.querySelector('#aq');n.focus();n.setSelectionRange(p,p)}});
actions(`<button class="btn gh sm" type="button" data-ax="read">${ic('check')}<span class="lbl">Mark all read</span></button><button class="btn pri sm" type="button" data-ax="note">${ic('plus')}<span class="lbl">Activity note</span></button>`);
document.addEventListener('click',e=>{const b=e.target.closest('[data-ax]');if(!b)return;if(b.dataset.ax==='note')return noteSheet();const u=live().filter(x=>x.unread);if(!u.length)return toast('Everything is already read');u.forEach(x=>{x.unread=false;logH(x,'Marked read','Mark all read')});save();render();toast(`${u.length} marked read`)});
addEventListener('storage',e=>{if(e.key===KEY){load();render()}});
load();render();
V.ready().then(async()=>{const st=await V.state();if(st&&st.changed){load();render()}
  try{const sb=await VMSAuth.client();const [ev,cl]=await Promise.all([sb.from('activity_events').select('id,event_type,title,detail,needs_action,resolved,created_at,clients(business_name)').order('created_at',{ascending:false}).limit(200),sb.from('clients').select('business_name').neq('status','archived')]);
   S.cloudClients=(cl&&cl.data||[]).map(c=>c.business_name).filter(Boolean);if(ev&&ev.error)throw ev.error;importCloud(ev&&ev.data||[]);render()}catch(e){console.warn('VMS activity cloud feed failed',e)}});
})();
