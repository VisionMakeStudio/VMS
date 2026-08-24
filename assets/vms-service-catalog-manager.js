/* Vision Make Studio — live Service Catalog manager.
   Supabase public.service_catalog is the source of truth. */
(()=>{
  if(window.__VMS_LIVE_CATALOG_MANAGER__)return;
  window.__VMS_LIVE_CATALOG_MANAGER__=true;

  const $=id=>document.getElementById(id);
  const esc=str=>String(str??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=v=>JSON.parse(JSON.stringify(v));
  let services=[];
  let editingId=null;
  let ready=false;

  function setSync(message,state='loading'){
    const el=$('catalogSyncStatus');
    if(!el)return;
    el.dataset.state=state;
    const strong=el.querySelector('strong');
    if(strong)strong.textContent=message;
  }

  function toast(message){
    const t=$('toast');
    if(!t)return;
    t.textContent=message;
    t.classList.add('show');
    clearTimeout(window.__vmsCatalogToast);
    window.__vmsCatalogToast=setTimeout(()=>t.classList.remove('show'),2400);
  }

  function slug(name){
    const base=String(name||'service').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,54)||'service';
    return `${base}-${Date.now().toString(36)}`;
  }
  function lines(v){return String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
  function money(v){return window.VMSCatalog?.money?VMSCatalog.money(v):new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)||0)}
  function isArchived(s){return !!(s?.archived||s?.metadata?.archived)}
  function publicVisible(s,channel){return !isArchived(s)&&s.status==='Published'&&!!s[channel]&&s.kind!=='internal'}
  function priceLabel(s){return window.VMSCatalog?.priceLabel?VMSCatalog.priceLabel(s):'Request pricing'}
  function statusBadge(s){const cls=s.status==='Published'?'green':s.status==='Draft'?'orange':'gray';return `<span class="badge ${cls}">${esc(s.status)}</span>`}
  function kindLabel(kind){return ({service:'Service',subscription:'Subscription',addon:'Add-on',package:'Package',bundle:'Bundle',internal:'Internal'})[kind]||'Service'}

  function filtered(){
    const q=($('searchInput')?.value||'').trim().toLowerCase();
    const status=$('statusFilter')?.value||'all';
    const channel=$('channelFilter')?.value||'all';
    const sales=$('salesFilter')?.value||'all';
    return services
      .filter(s=>!isArchived(s))
      .filter(s=>{
        const hay=`${s.name} ${s.category} ${s.description} ${s.kind}`.toLowerCase();
        const channelMatch=channel==='all'||(channel==='website'&&s.websiteVisible)||(channel==='portal'&&s.portalVisible)||(channel==='both'&&s.websiteVisible&&s.portalVisible);
        return (!q||hay.includes(q))&&(status==='all'||s.status===status)&&channelMatch&&(sales==='all'||s.salesMode===sales);
      })
      .sort((a,b)=>(Number(a.displayOrder)||999)-(Number(b.displayOrder)||999)||String(a.name).localeCompare(String(b.name)));
  }

  function updateStats(){
    const active=services.filter(s=>!isArchived(s));
    $('statTotal').textContent=active.length;
    $('statPublished').textContent=active.filter(s=>s.status==='Published').length;
    $('statWebsite').textContent=active.filter(s=>publicVisible(s,'websiteVisible')).length;
    $('statPortal').textContent=active.filter(s=>publicVisible(s,'portalVisible')).length;
    $('statRecurring').textContent=active.filter(s=>['Recurring','Setup + Recurring'].includes(s.pricingModel)).length;
  }

  function render(){
    updateStats();
    const list=filtered();
    $('emptyState').style.display=list.length?'none':'block';
    $('catalogList').innerHTML=list.map(s=>`
      <article class="service-row" data-id="${esc(s.id)}">
        <div class="service-main mobile-summary">
          <div class="service-icon">${esc((s.icon||'VMS').toUpperCase())}</div>
          <div class="service-copy">
            <strong>${esc(s.name)}</strong>
            <span>${esc(s.category||'Uncategorized')} · ${esc(kindLabel(s.kind))} · ${esc(s.description||'No description')}</span>
            <div class="badges">
              ${statusBadge(s)}
              <span class="badge ${s.salesMode==='Buy Now'?'blue':'gray'}">${esc(s.salesMode||'Request First')}</span>
              ${s.featured?'<span class="badge orange">Featured</span>':''}
            </div>
          </div>
        </div>
        <div class="cell"><span>PRICE</span><strong>${esc(priceLabel(s))}</strong></div>
        <div class="cell"><span>CHANNELS</span><div class="badges">${s.websiteVisible?'<span class="badge blue">Website</span>':''}${s.portalVisible?'<span class="badge blue">Portal</span>':''}${!s.websiteVisible&&!s.portalVisible?'<span class="badge gray">Internal only</span>':''}</div></div>
        <div class="cell portal-cell"><span>PROMOS / ORDER</span><strong>${s.promoEligible?'Promo eligible':'No promos'} · #${Number(s.displayOrder)||'-'}</strong></div>
        <div class="row-actions"><div class="vms-service-action-wrap">
          <button class="vms-service-kebab" data-id="${esc(s.id)}" type="button" aria-label="Actions for ${esc(s.name)}" aria-expanded="false">⋯</button>
          <div class="vms-service-action-menu" data-menu-for="${esc(s.id)}" role="menu">
            <button class="preview-one" data-id="${esc(s.id)}" type="button" role="menuitem">Preview</button>
            <button class="edit-service" data-id="${esc(s.id)}" type="button" role="menuitem">Edit</button>
            <button class="duplicate-service" data-id="${esc(s.id)}" type="button" role="menuitem">Duplicate</button>
            <button class="toggle-publish" data-id="${esc(s.id)}" type="button" role="menuitem">${s.status==='Published'?'Hide':'Publish'}</button>
          </div>
        </div></div>
      </article>`).join('');
  }

  function closeModal(id){$(id)?.classList.remove('show')}

  function openServiceModal(id=null){
    editingId=id;
    const s=id?services.find(x=>x.id===id):null;
    $('serviceModalTitle').textContent=s?'Edit Service':'Add Service';
    $('archiveServiceBtn').style.visibility=s&&s.kind!=='internal'?'visible':'hidden';
    $('serviceNameInput').value=s?.name||'';
    $('categoryInput').value=s?.category||'';
    $('kindInput').value=s?.kind||'service';
    $('iconInput').value=s?.icon||'';
    $('statusInput').value=s?.status||'Draft';
    $('descriptionInput').value=s?.description||'';
    $('featuresInput').value=(s?.features||[]).join('\n');
    $('includedInput').value=(s?.included||[]).join('\n');
    $('pricingModelInput').value=s?.pricingModel||'Quote Only';
    $('salesModeInput').value=s?.salesMode||'Request First';
    $('setupPriceInput').value=s?.oneTimePrice??'';
    $('recurringPriceInput').value=s?.recurringPrice??'';
    $('cadenceInput').value=s?.cadence||'Monthly';
    $('orderInput').value=s?.displayOrder||Math.max(1,services.filter(x=>!isArchived(x)).length+1);
    $('websiteVisibleInput').checked=s?.websiteVisible??true;
    $('portalVisibleInput').checked=s?.portalVisible??true;
    $('promoEligibleInput').checked=s?.promoEligible??true;
    $('startingAtInput').checked=s?.startingAt??false;
    $('featuredInput').checked=s?.featured??false;
    updateEditorPreview();
    $('serviceModal').classList.add('show');
  }

  function editorData(){
    return {
      name:$('serviceNameInput').value.trim(),category:$('categoryInput').value.trim(),kind:$('kindInput').value,icon:$('iconInput').value.trim(),status:$('statusInput').value,
      description:$('descriptionInput').value.trim(),features:lines($('featuresInput').value),included:lines($('includedInput').value),pricingModel:$('pricingModelInput').value,
      salesMode:$('salesModeInput').value,oneTimePrice:$('setupPriceInput').value.trim()===''?null:Number($('setupPriceInput').value),recurringPrice:$('recurringPriceInput').value.trim()===''?null:Number($('recurringPriceInput').value),
      cadence:$('cadenceInput').value,displayOrder:Number($('orderInput').value)||1,websiteVisible:$('websiteVisibleInput').checked,portalVisible:$('portalVisibleInput').checked,
      promoEligible:$('promoEligibleInput').checked,startingAt:$('startingAtInput').checked,featured:$('featuredInput').checked
    };
  }

  function updateEditorPreview(){
    const s={...editorData(),id:'preview',metadata:{}};
    $('pricePreview').textContent=priceLabel(s);
    $('actionPreview').textContent=s.salesMode==='Buy Now'?'Buy Now':s.salesMode==='Internal'?'Internal':'Request Service';
    $('statusPreview').textContent=s.status;
  }

  function validateService(d){
    if(!d.name)return 'Enter a service name';
    if(d.salesMode==='Buy Now'&&d.pricingModel==='Quote Only')return 'Buy Now needs a fixed pricing model';
    if(d.pricingModel==='One-Time'&&d.oneTimePrice===null)return 'Enter the one-time price';
    if(d.pricingModel==='Recurring'&&d.recurringPrice===null)return 'Enter the recurring price';
    if(d.pricingModel==='Setup + Recurring'&&d.recurringPrice===null)return 'Enter the recurring price';
    return '';
  }

  async function saveService(){
    if(!ready)return toast('Live catalog is still loading');
    const d=editorData();
    const issue=validateService(d);
    if(issue){toast(issue);if(!d.name)$('serviceNameInput').focus();return}
    const btn=$('saveServiceBtn');btn.disabled=true;setSync('Saving to live catalog…','saving');
    try{
      const existing=editingId?services.find(x=>x.id===editingId):null;
      const item={...(existing?clone(existing):{}),...d,id:existing?.id||slug(d.name),metadata:{...(existing?.metadata||{}),archived:false}};
      const saved=await VMSCatalog.save(item);
      const i=services.findIndex(x=>x.id===saved.id);
      if(i>=0)services[i]=saved;else services.push(saved);
      editingId=saved.id;render();closeModal('serviceModal');
      setSync(`Live catalog connected · ${services.filter(x=>!isArchived(x)).length} records`,'ok');
      toast(saved.status==='Published'?'Saved live · website/portal catalog updated':'Saved live');
    }catch(err){
      console.error('VMS catalog save failed',err);setSync('Could not save live catalog','error');toast(err?.message||'Could not save service');
    }finally{btn.disabled=false}
  }

  async function archiveService(){
    const s=services.find(x=>x.id===editingId);if(!s||s.kind==='internal')return;
    if(!confirm(`Archive "${s.name}"? It will be hidden from the website and Client Portal but kept in the live catalog history.`))return;
    setSync('Archiving service…','saving');
    try{
      const item={...s,status:'Hidden',websiteVisible:false,portalVisible:false,metadata:{...(s.metadata||{}),archived:true}};
      const saved=await VMSCatalog.save(item);const i=services.findIndex(x=>x.id===s.id);if(i>=0)services[i]=saved;
      render();closeModal('serviceModal');setSync(`Live catalog connected · ${services.filter(x=>!isArchived(x)).length} active records`,'ok');toast('Service archived');
    }catch(err){setSync('Could not archive service','error');toast(err?.message||'Archive failed')}
  }

  async function duplicateService(id){
    const s=services.find(x=>x.id===id);if(!s)return;
    setSync('Creating catalog copy…','saving');
    try{
      const copy={...clone(s),id:slug(s.name),name:`${s.name} Copy`,status:'Draft',featured:false,displayOrder:Math.max(...services.map(x=>Number(x.displayOrder)||0),0)+1,metadata:{...(s.metadata||{}),archived:false}};
      const saved=await VMSCatalog.save(copy);services.push(saved);render();setSync(`Live catalog connected · ${services.filter(x=>!isArchived(x)).length} records`,'ok');toast('Duplicated as Draft');
    }catch(err){setSync('Could not duplicate service','error');toast(err?.message||'Duplicate failed')}
  }

  async function togglePublish(id){
    const s=services.find(x=>x.id===id);if(!s)return;
    setSync('Updating publish status…','saving');
    try{
      const saved=await VMSCatalog.save({...s,status:s.status==='Published'?'Hidden':'Published',metadata:{...(s.metadata||{}),archived:false}});
      const i=services.findIndex(x=>x.id===id);if(i>=0)services[i]=saved;render();setSync(`Live catalog connected · ${services.filter(x=>!isArchived(x)).length} records`,'ok');toast(saved.status==='Published'?'Published live':'Hidden from public catalog');
    }catch(err){setSync('Could not update publish status','error');toast(err?.message||'Update failed')}
  }

  function previewCard(s){
    const button=s.salesMode==='Buy Now'?'Buy Now':'Request Service';
    const feats=(s.features||[]).slice(0,4).map(x=>`<small style="display:block;margin-top:4px;color:#607682">✓ ${esc(x)}</small>`).join('');
    return `<div class="preview-card"><div class="preview-service-icon">${esc((s.icon||'VMS').toUpperCase())}</div><h4>${esc(s.name)}</h4><p>${esc(s.description||'')}</p><div class="preview-price">${esc(priceLabel(s))}</div>${feats}<button class="btn ${s.salesMode==='Buy Now'?'primary':''}" type="button">${button}</button></div>`;
  }
  function renderPreview(focusId=null){
    const web=services.filter(s=>publicVisible(s,'websiteVisible')).sort((a,b)=>(a.displayOrder||999)-(b.displayOrder||999));
    const portal=services.filter(s=>publicVisible(s,'portalVisible')).sort((a,b)=>(a.displayOrder||999)-(b.displayOrder||999));
    const only=id=>focusId?id===focusId:true;
    const webShow=web.filter(s=>only(s.id)),portalShow=portal.filter(s=>only(s.id));
    $('websitePreview').innerHTML=webShow.length?webShow.map(previewCard).join('<div style="height:8px"></div>'):'<div class="empty">Nothing published to the website.</div>';
    $('portalPreview').innerHTML=portalShow.length?portalShow.map(previewCard).join('<div style="height:8px"></div>'):'<div class="empty">Nothing published to the Client Portal.</div>';
    $('previewModal').classList.add('show');
  }

  async function waitForAdminVerification(timeoutMs=9000){
    const root=document.documentElement;
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      if(root.dataset.vmsAuthVerified==='admin')return true;
      /* The shared auth guard owns verification. Do not call requireSession here,
         otherwise Service Catalog would reintroduce the double-auth/login flash. */
      if(!root.classList.contains('vms-auth-pending') && root.dataset.vmsAuthVerified!=='admin'){
        await new Promise(resolve=>setTimeout(resolve,80));
      }else{
        await new Promise(resolve=>setTimeout(resolve,80));
      }
    }
    return root.dataset.vmsAuthVerified==='admin';
  }

  async function init(){
    if(!window.VMSCatalog){setSync('Catalog runtime did not load','error');toast('VMS catalog runtime is unavailable');return}
    if(location.protocol!=='file:'){
      setSync('Verifying Admin catalog access…','loading');
      const verified=await waitForAdminVerification();
      if(!verified){
        setSync('Admin verification is still pending','error');
        return;
      }
    }
    setSync('Loading live Supabase catalog…','loading');
    try{
      services=await VMSCatalog.load();
      ready=true;render();
      const live=VMSCatalog.configReady()&&location.protocol!=='file:';
      setSync(live?`Live catalog connected · ${services.filter(x=>!isArchived(x)).length} records`:`Local preview · ${services.filter(x=>!isArchived(x)).length} records`,live?'ok':'loading');
    }catch(err){console.error('Catalog load failed',err);setSync('Could not load live catalog','error');toast(err?.message||'Could not load catalog')}
  }

  $('topAddServiceBtn').onclick=()=>openServiceModal();
  $('previewCatalogBtn').onclick=()=>renderPreview();
  $('saveServiceBtn').onclick=saveService;
  $('archiveServiceBtn').onclick=archiveService;
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  document.querySelectorAll('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')}));
  ['kindInput','pricingModelInput','salesModeInput','setupPriceInput','recurringPriceInput','cadenceInput','statusInput','websiteVisibleInput','portalVisibleInput','startingAtInput'].forEach(id=>$(id)?.addEventListener('input',updateEditorPreview));
  $('catalogList').addEventListener('click',e=>{
    const kebab=e.target.closest('.vms-service-kebab');
    if(kebab){e.stopPropagation();const menu=kebab.closest('.vms-service-action-wrap')?.querySelector('.vms-service-action-menu');const willOpen=menu&&!menu.classList.contains('open');document.querySelectorAll('.vms-service-action-menu.open').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.vms-service-kebab[aria-expanded="true"]').forEach(x=>x.setAttribute('aria-expanded','false'));if(menu&&willOpen){menu.classList.add('open');kebab.setAttribute('aria-expanded','true')}return}
    const edit=e.target.closest('.edit-service'),dup=e.target.closest('.duplicate-service'),pub=e.target.closest('.toggle-publish'),prev=e.target.closest('.preview-one');
    if(edit)return openServiceModal(edit.dataset.id);if(dup)return duplicateService(dup.dataset.id);if(pub)return togglePublish(pub.dataset.id);if(prev)return renderPreview(prev.dataset.id);
    if(window.matchMedia('(max-width:760px)').matches){const summary=e.target.closest('.mobile-summary');if(summary){const row=summary.closest('.service-row'),was=row.classList.contains('expanded');document.querySelectorAll('.service-row.expanded').forEach(x=>x.classList.remove('expanded'));row.classList.toggle('expanded',!was)}}
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.vms-service-action-wrap')){document.querySelectorAll('.vms-service-action-menu.open').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.vms-service-kebab[aria-expanded="true"]').forEach(x=>x.setAttribute('aria-expanded','false'))}});
  ['searchInput','statusFilter','channelFilter','salesFilter'].forEach(id=>$(id)?.addEventListener(id==='searchInput'?'input':'change',render));
  if($('mobileMenuBtn'))$('mobileMenuBtn').onclick=()=>{$('sidebar')?.classList.add('open');$('drawerBackdrop')?.classList.add('show')};
  if($('drawerBackdrop'))$('drawerBackdrop').onclick=()=>{$('sidebar')?.classList.remove('open');$('drawerBackdrop')?.classList.remove('show')};
  if($('billingNavBtn'))$('billingNavBtn').onclick=()=>location.href='/admin/billing.html';
  if($('promotionsNavBtn'))$('promotionsNavBtn').onclick=()=>location.href='/admin/promotions.html';

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
