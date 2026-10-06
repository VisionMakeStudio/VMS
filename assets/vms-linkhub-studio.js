/* VMS LinkHub Studio (v2) — edits and publishes each client's public LinkHub.
   Source of truth: Supabase linkhub_pages (draft_data / published_data, one row per client).
   Publishing copies the draft to published_data; /link/<slug> (netlify/functions/linkhub.mts) serves it.
   Plans come from client_services: LinkHub Core/Pro unlock publishing, Wi-Fi and Menu are paid add-ons. */
(()=>{
'use strict';
const V=window.VMSv2,root=document.getElementById('lhRoot');
if(!V||!root)return;
const {ic,esc,toast,sheet,closeSheet}=V;
const $=(s,r=root)=>r.querySelector(s),$$=(s,r=root)=>[...r.querySelectorAll(s)];
const ACTIVE_S=new Set(['active','published','enabled']),ACTIVE_B=new Set(['active','paid','trialing','gifted','comped']);
const THEMES=[['cream','Cream','#F6F3EC',{bg:'#F6F3EC',text:'#0B2233',button:'#003049',buttonText:'#FDF0D5'}],['navy','Navy','#003049',{bg:'#003049',text:'#FDF0D5',button:'#FDF0D5',buttonText:'#003049'}],['red','Red','#2A0A0D',{bg:'#2A0A0D',text:'#FDF0D5',button:'#C1121F',buttonText:'#FFFFFF'}],['sky','Sky','#E3EFF6',{bg:'#E3EFF6',text:'#0B2233',button:'#2F6F96',buttonText:'#FFFFFF'}],
  ['midnight','Midnight','linear-gradient(145deg,#08283D,#176B87)',{bg:'#08283D',text:'#FFFFFF',button:'#FFFFFF',buttonText:'#08283D',gradient:{a:'#08283D',b:'#176B87',dir:'145deg'}}],['sunrise','Sunrise','linear-gradient(145deg,#8D3446,#EB5E28)',{bg:'#8D3446',text:'#FFFFFF',button:'#FFFFFF',buttonText:'#8D3446',gradient:{a:'#8D3446',b:'#EB5E28',dir:'145deg'}}],
  ['aqua','Aqua','linear-gradient(145deg,#003049,#48B9C7)',{bg:'#003049',text:'#FFFFFF',button:'#FDF0D5',buttonText:'#003049',gradient:{a:'#003049',b:'#48B9C7',dir:'145deg'}}],['violet','Violet','linear-gradient(145deg,#2D1F5E,#7A5FFF)',{bg:'#2D1F5E',text:'#FFFFFF',button:'#FFFFFF',buttonText:'#2D1F5E',gradient:{a:'#2D1F5E',b:'#7A5FFF',dir:'145deg'}}]];
const SOCIAL=[['Instagram','ig','https://instagram.com/'],['Facebook','fb','https://facebook.com/'],['TikTok','tt','https://tiktok.com/@'],['YouTube','yt','https://youtube.com/@'],['X','xx','https://x.com/'],['LinkedIn','li','https://linkedin.com/company/'],['WhatsApp','wa','']];
const ADDS=[['Order online','https://'],['Book now','https://'],['Leave us a review','https://g.page/r/'],['Menu','https://'],['Instagram','social'],['Call us','phone']];
/* Client Portal mode: the same studio, locked to the signed-in client's own page and plan. */
const PORTAL=document.documentElement.dataset.vmsShell==='portal-v2';
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const S={sb:null,clients:[],pages:[],events:[],svc:{},cid:'',h:null,base:'',row:null,screen:'main',loading:true,error:'',busy:false};

const uid=p=>(p||'id')+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const slugify=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48);
const ini=n=>String(n||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'VM';
const httpOk=u=>{u=String(u||'').trim();if(!u)return false;try{const x=new URL(/^https?:\/\//i.test(u)?u:'https://'+u);return /^https?:$/.test(x.protocol)&&x.hostname.includes('.')}catch{return false}};
const pubUrl=slug=>location.origin+'/link/'+slug;
const client=()=>S.clients.find(c=>c.id===S.cid)||null;
const pageOf=id=>S.pages.find(p=>p.client_id===id)||null;
const clone=o=>JSON.parse(JSON.stringify(o));

/* ---------- canonical data (same shape the public /link renderer reads) ---------- */
function normalize(d,c){d=d&&typeof d==='object'?clone(d):{};const st=d.style||{};
  const wifi=Object.assign({enabled:false,ssid:'',security:'WPA2',password:'',revealOnTap:true},d.wifi||{});
  const rest=Object.assign({enabled:false,name:c?c.business_name:'',cuisine:'',description:'',showPrices:true,sections:[]},d.restaurant||{});rest.sections=(Array.isArray(rest.sections)?rest.sections:[]).map(s=>Object.assign({id:uid('sec'),name:'',visible:true},s,{items:(Array.isArray(s.items)?s.items:[]).map(it=>Object.assign({id:uid('item'),name:'',description:'',price:'',visible:true},it))}));
  const visit=Object.assign({enabled:false,name:c?c.business_name:'',category:'',bio:'',address:'',mapsUrl:'',hours:[]},d.visit||{});
  if(!Array.isArray(visit.hours)||visit.hours.length!==7)visit.hours=DAYS.map(day=>{const old=Array.isArray(visit.hours)?visit.hours.find(x=>x&&x.day===day):null;return Object.assign({day,open:'09:00',close:'17:00',closed:day==='Sunday'},old||{})});
  return Object.assign(d,{businessName:d.businessName||(c?c.business_name:''),title:d.title||'',bio:d.bio||'',phone:d.phone||(c&&c.phone)||'',email:d.email||(c&&c.owner_email)||'',website:d.website||'',address:d.address||'',mapUrl:d.mapUrl||'',photoData:d.photoData||'',
    slug:d.slug||'',theme:d.theme||(st.bg||(st.gradient&&st.gradient.a)?'custom':'cream'),style:Object.assign({},THEMES[0][3],st,{btn:st.btn||'round'}),links:(Array.isArray(d.links)?d.links:[]).map(l=>Object.assign({id:uid('link'),label:'',url:'',visible:true,type:'Custom'},l)),
    socials:(Array.isArray(d.socials)?d.socials:[]).map(x=>Object.assign({id:uid('social'),platform:'Instagram',url:'',label:'',visible:true},x)),wifi,restaurant:rest,visit,permissions:d.permissions||{},manualDisabled:!!d.manualDisabled})}
const snap=h=>JSON.stringify(h);
const dirty=()=>S.h&&snap(S.h)!==S.base;
function outData(){const h=clone(S.h);h.slug=S.h.slug;h.status=S.row&&S.row.status==='published'?'Active':'Draft';h.updatedAt=new Date().toISOString();
  h.socials.forEach(x=>{if(!x.label)x.label=x.platform});return h}

/* ---------- plan / entitlements ---------- */
function ent(id){const rows=(S.svc[id]||[]).filter(r=>ACTIVE_S.has(String(r.service_status||'').toLowerCase())&&ACTIVE_B.has(String(r.billing_status||'').toLowerCase()));const k=new Set(rows.map(r=>String(r.service_key||r.catalog_service_id||'').toLowerCase()));
  const pro=k.has('linkhub-pro'),core=k.has('linkhub-core');return {base:pro||core,plan:pro?'Pro':core?'Core':'',wifi:k.has('linkhub-wifi'),menu:k.has('linkhub-menu')}}
function strength(h){const t=[[!!h.businessName.trim(),15],[h.bio.trim().length>=20,10],[!!(h.phone||httpOk(h.mapUrl)),10],[h.links.filter(l=>l.visible!==false&&l.label&&httpOk(l.url)).length>=3,20],[h.links.some(l=>/review/i.test(l.label)),10],[h.socials.some(s=>s.url),10],[!!h.photoData,10],[h.visit.enabled||h.restaurant.enabled||h.wifi.enabled,15]];return t.reduce((a,x)=>a+(x[0]?x[1]:0),0)}
function stats(id){const ev=S.events.filter(e=>e.client_id===id);const v=ev.filter(e=>e.event_type==='linkhub_view').length,c=ev.filter(e=>e.event_type==='linkhub_click').length;
  const top={};ev.filter(e=>e.event_type==='linkhub_click').forEach(e=>{const l=(e.metadata&&e.metadata.label)||'Link';top[l]=(top[l]||0)+1});return {views:v,taps:c,rate:v?Math.round(c/v*100):0,top:Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,4)}}

/* ---------- data ---------- */
async function sb(){if(S.sb)return S.sb;S.sb=window.VMSAuth&&await VMSAuth.client();if(!S.sb)throw new Error('Supabase is not configured on this page.');return S.sb}
async function load(){S.loading=true;render();try{const s=await sb();
  const [c,p,e]=await Promise.all([s.from('clients').select('id,business_name,owner_email,phone,status').order('business_name'),s.from('linkhub_pages').select('*'),s.from('activity_events').select('client_id,event_type,created_at,metadata').in('event_type',['linkhub_view','linkhub_click']).order('created_at',{ascending:false}).limit(5000)]);
  if(c.error)throw c.error;if(p.error)throw p.error;S.clients=(c.data||[]).filter(x=>String(x.status||'').toLowerCase()!=='archived');S.pages=(p.data||[]).filter(x=>!PORTAL||S.clients.some(c=>c.id===x.client_id));S.events=e.data||[];S.error='';
  let want=new URLSearchParams(location.search).get('client')||S.cid;if(!S.clients.find(x=>x.id===want))want=(S.pages[0]&&S.pages[0].client_id)||(S.clients[0]&&S.clients[0].id)||'';await pick(want,true)}
  catch(err){S.error=err.message||'Could not load LinkHubs.'}S.loading=false;render()}
async function pick(id,quiet){S.cid=id;S.screen='main';S.row=pageOf(id);const c=client();
  S.h=S.row?normalize(S.row.draft_data&&Object.keys(S.row.draft_data).length?S.row.draft_data:S.row.published_data,c):null;if(S.h&&!S.h.slug)S.h.slug=S.row.slug;S.base=S.h?snap(S.h):'';
  if(id&&!S.svc[id]){try{const s=await sb();const r=await s.from('client_services').select('service_key,catalog_service_id,service_status,billing_status').eq('client_id',id);S.svc[id]=r.data||[]}catch{S.svc[id]=[]}}
  if(!quiet)render()}
function guard(next){if(!dirty())return next();sheet('Save your changes?','<p class="muted" style="margin-bottom:14px">This LinkHub has edits that are not saved yet.</p><div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-g="save">'+ic('check')+'Save draft</button><button class="btn gh" type="button" data-g="drop">Discard changes</button></div>',
  b=>b.onclick=async ev=>{const t=ev.target.closest('[data-g]');if(!t)return;closeSheet();if(t.dataset.g==='save'){if(await save(false))next()}else{S.base=S.h?snap(S.h):'';next()}},{size:'sm'})}
async function slugFree(slug){const s=await sb();const r=await s.from('linkhub_pages').select('client_id').eq('slug',slug).limit(1);return !(r.data||[]).some(x=>x.client_id!==S.cid)}
async function save(publish){const h=S.h,c=client();if(!h||!c||S.busy)return false;
  h.slug=slugify(h.slug||h.businessName||c.business_name);if(!h.slug){toast('Add a page address first.','error');return false}
  if(publish&&!h.businessName.trim()){toast('Add a business name before publishing.','error');return false}
  const e=ent(c.id);let locked=false;if(publish&&!e.base){locked=true;publish=false}
  if(!e.wifi&&h.wifi.enabled)h.wifi.enabled=false;if(!e.menu&&h.restaurant.enabled)h.restaurant.enabled=false;
  S.busy=true;paintBar();try{if(!(await slugFree(h.slug)))throw new Error('Another LinkHub already uses /link/'+h.slug+'. Pick a different address.');
    const s=await sb(),now=new Date().toISOString(),data=outData(),wasLive=S.row&&S.row.status==='published';
    const row={client_id:c.id,slug:h.slug,draft_data:data,updated_at:now,status:publish?'published':(wasLive?'published':'draft')};
    if(publish){row.published_data=Object.assign({},data,{status:'Active'});row.published_at=now}
    const r=await s.from('linkhub_pages').upsert(row,{onConflict:'client_id'}).select().single();if(r.error)throw r.error;
    const i=S.pages.findIndex(p=>p.client_id===c.id);if(i>=0)S.pages[i]=r.data;else S.pages.push(r.data);S.row=r.data;S.base=snap(S.h);
    if(locked)toast(PORTAL?'Saved as a draft. Add LinkHub Core or Pro to put it live.':'Saved as a draft. '+c.business_name+' needs LinkHub Core or Pro before it can go live.','error');else toast(publish?'Published · '+location.host+'/link/'+h.slug:wasLive?'Draft saved. The live page changes when you publish.':'Draft saved');return true}
  catch(err){toast(err.message||'Could not save the LinkHub.','error');return false}finally{S.busy=false;render()}}
async function unpublish(){if(!S.row)return;try{const s=await sb();const r=await s.from('linkhub_pages').update({status:'draft',updated_at:new Date().toISOString()}).eq('client_id',S.cid).select().single();if(r.error)throw r.error;
  const i=S.pages.findIndex(p=>p.client_id===S.cid);S.pages[i]=r.data;S.row=r.data;toast('Unpublished. /link/'+r.data.slug+' is offline until you publish again.');render()}catch(err){toast(err.message||'Could not unpublish.','error')}}
function createFor(){const c=client();if(!c)return;S.h=normalize({businessName:c.business_name,slug:slugify(c.business_name),links:[],visit:{enabled:false}},c);S.base='';render();toast('New LinkHub started. Publish when it looks right.')}

/* ---------- phone preview (v2 LinkHub look) ---------- */
function lhCls(h){const t=h.theme;return 'lh '+(['navy','red','sky'].includes(t)?'t-'+t:'')+' b-'+(h.style.btn||'round')}
function lhStyle(h){if(['cream','navy','red','sky'].includes(h.theme))return'';const st=h.style,bg=st.gradient&&st.gradient.a?`linear-gradient(${st.gradient.dir||'145deg'},${st.gradient.a},${st.gradient.b})`:st.bg;
  return `--lac:${st.text};--lbg:${st.bg};--lbtn:${st.button};--lbtnfg:${st.buttonText};--lin:${st.text};--lmu:color-mix(in srgb,${st.text} 72%,transparent);--lsur:color-mix(in srgb,${st.text} 12%,transparent);background:${bg}`}
function lhHTML(h,screen){const cls=lhCls(h),sty=lhStyle(h),bk='<button type="button" class="back" data-lhs="main">← Back</button>';
  if(screen==='menu'){const r=h.restaurant;return `<div class="${cls}" style="${sty}">${bk}<div class="scrn"><b>${esc(r.name||'Menu')}</b>${r.sections.filter(s=>s.visible!==false).map(s=>`<p style="font-weight:700;font-size:13px;margin-top:6px">${esc(s.name)}</p>`+s.items.filter(i=>i.visible!==false).map(i=>`<div class="mi"><span>${esc(i.name)}</span>${r.showPrices!==false&&i.price!==''&&i.price!=null?`<b style="font-family:var(--body);font-size:14px">$${Number(i.price).toFixed(2)}</b>`:''}</div>`).join('')).join('')||'<p class="mi">Menu items show here.</p>'}</div></div>`}
  if(screen==='wifi')return `<div class="${cls}" style="${sty}">${bk}<div class="scrn"><b>Free Wi-Fi</b><div class="mi"><span>Network</span><b style="font-family:var(--body);font-size:14px">${esc(h.wifi.ssid||'—')}</b></div>${h.wifi.password?`<div class="mi"><span>Password</span><b style="font-family:var(--body);font-size:14px">••••••</b></div><button type="button" class="lb">Copy password</button>`:''}</div></div>`;
  if(screen==='visit'){const v=h.visit;return `<div class="${cls}" style="${sty}">${bk}<div class="scrn"><b>Visit us</b>${v.address?`<div class="mi"><span>Address</span><span style="text-align:right">${esc(v.address)}</span></div>`:''}${v.hours.map(d=>`<div class="mi"><span>${d.day.slice(0,3)}</span><span>${d.closed?'Closed':esc(d.open)+'–'+esc(d.close)}</span></div>`).join('')}${httpOk(v.mapsUrl||h.mapUrl)?'<button type="button" class="lb">Get directions</button>':''}</div></div>`}
  const acts=[h.phone&&['phone','Call'],h.email&&['mail','Email'],httpOk(h.mapUrl)&&['pin','Directions'],httpOk(h.website)&&['globe','Website']].filter(Boolean);
  const f=[h.restaurant.enabled&&['menu','menu','Menu'],h.wifi.enabled&&['wifi','wifi','Wi-Fi'],h.visit.enabled&&['visit','pin','Visit us']].filter(Boolean);
  const soc=h.socials.filter(s=>s.visible!==false&&s.url);
  return `<div class="${cls}" style="${sty}"><div class="lha">${h.photoData?`<img src="${esc(h.photoData)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`:esc(ini(h.businessName))}</div><h3>${esc(h.businessName||'Business name')}</h3>${h.title?`<p class="bio" style="font-weight:600">${esc(h.title)}</p>`:''}${h.bio?`<p class="bio">${esc(h.bio)}</p>`:''}
   ${acts.length?`<div class="acts">${acts.map(a=>`<button type="button" aria-label="${a[1]}">${ic(a[0])}</button>`).join('')}</div>`:''}
   ${f.length?`<div class="feats" style="grid-template-columns:repeat(${f.length},1fr)">${f.map(x=>`<button type="button" data-lhs="${x[0]}">${ic(x[1])}${x[2]}</button>`).join('')}</div>`:''}
   ${h.links.filter(l=>l.visible!==false&&l.label).map(l=>`<span class="lb">${esc(l.label)}</span>`).join('')||'<p class="bio" style="text-align:center">Links you add show here.</p>'}
   ${soc.length?`<div class="soc">${soc.map(s=>ic((SOCIAL.find(x=>x[0].toLowerCase()===String(s.platform).toLowerCase())||[0,'link'])[1])).join('')}</div>`:''}<div class="made">Made with VMS LinkHub</div></div>`}
function paintPhone(){const s=$('#lhScr');if(s&&S.h)s.innerHTML='<span class="notch"></span>'+lhHTML(S.h,S.screen);const m=$('#lhMeter');if(m&&S.h){const v=strength(S.h);m.style.width=v+'%';$('#lhMeterN').textContent=v+'%'}paintBar()}
function paintBar(){const d=$('#lhDirty');if(d)d.textContent=dirty()?'Unsaved changes':'';$$('[data-pub],[data-save]').forEach(b=>{b.disabled=S.busy})}
function qrCanvas(cv,text,size){const m=window.VMSQRMatrix(text,'M'),n=m.n,q=2,cell=size/(n+q*2),dpr=Math.min(2,window.devicePixelRatio||1);cv.width=size*dpr;cv.height=size*dpr;const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle='#fff';x.fillRect(0,0,size,size);x.fillStyle='#003049';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m.dark(r,c))x.fillRect((c+q)*cell,(r+q)*cell,cell+.3,cell+.3);return cv}

/* ---------- render ---------- */
function render(){
  if(S.loading&&!S.clients.length){root.innerHTML='<div class="studio"><div class="stack"><div class="skel" style="height:96px"></div><div class="skel" style="height:140px"></div><div class="skel" style="height:300px"></div></div><div class="stack pvcol"><div class="skel" style="height:560px"></div></div></div>';return}
  const c=client(),picker=PORTAL?'':`<div class="card flat"><div class="fld"><label for="lhClient">Client</label><select id="lhClient" class="sel">${S.clients.map(x=>`<option value="${esc(x.id)}"${x.id===S.cid?' selected':''}>${esc(x.business_name||x.owner_email)}${pageOf(x.id)?'':' — no LinkHub yet'}</option>`).join('')}</select></div></div>`;
  if(S.error){root.innerHTML=`<div class="note bad"><b>Could not load LinkHubs.</b> ${esc(S.error)} <button class="btn gh sm" type="button" data-reload style="margin-left:8px">Try again</button></div>`;return}
  if(!S.clients.length){root.innerHTML=PORTAL?'<div class="card"><div class="empty"><b>Your account is still being set up</b>Your LinkHub appears here once VMS finishes setting up your account.</div></div>':'<div class="card"><div class="empty">Add a client in Clients first. Each client gets one LinkHub.</div></div>';return}
  if(!S.h){const e=ent(S.cid);root.innerHTML=`<div class="stack">${picker}<div class="card" style="text-align:center;padding:40px 20px;border-style:dashed"><div class="lic" style="margin:0 auto 12px;width:52px;height:52px">${ic('link')}</div><h3 style="font-family:var(--display);font-size:1.2rem;letter-spacing:-.02em">${PORTAL?'You don\'t have a LinkHub yet':esc(c?c.business_name:'')+' doesn\'t have a LinkHub yet'}</h3><p class="muted" style="margin:8px auto 18px;max-width:42ch">A LinkHub is a one-tap page for calls, directions, menu, Wi-Fi and links.${e.base?'':PORTAL?' You can build it now and save a draft. It goes live once you add LinkHub Core or Pro.':' This client has no LinkHub plan yet, so it can be built and saved as a draft.'}</p><button class="btn pri" type="button" data-new>${ic('plus')}${PORTAL?'Start my LinkHub':'Create one for them'}</button></div></div>`;bind();return}
  const h=S.h,e=ent(S.cid),live=S.row&&S.row.status==='published',st=stats(S.cid),sc=strength(h);
  root.innerHTML=`<div class="studio"><div class="stack">${picker}
  <div class="card"><div class="row"><span class="chip ${live?'ok':'warn'}"><span class="d"></span>${live?'Published':'Draft'}</span><span class="muted" style="font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(location.host)}/link/${esc(h.slug||'…')}</span><span class="sp"></span>${live?`<a class="btn gh sm" href="${esc(pubUrl(S.row.slug))}" target="_blank" rel="noopener">${ic('ext')}View live</a>`:''}<button class="btn acc sm" type="button" data-pub>${ic('send')}Publish</button></div>
   <div style="margin-top:14px"><div class="row" style="font-size:13.5px;margin-bottom:6px"><b>Page strength</b><span class="sp"></span><span class="muted" id="lhMeterN">${sc}%</span></div><div class="meter"><i id="lhMeter" style="width:${sc}%"></i></div></div>
   <div class="row" style="margin-top:12px;gap:18px;font-size:13.5px"><span><b>${st.views}</b> <span class="muted">views</span></span><span><b>${st.taps}</b> <span class="muted">taps</span></span><span><b>${st.rate}%</b> <span class="muted">tap rate</span></span><span class="chip ${e.base?'info':'bad'}">${e.base?'LinkHub '+e.plan:'No LinkHub plan'}</span><span class="sp"></span><span class="dirty" id="lhDirty"></span><button class="btn gh sm" type="button" data-save>${ic('check')}Save draft</button></div>
   ${e.base?'':`<div class="note warn" style="margin-top:12px"><b>Publishing is locked.</b> Add LinkHub Core or Pro for ${esc(c.business_name)} in <a href="/admin/billing.html">Billing</a>. You can still build and save the draft.</div>`}</div>
  <div class="card stack"><div class="card-h" style="margin:0"><h3>Profile</h3></div>
   <div class="row" style="gap:14px;align-items:center"><div class="lha" style="width:64px;height:64px;border-radius:20px;display:grid;place-items:center;background:var(--pri);color:var(--prifg);font-family:var(--display);font-weight:700;overflow:hidden;flex:none">${h.photoData?`<img src="${esc(h.photoData)}" alt="" style="width:100%;height:100%;object-fit:cover">`:esc(ini(h.businessName))}</div><label class="btn gh sm" style="cursor:pointer">${ic('upload')}${h.photoData?'Replace photo':'Upload logo or photo'}<input type="file" id="lhPhoto" accept="image/png,image/jpeg,image/webp" hidden></label>${h.photoData?`<button class="btn ghost sm" type="button" data-nophoto>Remove</button>`:''}</div>
   <div class="fld"><label for="lhT">Business name</label><input id="lhT" class="inp" data-k="businessName" value="${esc(h.businessName)}" maxlength="80"></div>
   <div class="fld"><label for="lhTag">Tagline <span class="muted" style="font-weight:500">(optional)</span></label><input id="lhTag" class="inp" data-k="title" value="${esc(h.title)}" maxlength="80"></div>
   <div class="fld"><label for="lhB">Short bio</label><input id="lhB" class="inp" data-k="bio" value="${esc(h.bio)}" maxlength="160"></div>
   <div class="fld"><label for="lhSlug">Page address</label><div class="row" style="gap:8px;flex-wrap:nowrap"><span class="muted" style="font-size:14px;white-space:nowrap">${esc(location.host)}/link/</span><input id="lhSlug" class="inp" value="${esc(h.slug)}" autocomplete="off" style="flex:1;min-width:0"></div>${live&&S.row.slug!==h.slug?'<span class="muted" style="font-size:12.5px">Changing the address breaks links and QR codes that point to the old one.</span>':''}</div></div>
  <div class="card stack"><div class="card-h" style="margin:0"><h3>Contact buttons</h3><span class="muted" style="font-size:13px">Blank ones are hidden</span></div>
   <div class="row" style="gap:12px;align-items:flex-start"><div class="fld" style="flex:1;min-width:180px"><label for="lhPh">Phone</label><input id="lhPh" class="inp" data-k="phone" value="${esc(h.phone)}" inputmode="tel"></div><div class="fld" style="flex:1;min-width:180px"><label for="lhEm">Email</label><input id="lhEm" class="inp" data-k="email" value="${esc(h.email)}" inputmode="email"></div></div>
   <div class="row" style="gap:12px;align-items:flex-start"><div class="fld" style="flex:1;min-width:180px"><label for="lhWeb">Website</label><input id="lhWeb" class="inp" data-k="website" value="${esc(h.website)}" inputmode="url" placeholder="https://"></div><div class="fld" style="flex:1;min-width:180px"><label for="lhMap">Directions link</label><input id="lhMap" class="inp" data-k="mapUrl" value="${esc(h.mapUrl)}" inputmode="url" placeholder="Google Maps link"></div></div></div>
  <div class="card"><div class="card-h"><h3>Links</h3><span class="muted" style="font-size:13px">Drag the handle to reorder</span></div>
   <div class="lrows" id="lrows">${h.links.map((l,i)=>`<div class="lrow" data-lid="${esc(l.id)}"><span class="handle" role="button" tabindex="0" aria-label="Drag to reorder ${esc(l.label||'link')}. Use arrow keys to move.">${ic('grip')}</span><div class="f"><input class="inp" data-ll="label" value="${esc(l.label)}" placeholder="Button text" aria-label="Link label"><input class="inp" data-ll="url" value="${esc(l.url)}" placeholder="https://" aria-label="Link address" inputmode="url"${l.url&&!httpOk(l.url)?' style="border-color:var(--bad)"':''}></div><button type="button" class="ib" data-lon aria-label="${l.visible!==false?'Hide':'Show'} link">${ic(l.visible!==false?'eye':'eyeoff')}</button><button type="button" class="ib" data-ldel aria-label="Delete link">${ic('trash')}</button></div>`).join('')||'<div class="empty">No links yet. Add one below.</div>'}</div>
   <p class="l" style="font-size:13px;font-weight:600;margin:14px 0 8px">Add a link</p><div class="chips-add">${ADDS.map(a=>`<button type="button" data-ladd="${esc(a[0])}">${ic('plus')}${esc(a[0])}</button>`).join('')}<button type="button" data-ladd="">${ic('plus')}Blank link</button></div></div>
  <div class="card"><div class="card-h"><h3>Social profiles</h3></div>
   <div class="lrows">${h.socials.map(s=>`<div class="lrow" style="grid-template-columns:minmax(110px,.6fr) minmax(0,1.4fr) auto" data-sid="${esc(s.id)}"><select class="sel" data-ss="platform" aria-label="Network" style="min-height:40px;font-size:14px">${SOCIAL.map(x=>`<option${x[0].toLowerCase()===String(s.platform).toLowerCase()?' selected':''}>${x[0]}</option>`).join('')}</select><input class="inp" data-ss="url" value="${esc(s.url)}" placeholder="Profile link" aria-label="Profile link"><button type="button" class="ib" data-sdel aria-label="Remove">${ic('trash')}</button></div>`).join('')}</div>
   <div class="chips-add" style="margin-top:10px">${SOCIAL.filter(x=>!h.socials.some(s=>String(s.platform).toLowerCase()===x[0].toLowerCase())).map(x=>`<button type="button" data-sadd="${x[0]}">${ic(x[1])}${x[0]}</button>`).join('')}</div></div>
  <div class="card"><div class="card-h"><h3>Features</h3></div>
   ${feat('restaurant','menu','Menu','Show your menu right inside the page',h.restaurant.enabled,e.menu,'Menu add-on')}
   ${h.restaurant.enabled?`<div class="fsub"><button class="btn gh sm" type="button" data-menu>${ic('menu')}Edit menu · ${h.restaurant.sections.reduce((a,s)=>a+s.items.length,0)} items</button></div>`:''}
   ${feat('wifi','wifi','Wi-Fi','Network + password with a copy button',h.wifi.enabled,e.wifi,'Wi-Fi add-on')}
   ${h.wifi.enabled?`<div class="wifi-row fsub"><div class="fld"><label for="lhSsid">Network name</label><input id="lhSsid" class="inp" data-w="ssid" value="${esc(h.wifi.ssid)}"></div><div class="fld"><label for="lhPass">Password</label><input id="lhPass" class="inp" data-w="password" value="${esc(h.wifi.password)}"></div><div class="fld"><label for="lhSec">Security</label><select id="lhSec" class="sel" data-w="security">${['WPA2','WPA3','WPA','WEP','None'].map(x=>`<option${x===h.wifi.security?' selected':''}>${x}</option>`).join('')}</select></div></div>`:''}
   ${feat('visit','pin','Visit us','Address, hours and directions',h.visit.enabled,true,'')}
   ${h.visit.enabled?`<div class="stack fsub" style="gap:10px"><div class="fld"><label for="lhAddr">Address</label><input id="lhAddr" class="inp" data-v="address" value="${esc(h.visit.address)}"></div><div class="fld"><label for="lhVm">Maps link</label><input id="lhVm" class="inp" data-v="mapsUrl" value="${esc(h.visit.mapsUrl)}" inputmode="url"></div>
     <div class="fld"><span class="l">Hours</span><div class="hrs">${h.visit.hours.map((d,i)=>`<div class="hr"><span>${d.day.slice(0,3)}</span>${d.closed?'<span class="muted">Closed</span>':`<span class="hrt"><input class="inp" type="time" data-hr="${i}:open" value="${esc(d.open)}" aria-label="${d.day} opens"><i>–</i><input class="inp" type="time" data-hr="${i}:close" value="${esc(d.close)}" aria-label="${d.day} closes"></span>`}<button type="button" class="btn ghost sm" data-closed="${i}">${d.closed?'Set hours':'Closed'}</button></div>`).join('')}</div></div></div>`:''}</div>
  <div class="card stack"><div class="card-h" style="margin:0"><h3>Appearance</h3></div><div class="fld"><span class="l">Theme</span><div class="themes">${THEMES.map(t=>`<button type="button" style="background:${t[2]}" data-lth="${t[0]}" aria-pressed="${h.theme===t[0]}" aria-label="${t[1]} theme" title="${t[1]}"></button>`).join('')}<button type="button" data-lth="custom" aria-pressed="${h.theme==='custom'}" aria-label="Custom colors" title="Custom" style="background:conic-gradient(#C1121F,#EB5E28,#669BBC,#003049,#C1121F)"></button></div></div>
   ${h.theme==='custom'?`<div class="colrow">${[['bg','Background'],['text','Text'],['button','Buttons'],['buttonText','Button text']].map(k=>`<label class="colpick"><input type="color" data-col="${k[0]}" value="${esc(h.style[k[0]]||'#003049')}">${k[1]}</label>`).join('')}</div>`:''}
   <div class="fld"><span class="l">Buttons</span><div class="seg2">${[['round','Rounded'],['pill','Pill'],['out','Outline']].map(b=>`<button type="button" data-lbtn="${b[0]}" aria-pressed="${(h.style.btn||'round')===b[0]}">${b[1]}</button>`).join('')}</div></div></div>
  ${S.row?`<div class="card"><div class="card-h"><h3>Page QR code</h3>${live?'':'<span class="chip warn">Publish first</span>'}</div><div class="row" style="gap:16px;align-items:center"><canvas id="lhQr" style="width:108px;height:108px;border-radius:12px;border:1px solid var(--line)"></canvas><div class="stack" style="gap:8px;flex:1;min-width:180px"><span class="muted" style="font-size:13.5px">Opens ${esc(location.host)}/link/${esc(S.row.slug)}. For a styled or tracked code, use QR Studio.</span><div class="row"><button class="btn gh sm" type="button" data-qrdl>${ic('dl')}PNG</button><button class="btn gh sm" type="button" data-copy>${ic('copy')}Copy link</button><a class="btn ghost sm" href="/admin/qr.html">${ic('qr')}QR Studio</a></div></div></div></div>`:''}
  ${S.row?`<div class="card"><div class="card-h"><h3>Top taps</h3><span class="chip info">${st.views} views</span></div>${st.top.length?`<div class="kv">${st.top.map(t=>`<div class="r"><span>${esc(t[0])}</span><b>${t[1]}</b></div>`).join('')}</div>`:'<p class="muted" style="font-size:14px">Taps on buttons and links show here once people visit the page.</p>'}${live?`<div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn dg sm" type="button" data-unpub>${ic('eyeoff')}Unpublish</button></div>`:''}</div>`:''}
 </div>
 <div class="pvcol stack"><div class="card" style="background:var(--surface2)"><div class="card-h"><h3>Live preview</h3><span class="chip">${{main:'Home',menu:'Menu',wifi:'Wi-Fi',visit:'Visit us'}[S.screen]||'Home'}</span></div><div class="phone"><div class="scr" id="lhScr"></div></div><p class="muted" style="font-size:12.5px;text-align:center;margin-top:10px">Tap Menu, Wi-Fi or Visit us in the preview to open them.</p></div></div></div>`;
  paintPhone();const q=$('#lhQr');if(q&&S.row)qrCanvas(q,pubUrl(S.row.slug),108);bind()}
function feat(key,icon,name,desc,on,allowed,addon){return `<div class="feat-row"><span class="lic">${ic(icon)}</span><div style="flex:1"><b>${name}</b><span>${allowed?desc:esc(addon)+' is not on this client’s plan. Add it in Billing.'}</span></div><button type="button" class="tog" role="switch" aria-checked="${!!on}" aria-label="${name}" data-feat="${key}"${allowed?'':' aria-disabled="true"'}></button></div>`}

/* ---------- inputs ---------- */
function bind(){const h=S.h;const cs=$('#lhClient');if(cs)cs.onchange=()=>{const v=cs.value;cs.value=S.cid;guard(async()=>{await pick(v);history.replaceState(null,'','?client='+encodeURIComponent(v))})};
  if(!h)return;
  $$('[data-k]').forEach(i=>i.oninput=()=>{h[i.dataset.k]=i.value;paintPhone()});
  const sl=$('#lhSlug');if(sl){sl.oninput=()=>{h.slug=sl.value;paintBar()};sl.onblur=()=>{h.slug=slugify(sl.value);sl.value=h.slug;paintBar()}}
  $$('[data-ll]').forEach(i=>i.oninput=()=>{const l=h.links.find(x=>x.id===i.closest('.lrow').dataset.lid);l[i.dataset.ll]=i.value;if(i.dataset.ll==='url')i.style.borderColor=i.value&&!httpOk(i.value)?'var(--bad)':'';paintPhone()});
  $$('[data-ss]').forEach(i=>i.addEventListener(i.tagName==='SELECT'?'change':'input',()=>{const s=h.socials.find(x=>x.id===i.closest('.lrow').dataset.sid);s[i.dataset.ss]=i.value;if(i.dataset.ss==='platform'){s.label=i.value;render()}else paintPhone()}));
  $$('[data-w]').forEach(i=>i.addEventListener(i.tagName==='SELECT'?'change':'input',()=>{h.wifi[i.dataset.w]=i.value;paintPhone()}));
  $$('[data-v]').forEach(i=>i.oninput=()=>{h.visit[i.dataset.v]=i.value;paintPhone()});
  $$('[data-hr]').forEach(i=>i.onchange=()=>{const [d,k]=i.dataset.hr.split(':');h.visit.hours[+d][k]=i.value;paintPhone()});
  $$('[data-col]').forEach(i=>i.oninput=()=>{h.style[i.dataset.col]=i.value;delete h.style.gradient;paintPhone()});
  const ph=$('#lhPhoto');if(ph)ph.onchange=()=>{const f=ph.files&&ph.files[0];if(!f)return;if(f.size>8e6)return toast('Pick an image under 8 MB.','error');const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,400/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);h.photoData=c.toDataURL('image/jpeg',.86);render()};im.src=rd.result};rd.readAsDataURL(f)};
  dragBind()}

/* drag to reorder: pointer events on the handle (mouse, iPhone, Android), rows move live, keyboard arrows too */
function dragBind(){const box=$('#lrows');if(!box||!S.h)return;let d=null;
  const rows=()=>$$('.lrow',box);
  box.addEventListener('pointerdown',e=>{const hd=e.target.closest('.handle');if(!hd)return;e.preventDefault();const row=hd.closest('.lrow');const r=row.getBoundingClientRect();
    d={row,id:row.dataset.lid,y0:e.clientY,top:r.top,pid:e.pointerId};row.classList.add('drag');row.style.zIndex=5;try{hd.setPointerCapture(e.pointerId)}catch{}});
  box.addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.pid)return;e.preventDefault();const dy=e.clientY-d.y0;d.row.style.transform=`translateY(${dy}px) scale(1.01)`;
    const mid=d.top+dy+d.row.offsetHeight/2;for(const r of rows()){if(r===d.row)continue;const b=r.getBoundingClientRect(),c=b.top+b.height/2;
      if(r.compareDocumentPosition(d.row)&Node.DOCUMENT_POSITION_FOLLOWING&&mid<c){const before=d.row.getBoundingClientRect().top;box.insertBefore(d.row,r);const after=d.row.getBoundingClientRect().top;d.y0+=after-before;d.top+=after-before;d.row.style.transform=`translateY(${e.clientY-d.y0}px) scale(1.01)`;break}
      if(r.compareDocumentPosition(d.row)&Node.DOCUMENT_POSITION_PRECEDING&&mid>c){const before=d.row.getBoundingClientRect().top;box.insertBefore(d.row,r.nextSibling);const after=d.row.getBoundingClientRect().top;d.y0+=after-before;d.top+=after-before;d.row.style.transform=`translateY(${e.clientY-d.y0}px) scale(1.01)`;break}}
    if(e.clientY<70)scrollBy(0,-8);else if(e.clientY>innerHeight-90)scrollBy(0,8)},{passive:false});
  const end=()=>{if(!d)return;const row=d.row;d=null;row.classList.remove('drag');row.style.transform='';row.style.zIndex='';const order=rows().map(r=>r.dataset.lid);const before=S.h.links.map(l=>l.id).join();
    S.h.links.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));if(before!==S.h.links.map(l=>l.id).join()){paintPhone();toast('Order updated')}};
  box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
  box.addEventListener('keydown',e=>{const hd=e.target.closest('.handle');if(!hd||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const L=S.h.links,id=hd.closest('.lrow').dataset.lid,fi=L.findIndex(l=>l.id===id),ti=fi+(e.key==='ArrowUp'?-1:1);if(ti<0||ti>=L.length)return;L.splice(ti,0,L.splice(fi,1)[0]);render();$(`[data-lid="${CSS.escape(id)}"] .handle`).focus()})}

/* menu editor (sheet) */
function menuSheet(){const r=S.h.restaurant;const draw=b=>{b.innerHTML=`<div class="stack"><div class="fld"><label for="mN">Menu title</label><input id="mN" class="inp" data-m="name" value="${esc(r.name)}"></div><div class="fld"><label for="mC">Cuisine or short note</label><input id="mC" class="inp" data-m="cuisine" value="${esc(r.cuisine)}"></div>
   <div class="trow"><div><b>Show prices</b></div><button type="button" class="tog" role="switch" aria-checked="${r.showPrices!==false}" data-mp></button></div>
   ${r.sections.map((s,si)=>`<div class="card flat" style="padding:12px"><div class="row" style="flex-wrap:nowrap"><input class="inp" data-sn="${si}" value="${esc(s.name)}" placeholder="Section (e.g. Breakfast)" style="font-weight:600"><button type="button" class="ib" data-sx="${si}" aria-label="Remove section">${ic('trash')}</button></div>
     ${s.items.map((it,ii)=>`<div class="row" style="flex-wrap:nowrap;margin-top:8px;gap:8px"><input class="inp" data-in="${si}:${ii}:name" value="${esc(it.name)}" placeholder="Item" style="flex:2"><input class="inp" data-in="${si}:${ii}:price" value="${esc(it.price)}" placeholder="Price" inputmode="decimal" style="flex:1;min-width:70px"><button type="button" class="ib" data-ix="${si}:${ii}" aria-label="Remove item">${ic('x')}</button></div>`).join('')}
     <button type="button" class="btn ghost sm" data-ia="${si}" style="margin-top:8px">${ic('plus')}Add item</button></div>`).join('')}
   <div class="row"><button type="button" class="btn gh sm" data-sa>${ic('plus')}Add section</button><span class="sp"></span><button type="button" class="btn pri sm" data-mdone>${ic('check')}Done</button></div></div>`};
  sheet('Menu',' ',b=>{draw(b);b.oninput=e=>{const t=e.target;if(t.dataset.m)r[t.dataset.m]=t.value;if(t.dataset.sn!=null)r.sections[+t.dataset.sn].name=t.value;if(t.dataset.in){const [si,ii,k]=t.dataset.in.split(':');r.sections[+si].items[+ii][k]=k==='price'?t.value.replace(/[^0-9.]/g,''):t.value}};
    b.onclick=e=>{const t=e.target.closest('button');if(!t)return;const d=t.dataset;if('mp' in d)r.showPrices=r.showPrices===false;else if(d.sx!=null)r.sections.splice(+d.sx,1);else if(d.ix){const [si,ii]=d.ix.split(':');r.sections[+si].items.splice(+ii,1)}else if(d.ia!=null)r.sections[+d.ia].items.push({id:uid('item'),name:'',description:'',price:'',visible:true});
      else if('sa' in d)r.sections.push({id:uid('sec'),name:'',visible:true,items:[{id:uid('item'),name:'',description:'',price:'',visible:true}]});else if('mdone' in d){closeSheet();render();return}else return;draw(b)}})}

root.addEventListener('click',ev=>{const t=ev.target.closest('button');if(!t||!root.contains(t))return;const d=t.dataset,h=S.h;
  if('reload' in d)return load();if('new' in d)return createFor();if(!h)return;
  if(d.lhs){S.screen=d.lhs;const s=$('#lhScr');paintPhone();const chip=s&&s.closest('.card').querySelector('.chip');if(chip)chip.textContent={main:'Home',menu:'Menu',wifi:'Wi-Fi',visit:'Visit us'}[d.lhs];return}
  if('lon' in d){const l=h.links.find(x=>x.id===t.closest('.lrow').dataset.lid);l.visible=l.visible===false;return render()}
  if('ldel' in d){h.links=h.links.filter(x=>x.id!==t.closest('.lrow').dataset.lid);return render()}
  if(d.ladd!=null){const a=ADDS.find(x=>x[0]===d.ladd);if(a&&a[1]==='social'){if(!h.socials.some(s=>/instagram/i.test(s.platform)))h.socials.push({id:uid('social'),platform:'Instagram',label:'Instagram',url:'https://instagram.com/',visible:true});render();$('[data-ss="url"]')?.focus();return}
    if(a&&a[1]==='phone'){render();const p=$('#lhPh');p.scrollIntoView({block:'center',behavior:'smooth'});p.focus();return toast('Add the phone number. It shows as the Call button.')}
    h.links.push({id:uid('link'),label:d.ladd,url:a?a[1]:'',visible:true,type:'Custom'});render();const ins=$$('[data-ll="url"]');const last=ins[ins.length-1];if(last){last.focus();last.setSelectionRange(last.value.length,last.value.length)}return}
  if(d.sadd){const x=SOCIAL.find(s=>s[0]===d.sadd);h.socials.push({id:uid('social'),platform:x[0],label:x[0],url:x[2],visible:true});render();const ins=$$('[data-ss="url"]');ins[ins.length-1]?.focus();return}
  if('sdel' in d){h.socials=h.socials.filter(s=>s.id!==t.closest('.lrow').dataset.sid);return render()}
  if(d.feat){if(t.getAttribute('aria-disabled')==='true')return toast('Add the '+(d.feat==='wifi'?'LinkHub Wi-Fi':'LinkHub Restaurant Menu')+' service for this client in Billing first.');const f=h[d.feat];f.enabled=!f.enabled;if(f.enabled&&d.feat==='restaurant'&&!f.sections.length)f.sections.push({id:uid('sec'),name:'Menu',visible:true,items:[]});S.screen='main';render();if(f.enabled&&d.feat==='restaurant')menuSheet();return}
  if('menu' in d)return menuSheet();
  if(d.closed!=null){const x=h.visit.hours[+d.closed];x.closed=!x.closed;return render()}
  if(d.lth){h.theme=d.lth;const th=THEMES.find(x=>x[0]===d.lth);if(th){const btn=h.style.btn;h.style=Object.assign({},clone(th[3]),{btn});if(!th[3].gradient)delete h.style.gradient}return render()}
  if(d.lbtn){h.style.btn=d.lbtn;return render()}
  if('nophoto' in d){h.photoData='';return render()}
  if('save' in d)return save(false);
  if('pub' in d)return save(true);
  if('unpub' in d)return sheet('Unpublish this LinkHub?',`<p class="muted">${esc(location.host)}/link/${esc(S.row.slug)} and any QR codes pointing to it will show “LinkHub unavailable” until you publish again.</p><div class="row" style="margin-top:16px"><button class="btn acc" type="button" data-u>Unpublish</button><button class="btn gh" type="button" data-c>Keep it live</button></div>`,b=>b.onclick=e=>{if(e.target.closest('[data-u]')){closeSheet();unpublish()}if(e.target.closest('[data-c]'))closeSheet()});
  if('copy' in d){const u=pubUrl(S.row.slug);return (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>toast('Link copied'),()=>toast(u))}
  if('qrdl' in d){const c=document.createElement('canvas');const m=window.VMSQRMatrix(pubUrl(S.row.slug),'M'),n=m.n,size=1200,cell=size/(n+8);c.width=c.height=size;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,size,size);x.fillStyle='#003049';for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(m.dark(r,k))x.fillRect((k+4)*cell,(r+4)*cell,cell+.5,cell+.5);
    return c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=S.row.slug+'-linkhub-qr.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)},'image/png')}
});
window.addEventListener('beforeunload',ev=>{if(dirty()){ev.preventDefault();ev.returnValue=''}});
render();V.ready().then(load);
})();
