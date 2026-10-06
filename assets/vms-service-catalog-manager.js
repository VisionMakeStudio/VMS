/* Vision Make Studio — live Service Catalog manager (Admin v2).
   Supabase public.service_catalog is the source of truth: VMSCatalog.load() reads it and VMSCatalog.save() writes it,
   so published prices and details reach VisionMakeStudio.com and the Client Portal without another deploy. */
(()=>{
'use strict';
if(window.__VMS_LIVE_CATALOG_MANAGER__)return;window.__VMS_LIVE_CATALOG_MANAGER__=true;
const V=window.VMSv2,root=document.getElementById('pgRoot');if(!V||!root)return;
const {ic,esc,toast,sheet,closeSheet,num,kpi,actions,confirmSheet,sel}=V;
const S={list:[],ready:false,sync:['Connecting to the live catalog…','loading'],q:'',status:'all',channel:'all',sales:'all'};
const clone=v=>JSON.parse(JSON.stringify(v));
const slug=n=>`${String(n||'service').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,54)||'service'}-${Date.now().toString(36)}`;
const lines=v=>String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const archived=s=>!!(s&&(s.archived||s.metadata&&s.metadata.archived));
const pub=(s,ch)=>!archived(s)&&s.status==='Published'&&!!s[ch]&&s.kind!=='internal';
const price=s=>window.VMSCatalog&&VMSCatalog.priceLabel?VMSCatalog.priceLabel(s):'Request pricing';
const KIND={service:'Service',subscription:'Subscription',addon:'Add-on',package:'Package',bundle:'Bundle',internal:'Internal'};
const stTone=s=>s==='Published'?'ok':s==='Draft'?'warn':'';
const active=()=>S.list.filter(s=>!archived(s));
const ord=(a,b)=>(Number(a.displayOrder)||999)-(Number(b.displayOrder)||999)||String(a.name).localeCompare(String(b.name));
const setSync=(m,st)=>{S.sync=[m,st];const el=document.getElementById('catSync');if(el){el.dataset.state=st;el.querySelector('b').textContent=m}};
const connected=()=>setSync(`Live catalog connected · ${active().length} services`,'ok');
function filtered(){const q=S.q.trim().toLowerCase();return active().filter(s=>{const ch=S.channel==='all'||(S.channel==='website'&&s.websiteVisible)||(S.channel==='portal'&&s.portalVisible)||(S.channel==='both'&&s.websiteVisible&&s.portalVisible);
  return (!q||`${s.name} ${s.category} ${s.description} ${s.kind}`.toLowerCase().includes(q))&&(S.status==='all'||s.status===S.status)&&ch&&(S.sales==='all'||s.salesMode===S.sales)}).sort(ord)}
const badge=s=>{const t=String(s.icon||'VMS').toUpperCase();return `<span class="sicon${t.length>=5?' sm':''}" title="${esc(t)}">${esc(t)}</span>`};
function render(){if(!S.ready){root.innerHTML='<div class="kpis kpis5">'+'<div class="skel" style="height:96px"></div>'.repeat(5)+'</div><div class="skel" style="height:420px;margin-top:14px"></div>';return}
  const a=active(),rows=filtered();
  root.innerHTML=`<div class="livebar" id="catSync" data-state="${S.sync[1]}"><i></i><b>${esc(S.sync[0])}</b><span class="muted">Saved changes go live on VisionMakeStudio.com and the Client Portal right away.</span></div>
  <div class="kpis kpis5">${kpi('Services',num(a.length),'','in the catalog')}${kpi('Published',num(a.filter(s=>s.status==='Published').length),'','ready to sell')}${kpi('On website',num(a.filter(s=>pub(s,'websiteVisible')).length),'','public Services')}${kpi('In Portal',num(a.filter(s=>pub(s,'portalVisible')).length),'','Add more services')}${kpi('Recurring',num(a.filter(s=>['Recurring','Setup + Recurring'].includes(s.pricingModel)).length),'','subscriptions')}</div>
  <div class="toolbar" style="margin-top:16px"><label class="search">${ic('search')}<input class="inp" id="cq" type="search" placeholder="Search services or categories" value="${esc(S.q)}"></label>
   <select class="sel" id="cs" aria-label="Status">${sel('',[['all','All statuses'],'Published','Draft','Hidden'],S.status)}</select><select class="sel" id="cc" aria-label="Where it shows">${sel('',[['all','Everywhere'],['website','Website'],['portal','Client Portal'],['both','Website + Portal']],S.channel)}</select><select class="sel" id="cm" aria-label="Sales mode">${sel('',[['all','All sales modes'],'Request First','Buy Now','Internal'],S.sales)}</select></div>
  <section class="card"><div class="list">${rows.length?rows.map(s=>`<div class="li srow" data-id="${esc(s.id)}" role="button" tabindex="0">${badge(s)}<span style="min-width:0"><b>${esc(s.name)}${s.featured?` <span class="chip warn" style="vertical-align:2px">Featured</span>`:''}</b><span class="s">${esc(s.category||'Uncategorized')} · ${esc(KIND[s.kind]||'Service')} · ${esc(s.salesMode||'Request First')}</span>${s.description?`<span class="s aclip">${esc(s.description)}</span>`:''}
    <span class="schips"><span class="chip ${stTone(s.status)}">${esc(s.status)}</span>${s.websiteVisible?'<span class="chip info">Website</span>':''}${s.portalVisible?'<span class="chip info">Portal</span>':''}${!s.websiteVisible&&!s.portalVisible?'<span class="chip">Internal only</span>':''}${s.promoEligible?'<span class="chip">Promo codes</span>':''}<span class="chip">#${Number(s.displayOrder)||'–'}</span></span></span>
    <span class="end"><b class="sprice">${esc(price(s))}</b><span class="row" style="gap:6px"><button class="btn gh sm" type="button" data-pub="${esc(s.id)}">${s.status==='Published'?'Hide':'Publish'}</button><button class="ib" type="button" data-prev="${esc(s.id)}" aria-label="Preview ${esc(s.name)}">${ic('eye')}</button></span></span></div>`).join(''):'<div class="empty"><b>No services found</b>Try another filter or add a service.</div>'}</div></section>`}

/* ── editor ── */
const TOG=[['wv','websiteVisible','Show on VMS website','In the public Services area when published.',true],['pv','portalVisible','Show in Client Portal','Under Add More Services for existing clients.',true],['pe','promoEligible','Allow promo codes','Eligible for VMS promotions at checkout.',true],['sa','startingAt','Show price as “From”','For starting prices when scope can vary.',false],['ft','featured','Featured service','Shown ahead of standard services.',false]];
function editor(id){const s=id?S.list.find(x=>x.id===id):null;
  sheet(s?'Edit service':'Add service',`<form id="sf" class="formsheet"><div class="fgrid">
   <div class="fld full"><label for="sN">Service name</label><input id="sN" class="inp" required placeholder="e.g. Website Revamp" value="${esc(s?s.name:'')}"></div>
   <div class="fld"><label for="sC">Category</label><input id="sC" class="inp" placeholder="e.g. Websites" value="${esc(s&&s.category||'')}"></div><div class="fld"><label for="sK">Offer type</label><select id="sK" class="sel">${sel('',Object.entries(KIND),s?s.kind:'service')}</select></div>
   <div class="fld"><label for="sI">Short label</label><input id="sI" class="inp" maxlength="6" placeholder="WEB" value="${esc(s&&s.icon||'')}"></div><div class="fld"><label for="sS">Status</label><select id="sS" class="sel">${sel('',['Draft','Published','Hidden'],s?s.status:'Draft')}</select></div>
   <div class="fld full"><label for="sD">Public description</label><textarea id="sD" class="inp" rows="3" placeholder="What the client gets and why it helps their business.">${esc(s&&s.description||'')}</textarea></div>
   <div class="fld full"><label for="sF">Highlights <span class="muted">· one per line</span></label><textarea id="sF" class="inp" rows="3" placeholder="Responsive website build&#10;Contact / lead pathway&#10;Launch support">${esc((s&&s.features||[]).join('\n'))}</textarea></div>
   <div class="fld full"><label for="sU">Package includes <span class="muted">· optional, one per line</span></label><textarea id="sU" class="inp" rows="2" placeholder="For packages or bundles that include other VMS offers.">${esc((s&&s.included||[]).join('\n'))}</textarea></div>
   <div class="fld"><label for="sP">Pricing</label><select id="sP" class="sel">${sel('',[['Quote Only','Custom quote'],'One-Time','Recurring','Setup + Recurring','Free'],s?s.pricingModel:'Quote Only')}</select></div><div class="fld"><label for="sM">Sales mode</label><select id="sM" class="sel">${sel('',['Request First','Buy Now','Internal'],s?s.salesMode:'Request First')}</select></div>
   <div class="fld" data-p="one"><label for="sO">One-time / setup price</label><input id="sO" class="inp" inputmode="decimal" placeholder="0.00" value="${esc(s&&s.oneTimePrice!=null?s.oneTimePrice:'')}"></div><div class="fld" data-p="rec"><label for="sR">Recurring price</label><input id="sR" class="inp" inputmode="decimal" placeholder="0.00" value="${esc(s&&s.recurringPrice!=null?s.recurringPrice:'')}"></div>
   <div class="fld" data-p="rec"><label for="sB">Billing</label><select id="sB" class="sel">${sel('',['Monthly','Annual'],s?s.cadence:'Monthly')}</select></div><div class="fld"><label for="sO2">Display order</label><input id="sO2" class="inp" type="number" min="1" step="1" value="${esc(s?s.displayOrder||1:Math.max(1,active().length+1))}"></div></div>
   <div class="pprev"><div><span>Website price</span><b id="pvP"></b></div><div><span>Client button</span><b id="pvA"></b></div><div><span>Status</span><b id="pvS"></b></div></div>
   <div class="list tgl">${TOG.map(t=>`<label class="li"><span><b>${t[2]}</b><span class="s">${t[3]}</span></span><span></span><input type="checkbox" class="sw" id="${t[0]}"${(s?s[t[1]]:t[4])?' checked':''}></label>`).join('')}</div>
   <div class="note" style="margin-top:12px">Published + Website controls VisionMakeStudio.com. Published + Portal controls the Client Portal. Existing client agreements keep their agreed price.</div>
   <div class="row" style="margin-top:14px;flex-wrap:wrap"><button class="btn pri" type="submit" id="sSave">${ic('check')}Save service</button>${s?`<button class="btn gh" type="button" data-x="prev">${ic('eye')}Preview</button><button class="btn gh" type="button" data-x="dup">Duplicate</button>${s.kind!=='internal'?`<button class="btn dg" type="button" data-x="arch">${ic('archive')}Archive</button>`:''}`:''}</div></form>`,
   b=>{const f=b.querySelector('#sf'),data=()=>({name:f.sN.value.trim(),category:f.sC.value.trim(),kind:f.sK.value,icon:f.sI.value.trim(),status:f.sS.value,description:f.sD.value.trim(),features:lines(f.sF.value),included:lines(f.sU.value),pricingModel:f.sP.value,salesMode:f.sM.value,
     oneTimePrice:f.sO.value.trim()===''?null:Number(f.sO.value),recurringPrice:f.sR.value.trim()===''?null:Number(f.sR.value),cadence:f.sB.value,displayOrder:Number(f.sO2.value)||1,websiteVisible:f.wv.checked,portalVisible:f.pv.checked,promoEligible:f.pe.checked,startingAt:f.sa.checked,featured:f.ft.checked});
    const upd=()=>{const d=data(),pm=d.pricingModel;b.querySelector('#pvP').textContent=price({...d,metadata:{}});b.querySelector('#pvA').textContent=d.salesMode==='Buy Now'?'Buy now':d.salesMode==='Internal'?'Internal':'Request service';b.querySelector('#pvS').textContent=d.status;
     b.querySelectorAll('[data-p="one"]').forEach(x=>x.hidden=!['One-Time','Setup + Recurring'].includes(pm));b.querySelectorAll('[data-p="rec"]').forEach(x=>x.hidden=!['Recurring','Setup + Recurring'].includes(pm))};
    f.addEventListener('input',upd);f.addEventListener('change',upd);upd();
    b.onclick=async e=>{const t=e.target.closest('[data-x]');if(!t)return;const x=t.dataset.x;if(x==='prev')return preview(s.id);if(x==='dup'){closeSheet();return dup(s.id)}if(x==='arch')return archive(s.id)};
    f.onsubmit=async e=>{e.preventDefault();if(!S.ready)return toast('The live catalog is still loading','error');const d=data();
     const issue=!d.name?'Enter a service name':d.salesMode==='Buy Now'&&d.pricingModel==='Quote Only'?'Buy Now needs a fixed price':d.pricingModel==='One-Time'&&d.oneTimePrice===null?'Enter the one-time price':['Recurring','Setup + Recurring'].includes(d.pricingModel)&&d.recurringPrice===null?'Enter the recurring price':'';
     if(issue){toast(issue,'error');return}const btn=f.querySelector('#sSave');btn.disabled=true;setSync('Saving to the live catalog…','saving');
     try{const item={...(s?clone(s):{}),...d,id:s?s.id:slug(d.name),metadata:{...(s&&s.metadata||{}),archived:false}};const saved=await VMSCatalog.save(item);put(saved);closeSheet();render();connected();toast(saved.status==='Published'?'Saved · live on your website and Portal':'Saved')}
     catch(err){console.error('VMS catalog save failed',err);setSync('Could not save to the live catalog','error');toast(err&&err.message||'Could not save service','error')}finally{btn.disabled=false}}})}
function put(saved){const i=S.list.findIndex(x=>x.id===saved.id);if(i>=0)S.list[i]=saved;else S.list.push(saved)}
async function archive(id){const s=S.list.find(x=>x.id===id);if(!s||s.kind==='internal')return;if(!await confirmSheet('Archive this service?',`“${esc(s.name)}” is hidden from the website and Client Portal, but kept in the catalog history.`,'Archive',true))return;
  setSync('Archiving service…','saving');try{put(await VMSCatalog.save({...s,status:'Hidden',websiteVisible:false,portalVisible:false,metadata:{...(s.metadata||{}),archived:true}}));render();connected();toast('Service archived')}catch(err){setSync('Could not archive service','error');toast(err&&err.message||'Archive failed','error')}}
async function dup(id){const s=S.list.find(x=>x.id===id);if(!s)return;setSync('Creating a copy…','saving');
  try{put(await VMSCatalog.save({...clone(s),id:slug(s.name),name:`${s.name} Copy`,status:'Draft',featured:false,displayOrder:Math.max(...S.list.map(x=>Number(x.displayOrder)||0),0)+1,metadata:{...(s.metadata||{}),archived:false}}));render();connected();toast('Duplicated as a draft')}catch(err){setSync('Could not duplicate service','error');toast(err&&err.message||'Duplicate failed','error')}}
async function togglePub(id,btn){const s=S.list.find(x=>x.id===id);if(!s)return;btn&&(btn.disabled=true);setSync('Updating publish status…','saving');
  try{const saved=await VMSCatalog.save({...s,status:s.status==='Published'?'Hidden':'Published',metadata:{...(s.metadata||{}),archived:false}});put(saved);render();connected();toast(saved.status==='Published'?'Published live':'Hidden from the public catalog')}catch(err){setSync('Could not update publish status','error');toast(err&&err.message||'Update failed','error');btn&&(btn.disabled=false)}}
function pcard(s){return `<div class="pcard">${badge(s)}<h4>${esc(s.name)}</h4>${s.description?`<p>${esc(s.description)}</p>`:''}<div class="pp">${esc(price(s))}</div>${(s.features||[]).slice(0,4).map(x=>`<small>${ic('check')}${esc(x)}</small>`).join('')}<span class="btn ${s.salesMode==='Buy Now'?'acc':'gh'} sm">${s.salesMode==='Buy Now'?'Buy now':'Request service'}</span></div>`}
function preview(focus){const only=s=>!focus||s.id===focus,web=S.list.filter(s=>pub(s,'websiteVisible')&&only(s)).sort(ord),por=S.list.filter(s=>pub(s,'portalVisible')&&only(s)).sort(ord),one=focus&&S.list.find(x=>x.id===focus);
  sheet(one?'Preview · '+one.name:'Published catalog',`${one&&!pub(one,'websiteVisible')&&!pub(one,'portalVisible')?'<div class="note warn" style="margin-bottom:12px">This service is not published anywhere yet, so clients cannot see it.</div>':''}
   <div class="pgrid"><div><h4 class="fh4" style="margin-top:0">VisionMakeStudio.com · Services</h4>${web.length?web.map(pcard).join(''):'<div class="empty">Nothing published to the website.</div>'}</div>
   <div><h4 class="fh4" style="margin-top:0">Client Portal · Add more services</h4>${por.length?por.map(pcard).join(''):'<div class="empty">Nothing published to the Portal.</div>'}</div></div>
   <div class="note" style="margin-top:12px">This preview uses the same live records your website loads, so a saved change needs no new deploy.</div>`)}

root.addEventListener('click',e=>{const t=e.target.closest('button,[data-id]');if(!t||!root.contains(t))return;const d=t.dataset;
  if(d.pub){e.stopPropagation();return togglePub(d.pub,t)}if(d.prev){e.stopPropagation();return preview(d.prev)}if(d.id)return editor(d.id)});
root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.srow')){e.preventDefault();e.target.click()}});
root.addEventListener('input',e=>{if(e.target.id==='cq'){S.q=e.target.value;const p=e.target.selectionStart;render();const n=root.querySelector('#cq');n.focus();n.setSelectionRange(p,p)}});
root.addEventListener('change',e=>{const m={cs:'status',cc:'channel',cm:'sales'}[e.target.id];if(m){S[m]=e.target.value;render()}});
actions(`<button class="btn gh sm" type="button" data-cx="prev">${ic('eye')}<span class="lbl">Preview</span></button><button class="btn pri sm" type="button" data-cx="add">${ic('plus')}<span class="lbl">Add service</span></button>`);
document.addEventListener('click',e=>{const b=e.target.closest('[data-cx]');if(!b)return;if(!S.ready)return toast('The live catalog is still loading','error');b.dataset.cx==='add'?editor(null):preview(null)});
render();
/* The shared auth guard owns Admin verification (no second requireSession, so no login flash). */
V.ready().then(async()=>{if(!window.VMSCatalog){S.ready=true;setSync('The catalog runtime did not load','error');render();return toast('VMS catalog runtime is unavailable','error')}
  try{S.list=await VMSCatalog.load();S.ready=true;const live=VMSCatalog.configReady()&&location.protocol!=='file:';live?connected():setSync(`Offline copy · ${active().length} services (not connected to Supabase)`,'loading');render()}
  catch(err){console.error('Catalog load failed',err);S.ready=true;setSync('Could not load the live catalog','error');render();toast(err&&err.message||'Could not load catalog','error')}});
})();
