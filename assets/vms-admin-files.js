/* VMS Admin v2 · Files & Assets — working files, client uploads, file requests and archive.
   Data: vms_files_assets_v2 (synced to Supabase workspace_state by vms-state.js, same record shape as before).
   Files: private Supabase Storage via VMSFiles (bucket vms-client-files). Clients: Supabase clients table
   plus the shared client store. Projects: shared work store plus scheduled jobs. */
(()=>{
'use strict';
const V=window.VMSv2,root=document.getElementById('pgRoot');if(!V||!root)return;
const {ic,esc,toast,sheet,closeSheet,api,num,kpi,actions,confirmSheet,sel}=V;
const KEY='vms_files_assets_v2',CLIENTS_KEY='vms_clients_final_v1',WORK_KEY='vms_work_admin_v1';
const CATS=['Logo / Brand','Photo','Video','Website Content','Document / PDF','QR / Print Artwork','Social Media','Contract / Agreement','Other'];
const A_ST=['Ready','Needs Review','Draft'],R_ST=['Requested','Reminder Sent','Received','Fulfilled','Canceled'];
const parse=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch{return d}};
const todayISO=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const nowIso=()=>new Date().toISOString();
const nice=v=>v?new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
const bytes=n=>{if(!n)return'';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<3){v/=1024;i++}return `${v.toFixed(i?1:0)} ${u[i]}`};
const ext=n=>{const p=String(n||'').split('.');return p.length>1?p.pop().toUpperCase().slice(0,4):''};
const tone=s=>['Ready','Reviewed','Fulfilled','Received'].includes(s)?'ok':['Needs Review','Requested','Reminder Sent'].includes(s)?'warn':s==='Draft'?'info':['Canceled','Archived'].includes(s)?'bad':'';
const isImg=(n,m)=>String(m||'').startsWith('image/')||/\.(png|jpe?g|gif|webp|svg)$/i.test(n||'');
const isPdf=(n,m)=>String(m||'')==='application/pdf'||/\.pdf$/i.test(n||'');
const S={data:{assets:[],requests:[]},cloudClients:[],jobs:[],view:'assets',q:'',f:{client:'',cat:'',project:'',status:''},showF:false};
const session=new Map();
function loadData(){const p=parse(KEY,null);S.data=p&&Array.isArray(p.assets)&&Array.isArray(p.requests)?p:{assets:[],requests:[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S.data))}catch(e){toast('Could not save on this device','error')}}
const assetFor=id=>S.data.assets.find(x=>x.id===id),reqFor=id=>S.data.requests.find(x=>x.id===id);
const outstanding=r=>!['Fulfilled','Canceled'].includes(r.status);
const newUpload=a=>!a.archived&&a.source==='Client Upload'&&a.status==='Needs Review';
const thisWeek=a=>{if(a.archived||!a.addedDate)return false;const d=(new Date(todayISO()+'T12:00:00')-new Date(a.addedDate+'T12:00:00'))/864e5;return d>=0&&d<=7};
const overdue=r=>outstanding(r)&&r.dueDate&&new Date(r.dueDate+'T12:00:00')<new Date(todayISO()+'T12:00:00');
function clients(){const m=new Map();
  S.cloudClients.forEach(c=>c.business_name&&m.set(c.business_name,{id:c.id,business:c.business_name,email:c.owner_email||''}));
  const local=parse(CLIENTS_KEY,[]);(Array.isArray(local)?local:[]).forEach(c=>{if(c&&c.business&&!m.has(c.business))m.set(c.business,{id:c.id||'',business:c.business,email:c.email||'',logo:c.logo||c.logoUrl||c.logoURL||c.businessLogo||c.image||c.imageUrl||c.avatar||c.photo||''})});
  [...S.data.assets,...S.data.requests].forEach(x=>{if(x.client&&!m.has(x.client))m.set(x.client,{id:x.clientId||'',business:x.client,email:''})});
  return [...m.values()].sort((a,b)=>a.business.localeCompare(b.business))}
function projects(){const m=new Map(),work=parse(WORK_KEY,{});
  (work&&Array.isArray(work.projects)?work.projects:[]).forEach(p=>{if(p&&p.client&&p.name)m.set(p.client+'|'+p.name,{id:p.id||'',client:p.client,name:p.name})});
  S.jobs.forEach(j=>{const c=(S.cloudClients.find(x=>x.id===j.client_id)||{}).business_name;if(c&&j.title&&!['canceled'].includes(j.status))m.set(c+'|'+j.title,{id:j.id,client:c,name:j.title})});
  [...S.data.assets,...S.data.requests].forEach(x=>{if(x.client&&x.project)m.set(x.client+'|'+x.project,{id:x.projectId||'',client:x.client,name:x.project})});
  return [...m.values()].sort((a,b)=>a.name.localeCompare(b.name))}
const initials=n=>String(n||'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'CL';
function logo(name){const c=clients().find(x=>x.business===name)||{};if(c.logo&&/^(data:image\/|blob:|https?:\/\/)/i.test(c.logo))return `<span class="flogo"><img src="${esc(c.logo)}" alt=""></span>`;
  const la=S.data.assets.find(a=>!a.archived&&a.client===name&&a.category==='Logo / Brand'&&session.has(a.id));return la?`<span class="flogo"><img src="${esc(session.get(la.id).url)}" alt=""></span>`:`<span class="flogo">${esc(initials(name))}</span>`}
function summary(name){const active=S.data.assets.filter(a=>!a.archived&&a.client===name);return {active,uploads:active.filter(newUpload),out:S.data.requests.filter(r=>r.client===name&&outstanding(r)),arch:S.data.assets.filter(a=>a.archived&&a.client===name)}}
function pass(x,type){const f=S.f,q=S.q.trim().toLowerCase();if(f.client&&x.client!==f.client)return false;if(f.cat&&x.category!==f.cat)return false;if(f.project&&x.project!==f.project)return false;if(f.status&&x.status!==f.status)return false;
  if(!q)return true;return (type==='asset'?[x.name,x.fileName,x.client,x.project,x.category,x.source,x.visibility,x.note]:[x.name,x.client,x.project,x.category,x.status,x.method,x.note]).join(' ').toLowerCase().includes(q)}
const byDate=(a,b)=>String(b.addedDate).localeCompare(String(a.addedDate));

/* ── render ── */
function render(){const d=S.data,act=d.assets.filter(a=>!a.archived),up=act.filter(newUpload),out=d.requests.filter(outstanding),arch=d.assets.filter(a=>a.archived),cs=clients();
  const TABS=[['assets','All assets',act.length],['clients','By client',cs.length],['uploads','Client uploads',up.length],['requests','Needs files',out.length],['archived','Archived',arch.length]];
  const stOpts=S.view==='requests'?R_ST:S.view==='clients'?['Ready','Needs Review','Draft','Requested','Reminder Sent','Received']:A_ST;
  const fOn=Object.values(S.f).filter(Boolean).length;
  root.innerHTML=`<div class="kpis">${kpi('Total assets',num(act.length),'','not archived')}${kpi('New client uploads',num(up.length),'','to review')}${kpi('Waiting on client',num(out.length),out.filter(overdue).length?`<span class="down">${out.filter(overdue).length} overdue</span>`:'',out.filter(overdue).length?'':'open requests')}${kpi('Added this week',num(act.filter(thisWeek).length),'','last 7 days')}</div>
  <div class="seg2" style="margin:16px 0 12px">${TABS.map(t=>`<button type="button" data-view="${t[0]}" aria-pressed="${S.view===t[0]}">${t[1]}<span class="cnt">${t[2]}</span></button>`).join('')}</div>
  <div class="toolbar"><label class="search">${ic('search')}<input class="inp" id="fq" type="search" placeholder="Search file, client, project or note" value="${esc(S.q)}"></label><button class="btn gh" type="button" data-filt aria-expanded="${S.showF}">${ic('filter')}Filter${fOn?` · ${fOn}`:''}</button></div>
  ${S.showF?`<div class="card fbox"><div class="fgrid4"><div class="fld"><label for="fc">Client</label><select class="sel" id="fc"><option value="">All clients</option>${cs.map(c=>`<option${c.business===S.f.client?' selected':''}>${esc(c.business)}</option>`).join('')}</select></div>
   <div class="fld"><label for="fk">Category</label><select class="sel" id="fk">${sel('',[['','All categories']].concat(CATS),S.f.cat)}</select></div>
   <div class="fld"><label for="fp">Project</label><select class="sel" id="fp"><option value="">All projects</option>${projects().filter(p=>!S.f.client||p.client===S.f.client).map(p=>`<option${p.name===S.f.project?' selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
   <div class="fld"><label for="fs">Status</label><select class="sel" id="fs">${sel('',[['','All statuses']].concat(stOpts),S.f.status)}</select></div></div><button class="btn ghost sm" type="button" data-clear style="margin-top:10px">Clear filters</button></div>`:''}
  ${S.view==='clients'?clientCards():S.view==='requests'?reqList():assetList()}`}
function assetRow(a){const st=a.archived?'Archived':a.status,e=ext(a.fileName);
  return `<div class="li frow" data-asset="${esc(a.id)}" role="button" tabindex="0"><span class="lic fext ${tone(st)}">${e?`<em>${esc(e)}</em>`:ic('file')}</span><span style="min-width:0"><b>${esc(a.name)}</b><span class="s">${esc(a.client)} · ${esc(a.category)}${a.project?' · '+esc(a.project):''}</span><span class="s">${esc(a.fileName||'No file attached')}${a.fileSize?' · '+esc(a.fileSize):''} · ${esc(a.visibility)}</span></span>
   <span class="end"><span class="chip ${tone(st)}">${esc(st)}</span><small>${esc(nice(a.addedDate))}</small>${!a.archived&&a.status==='Needs Review'?`<button class="btn gh sm" type="button" data-review="${esc(a.id)}">${ic('check')}Reviewed</button>`:''}${a.archived?`<button class="btn gh sm" type="button" data-restore="${esc(a.id)}">Restore</button>`:''}</span></div>`}
function assetList(){const v=S.view,rows=S.data.assets.filter(a=>(v==='archived'?a.archived:v==='uploads'?newUpload(a):!a.archived)&&pass(a,'asset')).sort(byDate);
  return `<section class="card">${v==='uploads'?'<div class="card-h"><h3>Client uploads needing review</h3></div>':''}<div class="list">${rows.length?rows.map(assetRow).join(''):`<div class="empty"><b>${v==='uploads'?'No uploads to review':v==='archived'?'Nothing archived':S.data.assets.length?'No assets match this view':'No files yet'}</b>${v==='assets'&&!S.data.assets.length?'Add a file or request one from a client.':''}</div>`}</div></section>`}
function reqRow(r){return `<div class="li frow" data-req="${esc(r.id)}" role="button" tabindex="0"><span class="lic ${overdue(r)?'bad':'warn'}">${ic('inbox')}</span><span style="min-width:0"><b>${esc(r.name)}</b><span class="s">${esc(r.client)} · ${esc(r.category)}${r.project?' · '+esc(r.project):''}</span><span class="s">Asked ${esc(nice(r.requestedDate))} · ${esc(r.method||'')}</span></span>
  <span class="end"><span class="chip ${tone(r.status)}">${esc(r.status)}</span><small${overdue(r)?' style="color:var(--bad)"':''}>${r.dueDate?(overdue(r)?'Overdue · ':'Due ')+esc(nice(r.dueDate)):'No due date'}</small>${!r.receivedAssetId?`<button class="btn gh sm" type="button" data-receive="${esc(r.id)}">${ic('upload')}Received</button>`:''}</span></div>`}
function reqList(){const rows=S.data.requests.filter(r=>outstanding(r)&&pass(r,'request')).sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
  return `<section class="card"><div class="card-h"><h3>Files you are waiting for</h3><button class="btn pri sm" type="button" data-newreq>${ic('plus')}Request file</button></div><div class="list">${rows.length?rows.map(reqRow).join(''):'<div class="empty"><b>Nothing outstanding</b>Request a file and track it here until it arrives.</div>'}</div></section>`}
function clientCards(){const q=S.q.trim().toLowerCase(),f=S.f;const rows=clients().filter(c=>{if(f.client&&c.business!==f.client)return false;const x=summary(c.business),rel=[...x.active,...x.out,...x.arch];
   if(f.cat&&!rel.some(y=>y.category===f.cat))return false;if(f.project&&!rel.some(y=>y.project===f.project))return false;if(f.status&&!rel.some(y=>y.status===f.status))return false;
   return !q||[c.business,...rel.flatMap(y=>[y.name,y.fileName,y.project,y.category,y.status,y.note])].join(' ').toLowerCase().includes(q)});
  return rows.length?`<div class="cgrid">${rows.map(c=>{const x=summary(c.business),att=x.uploads.length+x.out.length;return `<button type="button" class="card fcc" data-client="${esc(c.business)}"><span class="fcc-h">${logo(c.business)}<span style="min-width:0"><b>${esc(c.business)}</b><span class="s">${x.active.length} active file${x.active.length===1?'':'s'}</span></span>${ic('arrow')}</span>
   <span class="fcc-n"><span><em>${x.active.length}</em>Files</span><span><em>${x.uploads.length}</em>Uploads</span><span><em>${x.out.length}</em>Needs files</span></span><span class="chip ${att?'warn':'ok'}">${att?`${att} need${att===1?'s':''} attention`:'Up to date'}</span></button>`}).join('')}</div>`:'<div class="card"><div class="empty"><b>No clients match</b>Clear filters to see everyone.</div></div>'}

/* ── files ── */
function setSession(id,file){const o=session.get(id);if(o)URL.revokeObjectURL(o.url);session.set(id,{url:URL.createObjectURL(file),mime:file.type||''})}
const storageOn=()=>!!(window.VMSFiles&&VMSFiles.ready());
async function fileUrl(a){const s=session.get(a.id);if(s)return s.url;if(a.storagePath&&storageOn())return await VMSFiles.signedUrl(a.storagePath,900);return ''}
async function download(a){let u='';try{u=await fileUrl(a)}catch(e){return toast(e.message||'Could not download file','error')}if(!u)return toast('This file is not available yet','error');const l=document.createElement('a');l.href=u;l.download=a.fileName||'download';l.target='_blank';l.rel='noopener';document.body.appendChild(l);l.click();l.remove()}
async function preview(a,box){let u='';try{u=await fileUrl(a)}catch(e){return toast(e.message||'Could not open file','error')}if(!u)return toast('This file is not available yet','error');const m=(session.get(a.id)||{}).mime||a.mime;
  if(isImg(a.fileName,m))box.innerHTML=`<img src="${esc(u)}" alt="${esc(a.name)}">`;else if(isPdf(a.fileName,m))box.innerHTML=`<iframe src="${esc(u)}" title="${esc(a.name)}"></iframe>`;else return download(a);box.hidden=false}
const hist=h=>(h||[]).slice().reverse().map(x=>`<div class="it"><i></i><div><b>${esc(x.title)}</b><span>${esc(x.detail||'')}</span></div><time>${esc(new Date(x.at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</time></div>`).join('');

/* ── sheets ── */
function assetDetail(id){const a=assetFor(id);if(!a)return;const st=a.archived?'Archived':a.status,has=session.has(a.id)||(a.storagePath&&storageOn());
  sheet('File details',`<div class="det-h">${logo(a.client)}<div style="min-width:0"><h3>${esc(a.name)}</h3><span class="s">${esc(a.client)}${a.project?' · '+esc(a.project):''}</span></div></div><span class="chip ${tone(st)}">${esc(st)}</span>
   <div class="kv" style="margin-top:12px"><div class="r"><span>Category</span><b>${esc(a.category)}</b></div><div class="r"><span>Project</span><b>${esc(a.project||'No project')}</b></div><div class="r"><span>Source</span><b>${esc(a.source)}</b></div><div class="r"><span>Who can see it</span><b>${esc(a.visibility)}</b></div><div class="r"><span>Added</span><b>${esc(nice(a.addedDate))}</b></div><div class="r"><span>File</span><b>${esc([a.fileName,a.fileSize].filter(Boolean).join(' · ')||'No file attached')}</b></div></div>
   ${has?`<div class="row" style="margin-top:12px">${isImg(a.fileName,a.mime)||isPdf(a.fileName,a.mime)||(session.get(a.id)&&(isImg(a.fileName,session.get(a.id).mime)||isPdf(a.fileName,session.get(a.id).mime)))?`<button class="btn gh sm" type="button" data-x="view">${ic('eye')}View</button>`:''}<button class="btn gh sm" type="button" data-x="dl">${ic('download')}Download</button></div>`:a.fileName?'<div class="note" style="margin-top:12px">The file opens here once secure VMS Storage is connected.</div>':''}
   <div class="fprev" id="fPrev" hidden></div>${a.note?`<p class="fnote">${esc(a.note)}</p>`:''}${(a.history||[]).length?`<h4 class="fh4">History</h4><div class="tl">${hist(a.history)}</div>`:''}
   <div class="row" style="margin-top:16px;flex-wrap:wrap">${!a.archived&&a.status==='Needs Review'?`<button class="btn pri" type="button" data-x="review">${ic('check')}Mark reviewed</button>`:''}${a.archived?`<button class="btn pri" type="button" data-x="restore">Restore</button>`:`<button class="btn gh" type="button" data-x="edit">${ic('edit')}Edit</button><button class="btn gh" type="button" data-x="dup">Duplicate</button><button class="btn gh" type="button" data-x="archive">${ic('archive')}Archive</button>`}<button class="btn dg" type="button" data-x="del">${ic('trash')}Delete</button></div>`,
   b=>b.onclick=async e=>{const t=e.target.closest('[data-x]');if(!t)return;const x=t.dataset.x;
    if(x==='view')return preview(a,b.querySelector('#fPrev'));if(x==='dl')return download(a);if(x==='review'){review(a.id);return closeSheet()}if(x==='restore'){restore(a.id);return closeSheet()}
    if(x==='edit')return assetEditor(a.id);if(x==='dup'){dup(a.id);return closeSheet()}if(x==='archive'){archive(a.id);return closeSheet()}if(x==='del')return delAsset(a.id)})}
function reqDetail(id){const r=reqFor(id);if(!r)return;const got=assetFor(r.receivedAssetId);
  sheet('File request',`<div class="det-h">${logo(r.client)}<div style="min-width:0"><h3>${esc(r.name)}</h3><span class="s">${esc(r.client)}${r.project?' · '+esc(r.project):''}</span></div></div><span class="chip ${tone(r.status)}">${esc(r.status)}</span>
   <div class="kv" style="margin-top:12px"><div class="r"><span>Category</span><b>${esc(r.category)}</b></div><div class="r"><span>Project</span><b>${esc(r.project||'No project')}</b></div><div class="r"><span>Asked</span><b>${esc(nice(r.requestedDate))}</b></div><div class="r"><span>Due</span><b${overdue(r)?' style="color:var(--bad)"':''}>${esc(nice(r.dueDate))}${overdue(r)?' · Overdue':''}</b></div><div class="r"><span>How they send it</span><b>${esc(r.method)}</b></div><div class="r"><span>Received file</span><b>${got?`<a href="#" data-x="asset">${esc(got.name)}</a>`:'Not yet'}</b></div></div>
   <p class="fnote">${esc(r.note||'No instructions.')}</p>${(r.history||[]).length?`<h4 class="fh4">History</h4><div class="tl">${hist(r.history)}</div>`:''}
   <div class="row" style="margin-top:16px;flex-wrap:wrap">${outstanding(r)&&!r.receivedAssetId?`<button class="btn pri" type="button" data-x="recv">${ic('upload')}Record file received</button>`:''}<button class="btn gh" type="button" data-x="edit">${ic('edit')}Edit</button>${outstanding(r)?`<button class="btn gh" type="button" data-x="rem">${ic('bell')}Mark reminder sent</button>`:''}<button class="btn dg" type="button" data-x="del">${ic('trash')}Delete</button></div>`,
   b=>b.onclick=e=>{const t=e.target.closest('[data-x]');if(!t)return;e.preventDefault();const x=t.dataset.x;if(x==='asset')return assetDetail(got.id);if(x==='recv')return receive(r.id);if(x==='edit')return reqEditor(r.id);if(x==='rem'){reminder(r.id);return closeSheet()}if(x==='del')return delReq(r.id)})}
const projOpts=(client,cur)=>'<option value="">No project</option>'+projects().filter(p=>p.client===client).map(p=>`<option value="${esc(p.name)}" data-id="${esc(p.id||'')}"${p.name===cur?' selected':''}>${esc(p.name)}</option>`).join('');
const clientOpts=cur=>{const cs=clients();return cs.length?cs.map(c=>`<option${c.business===cur?' selected':''}>${esc(c.business)}</option>`).join(''):'<option value="">Add a client first</option>'};
const picker=(id,label,cur)=>`<div class="fld full"><label for="${id}">${label}</label><label class="fpick"><input type="file" id="${id}"><span class="btn gh sm">${ic('upload')}Choose file</span><span class="fpn" id="${id}N">${esc(cur||'No file chosen')}</span></label></div>`;
function assetEditor(id){const a=id?assetFor(id):null,cs=clients(),cl=a?a.client:(S.f.client||(cs[0]||{}).business||'');
  sheet(a?'Edit file':'Add file',`<form id="af" class="formsheet"><div class="fgrid"><div class="fld"><label for="aC">Client</label><select id="aC" class="sel" required>${clientOpts(cl)}</select></div><div class="fld"><label for="aP">Project</label><select id="aP" class="sel">${projOpts(cl,a&&a.project)}</select></div>
   ${picker('aF','File',a&&[a.fileName,a.fileSize].filter(Boolean).join(' · '))}
   <div class="fld full"><label for="aN">Name</label><input id="aN" class="inp" required placeholder="e.g. Primary logo, SVG" value="${esc(a?a.name:'')}"></div>
   <div class="fld"><label for="aK">Category</label><select id="aK" class="sel">${sel('',CATS,a?a.category:CATS[0])}</select></div><div class="fld"><label for="aS">Source</label><select id="aS" class="sel">${sel('',['VMS Upload','Client Upload','Email / Message','External Link'],a?a.source:'VMS Upload')}</select></div>
   <div class="fld"><label for="aV">Who can see it</label><select id="aV" class="sel">${sel('',[['Internal Only','Only VMS'],['Client Portal','Client sees it in their Portal']],a?a.visibility:'Internal Only')}</select></div><div class="fld"><label for="aT">Status</label><select id="aT" class="sel">${sel('',A_ST,a?a.status:'Ready')}</select></div>
   <div class="fld"><label for="aD">Added</label><input id="aD" class="inp" type="date" value="${esc(a?a.addedDate:todayISO())}"></div>
   <div class="fld full"><label for="aO">Notes</label><textarea id="aO" class="inp" rows="3" placeholder="What is this file for?">${esc(a&&a.note||'')}</textarea></div></div>
   <button class="btn pri" type="submit">${ic('check')}${a?'Save changes':'Add file'}</button></form>`,b=>{const fm=b.querySelector('#af');
   fm.aC.onchange=()=>{fm.aP.innerHTML=projOpts(fm.aC.value,'')};fm.aF.onchange=()=>{const f=fm.aF.files[0];b.querySelector('#aFN').textContent=f?`${f.name} · ${bytes(f.size)}`:'No file chosen';if(f&&!fm.aN.value.trim())fm.aN.value=f.name.replace(/\.[^.]+$/,'')};
   fm.onsubmit=async ev=>{ev.preventDefault();const btn=fm.querySelector('[type=submit]');const name=fm.aN.value.trim(),client=fm.aC.value;if(!client)return toast('Add a client first','error');
    const cr=clients().find(c=>c.business===client)||{},po=fm.aP.selectedOptions[0],file=fm.aF.files[0];let up=null;btn.disabled=true;
    if(file&&storageOn()){try{toast('Uploading…');up=await VMSFiles.upload(file,{ownerEmail:cr.email||'',folder:'admin-assets'})}catch(e){btn.disabled=false;return toast(e.message||'Secure upload failed','error')}}
    const old=a,rec={id:old?old.id:'asset-'+Date.now(),client,clientId:cr.id||(old&&old.clientId)||'',name,category:fm.aK.value,project:fm.aP.value,projectId:po&&po.dataset.id||'',source:fm.aS.value,visibility:fm.aV.value,status:fm.aT.value,addedDate:fm.aD.value,fileName:file?file.name:(old&&old.fileName)||'',fileSize:file?bytes(file.size):(old&&old.fileSize)||'',mime:file?file.type:(old&&old.mime)||'',storagePath:up&&up.path||(old&&old.storagePath)||'',note:fm.aO.value.trim(),archived:old?!!old.archived:false,createdAt:old&&old.createdAt||nowIso(),history:old&&Array.isArray(old.history)?old.history:[]};
    rec.history.push({at:nowIso(),title:old?'Asset updated':'Asset added',detail:`${rec.status} · ${rec.source}`});
    if(old)S.data.assets[S.data.assets.findIndex(x=>x.id===old.id)]=rec;else S.data.assets.unshift(rec);if(file)setSession(rec.id,file);
    if(up&&up.path&&old&&old.storagePath&&old.storagePath!==up.path)VMSFiles.remove(old.storagePath).catch(()=>{});
    save();closeSheet();render();toast(up&&up.path?'File uploaded securely':old?'File updated':'File added')}})}
function reqEditor(id){const r=id?reqFor(id):null,cs=clients(),cl=r?r.client:(S.f.client||(cs[0]||{}).business||'');
  sheet(r?'Edit file request':'Request a file',`<form id="rf" class="formsheet"><div class="fgrid"><div class="fld"><label for="rC">Client</label><select id="rC" class="sel" required>${clientOpts(cl)}</select></div><div class="fld"><label for="rP">Project</label><select id="rP" class="sel">${projOpts(cl,r&&r.project)}</select></div>
   <div class="fld full"><label for="rN">What do you need?</label><input id="rN" class="inp" required placeholder="e.g. High-resolution logo" value="${esc(r?r.name:'')}"></div>
   <div class="fld"><label for="rK">Category</label><select id="rK" class="sel">${sel('',CATS,r?r.category:CATS[0])}</select></div><div class="fld"><label for="rM">How they send it</label><select id="rM" class="sel">${sel('',['Client Portal','Email','Text / Message','Any Method'],r?r.method:'Client Portal')}</select></div>
   <div class="fld"><label for="rD">Asked on</label><input id="rD" class="inp" type="date" value="${esc(r?r.requestedDate:todayISO())}"></div><div class="fld"><label for="rU">Due</label><input id="rU" class="inp" type="date" value="${esc(r&&r.dueDate||'')}"></div>
   <div class="fld"><label for="rS">Status</label><select id="rS" class="sel">${sel('',R_ST,r?r.status:'Requested')}</select></div>
   <div class="fld full"><label for="rO">Instructions for the client</label><textarea id="rO" class="inp" rows="3" placeholder="Tell the client exactly what you need.">${esc(r&&r.note||'')}</textarea></div></div>
   <button class="btn pri" type="submit">${ic('check')}${r?'Save changes':'Save request'}</button></form>`,b=>{const fm=b.querySelector('#rf');fm.rC.onchange=()=>{fm.rP.innerHTML=projOpts(fm.rC.value,'')};
   fm.onsubmit=ev=>{ev.preventDefault();const client=fm.rC.value;if(!client)return toast('Add a client first','error');const cr=clients().find(c=>c.business===client)||{},po=fm.rP.selectedOptions[0],old=r;
    const rec={id:old?old.id:'freq-'+Date.now(),client,clientId:cr.id||(old&&old.clientId)||'',name:fm.rN.value.trim(),category:fm.rK.value,project:fm.rP.value,projectId:po&&po.dataset.id||'',requestedDate:fm.rD.value,dueDate:fm.rU.value,status:fm.rS.value,method:fm.rM.value,note:fm.rO.value.trim(),receivedAssetId:old&&old.receivedAssetId||'',createdAt:old&&old.createdAt||nowIso(),history:old&&Array.isArray(old.history)?old.history:[]};
    rec.history.push({at:nowIso(),title:old?'File request updated':'File requested',detail:`${rec.status} · ${rec.method}`});
    if(old)S.data.requests[S.data.requests.findIndex(x=>x.id===old.id)]=rec;else S.data.requests.unshift(rec);save();closeSheet();render();toast(old?'Request updated':'File requested')}})}
function receive(id){const r=reqFor(id);if(!r)return;
  sheet('Record file received',`<form id="vf" class="formsheet"><p class="muted" style="margin:0 0 12px">The file moves into Client uploads so you can review it.</p><div class="fgrid"><div class="fld full"><label for="vN">File name</label><input id="vN" class="inp" value="${esc(r.name)}"></div>${picker('vF','File','')}
   <div class="fld full"><label for="vO">Note</label><textarea id="vO" class="inp" rows="2" placeholder="Optional note about what they sent"></textarea></div></div><button class="btn pri" type="submit">${ic('check')}Record received file</button></form>`,b=>{const fm=b.querySelector('#vf');
   fm.vF.onchange=()=>{const f=fm.vF.files[0];b.querySelector('#vFN').textContent=f?`${f.name} · ${bytes(f.size)}`:'No file chosen'};
   fm.onsubmit=async ev=>{ev.preventDefault();const file=fm.vF.files[0],name=fm.vN.value.trim()||r.name,cr=clients().find(c=>c.business===r.client)||{};let up=null;
    if(file&&storageOn()){try{toast('Uploading…');up=await VMSFiles.upload(file,{ownerEmail:cr.email||'',folder:'client-uploads'})}catch(e){return toast(e.message||'Secure upload failed','error')}}
    const a={id:'asset-'+Date.now(),client:r.client,clientId:r.clientId||'',name,category:r.category,project:r.project,projectId:r.projectId||'',source:'Client Upload',visibility:'Client Portal',status:'Needs Review',addedDate:todayISO(),fileName:file?file.name:name,fileSize:file?bytes(file.size):'',mime:file?file.type:'',storagePath:up&&up.path||'',note:fm.vO.value.trim()||`Received for file request: ${r.name}`,archived:false,createdAt:nowIso(),history:[{at:nowIso(),title:'Client upload received',detail:`From file request: ${r.name}`}]};
    S.data.assets.unshift(a);if(file)setSession(a.id,file);r.status='Received';r.receivedAssetId=a.id;r.history=r.history||[];r.history.push({at:nowIso(),title:'File received',detail:a.fileName});save();closeSheet();S.view='uploads';render();toast(up&&up.path?'File stored securely':'Recorded as a client upload')}})}
function workspace(name){const x=summary(name),it=(k,y)=>`<button type="button" class="li" data-${k}="${esc(y.id)}"><span class="lic ${tone(k==='asset'&&y.archived?'Archived':y.status)}">${ic(k==='asset'?'file':'inbox')}</span><span style="min-width:0"><b>${esc(y.name)}</b><span class="s">${esc([y.category,y.project,k==='req'&&y.dueDate?'Due '+nice(y.dueDate):y.fileName].filter(Boolean).join(' · '))}</span></span><span class="chip ${tone(k==='asset'&&y.archived?'Archived':y.status)}">${esc(k==='asset'&&y.archived?'Archived':y.status)}</span></button>`;
  const sec=(t,rows,k,empty)=>`<h4 class="fh4">${t} <span class="muted">${rows.length}</span></h4><div class="list">${rows.length?rows.map(y=>it(k,y)).join(''):`<div class="empty" style="padding:12px">${empty}</div>`}</div>`;
  sheet(name,`<div class="det-h">${logo(name)}<div><h3>${esc(name)}</h3><span class="s">Everything VMS has or is waiting for from this client.</span></div></div>
   <div class="fcc-n" style="margin-bottom:6px"><span><em>${x.active.length}</em>Files</span><span><em>${x.uploads.length}</em>Uploads</span><span><em>${x.out.length}</em>Needs files</span><span><em>${x.arch.length}</em>Archived</span></div>
   ${sec('Active files',x.active,'asset','No active files.')}${sec('Waiting on the client',x.out,'req','Nothing outstanding.')}${sec('Archived',x.arch,'asset','Nothing archived.')}
   <div class="row" style="margin-top:16px;flex-wrap:wrap"><button class="btn pri" type="button" data-x="add">${ic('plus')}Add file</button><button class="btn gh" type="button" data-x="ask">Request file</button><button class="btn ghost" type="button" data-x="show">Show in All assets</button></div>`,
   b=>b.onclick=e=>{const t=e.target.closest('[data-asset],[data-req],[data-x]');if(!t)return;if(t.dataset.asset)return assetDetail(t.dataset.asset);if(t.dataset.req)return reqDetail(t.dataset.req);
    const x=t.dataset.x;if(x==='show'){S.view='assets';S.f={client:name,cat:'',project:'',status:''};S.showF=true;closeSheet();return render()}const keep=S.f.client;S.f.client=name;x==='add'?assetEditor():reqEditor();S.f.client=keep})}

/* ── actions ── */
const log=(o,title,detail)=>{o.history=o.history||[];o.history.push({at:nowIso(),title,detail})};
function review(id){const a=assetFor(id);if(!a)return;a.status='Ready';log(a,'Asset reviewed','Marked Ready by VMS');save();render();toast('Marked reviewed')}
function archive(id){const a=assetFor(id);if(!a)return;a.archived=true;log(a,'Asset archived','Moved out of active files');save();render();toast('File archived')}
function restore(id){const a=assetFor(id);if(!a)return;a.archived=false;log(a,'Asset restored','Returned to active files');save();render();toast('File restored')}
function dup(id){const a=JSON.parse(JSON.stringify(assetFor(id)));a.id='asset-'+Date.now();a.name+=' Copy';a.status='Draft';a.addedDate=todayISO();a.createdAt=nowIso();a.history=[{at:nowIso(),title:'Asset record duplicated',detail:'From '+id}];S.data.assets.unshift(a);save();render();toast('Record duplicated')}
function reminder(id){const r=reqFor(id);if(!r)return;r.status='Reminder Sent';log(r,'Reminder sent','Marked by VMS Admin');save();render();toast('Reminder recorded')}
async function delAsset(id){const a=assetFor(id);if(!a)return;if(!await confirmSheet('Delete this file?',`“${esc(a.name)}” is removed for good${a.storagePath?', including the stored file':''}.`,'Delete',true))return;
  if(a.storagePath&&storageOn()){try{await VMSFiles.remove(a.storagePath)}catch(e){console.warn(e)}}const s=session.get(a.id);if(s){URL.revokeObjectURL(s.url);session.delete(a.id)}
  S.data.assets=S.data.assets.filter(x=>x.id!==a.id);S.data.requests.forEach(r=>{if(r.receivedAssetId===a.id)r.receivedAssetId=''});save();render();toast('File deleted')}
async function delReq(id){const r=reqFor(id);if(!r)return;if(!await confirmSheet('Delete this request?',`“${esc(r.name)}” is removed for good.`,'Delete',true))return;S.data.requests=S.data.requests.filter(x=>x.id!==r.id);save();render();toast('Request deleted')}

root.addEventListener('click',e=>{const t=e.target.closest('button,[data-asset],[data-req]');if(!t||!root.contains(t))return;const d=t.dataset;
  if(d.view){S.view=d.view;S.f.status='';return render()}if('filt' in d){S.showF=!S.showF;return render()}if('clear' in d){S.f={client:'',cat:'',project:'',status:''};S.q='';return render()}
  if(d.review){e.stopPropagation();return review(d.review)}if(d.restore){e.stopPropagation();return restore(d.restore)}if(d.receive){e.stopPropagation();return receive(d.receive)}
  if('newreq' in d)return reqEditor();if(d.client)return workspace(d.client);if(d.asset)return assetDetail(d.asset);if(d.req)return reqDetail(d.req)});
root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.frow')){e.preventDefault();e.target.click()}});
root.addEventListener('input',e=>{if(e.target.id==='fq'){S.q=e.target.value;const p=e.target.selectionStart;render();const n=root.querySelector('#fq');n.focus();n.setSelectionRange(p,p)}});
root.addEventListener('change',e=>{const id=e.target.id,v=e.target.value;if(id==='fc'){S.f.client=v;S.f.project=''}else if(id==='fk')S.f.cat=v;else if(id==='fp')S.f.project=v;else if(id==='fs')S.f.status=v;else return;render()});
actions(`<button class="btn gh sm" type="button" data-fx="req">${ic('inbox')}<span class="lbl">Request file</span></button><button class="btn pri sm" type="button" data-fx="add">${ic('plus')}<span class="lbl">Add file</span></button>`);
document.addEventListener('click',e=>{const b=e.target.closest('[data-fx]');if(!b)return;b.dataset.fx==='add'?assetEditor():reqEditor()});
addEventListener('storage',e=>{if(e.key===KEY){loadData();render()}});
loadData();render();
V.ready().then(async()=>{const st=V.state();try{const sb=await VMSAuth.client();const r=await sb.from('clients').select('id,business_name,owner_email,status').neq('status','archived').order('business_name');S.cloudClients=r.data||[]}catch{S.cloudClients=[]}
  render();try{const d=await api('/api/schedule');S.jobs=d.jobs||[]}catch{S.jobs=[]}const r=await st;if(r&&r.changed)loadData();render()});
})();
