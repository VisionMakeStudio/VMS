(()=>{
  'use strict';
  const path=(location.pathname||'').toLowerCase();
  const isAdmin=path.includes('/admin/')&&(path.includes('qr')||document.getElementById('trackingToggle'));
  const isPortal=path.startsWith('/portal');
  if(!isAdmin&&!isPortal)return;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let sb=null,catalog=[],clients=[],services=[],dynamicService=null,currentClient=null,allowed=false;
  const ACTIVE_SERVICE=new Set(['active','published','enabled']),ACTIVE_BILLING=new Set(['active','paid','trialing','gifted','comped']);
  const price=s=>{if(!s)return '';const recurring=/recurring/i.test(String(s.pricing_model||'')),n=Number(recurring?s.recurring_price:s.one_time_price);if(!Number.isFinite(n)||n<=0)return '';return `$${n.toFixed(2)}${recurring?`/${String(s.cadence||'month').toLowerCase().startsWith('annual')?'yr':'mo'}`:''}`};
  function toast(msg,type='info'){if(window.VMSToast)return VMSToast(msg,type);if(typeof window.toast==='function')return window.toast(msg);console[type==='error'?'error':'log'](msg)}
  async function supabase(){if(sb)return sb;if(!window.VMSAuth?.client)return null;sb=await VMSAuth.client();return sb}
  function active(s){return ACTIVE_SERVICE.has(String(s.service_status||'').toLowerCase())&&ACTIVE_BILLING.has(String(s.billing_status||'').toLowerCase())}
  async function loadCatalog(){const s=await supabase();if(!s)return;const {data}=await s.from('service_catalog').select('id,name,pricing_model,one_time_price,recurring_price,cadence,sales_mode,portal_visible,status,metadata').eq('status','Published');catalog=data||[];dynamicService=catalog.find(x=>x.metadata?.family==='qr'&&x.metadata?.analyticsIncluded===true)||catalog.find(x=>/dynamic|tracking|analytics/i.test(`${x.id} ${x.name}`)&&x.metadata?.family==='qr')||null}
  async function refreshAdminEntitlement(){const s=await supabase();if(!s)return;const business=$('#businessInput')?.value.trim();if(!business){allowed=false;renderLock();return}if(!clients.length){const {data}=await s.from('clients').select('id,business_name,owner_email');clients=data||[]}currentClient=clients.find(c=>c.business_name.toLowerCase()===business.toLowerCase())||null;if(!currentClient){allowed=false;services=[];renderLock('Choose an existing VMS client to check Dynamic QR access.');return}const {data}=await s.from('client_services').select('*').eq('client_id',currentClient.id);services=data||[];allowed=!!dynamicService&&services.some(x=>active(x)&&[x.service_key,x.catalog_service_id].includes(dynamicService.id));renderLock()}
  async function refreshPortalEntitlement(){const s=await supabase();if(!s)return;const {data:{session}}=await s.auth.getSession();if(!session)return;const {data:c}=await s.from('clients').select('id,business_name').eq('owner_email',session.user.email).maybeSingle();currentClient=c||null;if(!c){allowed=false;return renderPortalQrLock()}const {data}=await s.from('client_services').select('*').eq('client_id',c.id);services=data||[];allowed=!!dynamicService&&services.some(x=>active(x)&&[x.service_key,x.catalog_service_id].includes(dynamicService.id));renderPortalQrLock()}
  function installStyle(){if($('#vmsP4QrStyle'))return;const s=document.createElement('style');s.id='vmsP4QrStyle';s.textContent=`
    #vmsP4QrModeInfo{margin-top:9px;border:1px solid #dce7eb;border-radius:11px;padding:10px 11px;background:#f8fbfc;color:#607680;font-size:12px;line-height:1.45}#vmsP4QrModeInfo strong{color:#003049}.tracking-control.vms-p4-locked{opacity:.78}.tracking-control.vms-p4-locked .switch{cursor:not-allowed}.vms-p4-layout-label{margin:10px 0 0;text-align:center;color:#607680;font-size:12px;font-weight:850}.preview-canvas.vms-layout-sticker{width:min(330px,100%)!important;max-width:330px!important;min-height:330px!important;aspect-ratio:1/1!important;border-radius:28px!important;padding:26px!important;margin-left:auto!important;margin-right:auto!important}.preview-canvas.vms-layout-counter{width:min(360px,100%)!important;max-width:360px!important;min-height:540px!important;aspect-ratio:2/3!important;border-radius:20px!important;padding:42px 34px!important;margin-left:auto!important;margin-right:auto!important}.preview-canvas.vms-layout-flyer{width:min(410px,100%)!important;max-width:410px!important;min-height:530px!important;aspect-ratio:8.5/11!important;border-radius:5px!important;padding:48px 38px!important;margin-left:auto!important;margin-right:auto!important}.preview-canvas.vms-layout-qr-only{width:min(390px,100%)!important;max-width:390px!important;min-height:410px!important;aspect-ratio:auto!important;border-radius:18px!important;padding:28px 22px!important;margin-left:auto!important;margin-right:auto!important}.real-qr{background:#fff!important;padding:14px!important;width:max-content!important;max-width:100%!important;margin-left:auto!important;margin-right:auto!important;border-radius:8px!important}.real-qr canvas,.real-qr img{display:block!important;image-rendering:pixelated!important;max-width:100%!important;height:auto!important}.vms-p4-qr-modal{position:fixed;inset:0;z-index:2147482600;background:rgba(0,35,52,.56);display:none;align-items:center;justify-content:center;padding:18px}.vms-p4-qr-modal.open{display:flex}.vms-p4-qr-modal-card{width:min(520px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 25px 80px rgba(0,48,73,.27)}.vms-p4-qr-modal-card header{background:#003049;color:#fff;padding:20px}.vms-p4-qr-modal-card header h3{margin:0;font-size:21px}.vms-p4-qr-modal-card main{padding:20px;color:#526b76;font-size:14px;line-height:1.55}.vms-p4-qr-modal-actions{display:flex;gap:8px;justify-content:flex-end;padding:0 20px 20px}.vms-p4-qr-modal-actions button{min-height:41px;border-radius:9px;border:1px solid #d6e2e7;padding:0 13px;background:#fff;color:#003049;font-weight:850}.vms-p4-qr-modal-actions .primary{background:#003049;color:#fff;border-color:#003049}.vms-p4-brand-fixed{display:none!important}
  `;document.head.appendChild(s)}
  function forceBranding(){const toggle=$('#vmsToggle');if(toggle){const control=toggle.closest('.control');if(control)control.classList.add('vms-p4-brand-fixed');if(!toggle.classList.contains('active'))toggle.click();toggle.style.pointerEvents='none';toggle.setAttribute('aria-disabled','true')}const foot=$('#previewFoot');if(foot){foot.textContent='Made with Vision Make Studio';foot.style.display='block'}$$('[id*="clientCardVms"],.client-report-footer').forEach(el=>{el.style.display='block';if(/powered|made/i.test(el.textContent||''))el.textContent='Made with Vision Make Studio'})}
  function ensureModeInfo(){const c=$('.tracking-control');if(!c)return null;let info=$('#vmsP4QrModeInfo');if(!info){info=document.createElement('div');info.id='vmsP4QrModeInfo';c.appendChild(info)}return info}
  function renderLock(custom=''){const info=ensureModeInfo(),toggle=$('#trackingToggle');if(!info||!toggle)return;const p=price(dynamicService);if(allowed){info.innerHTML='<strong>Dynamic QR Active</strong> · Scan tracking is included for this client.';cLock(false);return}cLock(true);info.innerHTML=custom||(!dynamicService?'<strong>Dynamic QR is locked.</strong> No Dynamic/analytics QR service is currently published in Service Catalog. Static QR remains available.':`<strong>Dynamic QR not included.</strong> ${dynamicService.name}${p?` · ${p}`:''}. Select the locked control to manage/add the service.`)}
  function cLock(on){const c=$('.tracking-control'),toggle=$('#trackingToggle');if(!c||!toggle)return;c.classList.toggle('vms-p4-locked',on);toggle.dataset.vmsP4Locked=on?'1':'0'}
  function modal(){let m=$('#vmsP4QrModal');if(m)return m;m=document.createElement('div');m.id='vmsP4QrModal';m.className='vms-p4-qr-modal';m.innerHTML=`<div class="vms-p4-qr-modal-card" role="dialog" aria-modal="true"><header><h3>Dynamic QR Tracking</h3></header><main id="vmsP4QrModalCopy"></main><div class="vms-p4-qr-modal-actions"><button data-close type="button">Close</button>${isAdmin?'':`<button id="vmsP4QrAskVms" type="button">Ask VMS</button>`}<button class="primary" id="vmsP4QrServiceAction" type="button">${isAdmin?'Manage / Add Service':'View Services & Bundles'}</button></div></div>`;document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))m.classList.remove('open')});$('#vmsP4QrServiceAction',m).onclick=()=>{if(isAdmin)location.href='/admin/service-catalog.html';else{m.classList.remove('open');document.querySelector('#nav [data-section="services"]')?.click()|| (location.href='/portal/#services')}};$('#vmsP4QrAskVms',m)?.addEventListener('click',()=>{m.classList.remove('open');const help=$('#requestQrHelpBtn');if(help)help.click();else document.querySelector('#nav [data-section="requests"]')?.click()});return m}
  function openLocked(){const m=modal(),p=price(dynamicService);$('#vmsP4QrModalCopy',m).innerHTML=dynamicService?`<p><strong>${dynamicService.name}</strong>${p?` costs <strong>${p}</strong>`:''} based on the current VMS Service Catalog.</p><p>Dynamic QR keeps the printed code the same while letting VMS change the destination and record scan analytics. Static QR directly contains its destination and has no scan analytics.</p>`:'<p>Dynamic QR tracking is not currently published as a purchasable Service Catalog item. Static QR is still available.</p><p>Once a Dynamic QR service is added to the Service Catalog and assigned to the client, this control unlocks automatically.</p>';m.classList.add('open')}
  function installTrackingGuard(){const t=$('#trackingToggle');if(!t||t.dataset.vmsP4Guard)return;t.dataset.vmsP4Guard='1';t.addEventListener('click',e=>{if(t.dataset.vmsP4Locked==='1'){e.preventDefault();e.stopImmediatePropagation();openLocked()}},true);$('#saveBtn')?.addEventListener('click',e=>{if(t.dataset.vmsP4Locked==='1'&&t.classList.contains('active')){e.preventDefault();e.stopImmediatePropagation();toast('Dynamic QR is not active for this client. Switch to Static or manage the service first.','error');openLocked()}},true);$('#businessInput')?.addEventListener('change',()=>refreshAdminEntitlement());$('#businessInput')?.addEventListener('blur',()=>refreshAdminEntitlement())}
  const dims={"qr-only":'QR Only · square',sticker:'Sticker · compact',counter:'Countertop · 4 × 6 in',flyer:'Flyer · 8.5 × 11 in'};
  let livePreset='qr-only';

  function normalizePreset(value){
    const raw=String(value||'').trim().toLowerCase();
    if(!raw)return '';
    if(raw==='qr' || raw==='qr-card' || raw==='qronly' || raw==='qr_only' || raw.includes('qr only'))return 'qr-only';
    if(raw.includes('sticker'))return 'sticker';
    if(raw.includes('counter'))return 'counter';
    if(raw.includes('flyer'))return 'flyer';
    return ['qr-only','sticker','counter','flyer'].includes(raw)?raw:'';
  }

  function previewCanvas(){
    return $('#previewCanvas') || $('.preview-canvas') || $('[data-qr-preview]') || $('.live-preview .preview') || $('.qr-live-preview');
  }

  function presetFromButton(btn){
    if(!btn)return '';
    return normalizePreset(
      btn.dataset?.preset || btn.dataset?.layout || btn.dataset?.layoutPreset || btn.dataset?.template || btn.value || btn.textContent
    );
  }

  function allPresetButtons(){
    const direct=$$('[data-preset],[data-layout],[data-layout-preset],[data-template]');
    const textMatches=$$('button').filter(btn=>/^(qr\s*(only|card)|sticker|countertop|flyer)$/i.test(String(btn.textContent||'').trim()));
    return Array.from(new Set([...direct,...textMatches])).filter(btn=>presetFromButton(btn));
  }

  function syncPresetButtons(preset){
    allPresetButtons().forEach(btn=>{
      const match=presetFromButton(btn)===preset;
      if(btn.classList.contains('choice') || btn.closest('#presetChoices') || /layout|preset/i.test(String(btn.parentElement?.textContent||''))){
        btn.classList.toggle('active',match);
        btn.setAttribute('aria-pressed',match?'true':'false');
      }
    });
  }

  function setPreset(preset,{sync=true}={}){
    preset=normalizePreset(preset)||'qr-only';
    livePreset=preset;

    const canvas=previewCanvas();
    if(canvas){
      Object.keys(dims).forEach(k=>canvas.classList.remove(`vms-layout-${k}`));
      canvas.classList.add(`vms-layout-${preset}`);
      canvas.dataset.vmsLayoutPreset=preset;

      let label=$('#vmsP4LayoutLabel');
      if(!label){
        label=document.createElement('div');
        label.id='vmsP4LayoutLabel';
        label.className='vms-p4-layout-label';
        canvas.insertAdjacentElement('afterend',label);
      }
      label.textContent=dims[preset]||preset;
    }

    if(sync)syncPresetButtons(preset);
    try{window.dispatchEvent(new CustomEvent('vms:qr-layout-change',{detail:{preset}}))}catch{}
  }

  function installPresetPreview(){
    if(document.documentElement.dataset.vmsP4PresetPreview!=='1'){
      document.documentElement.dataset.vmsP4PresetPreview='1';
      document.addEventListener('click',e=>{
        const btn=e.target.closest?.('button,[data-preset],[data-layout],[data-layout-preset],[data-template]');
        if(!btn)return;
        const preset=presetFromButton(btn);
        if(!preset)return;

        // Keep the page's own export state intact, but always make the live preview
        // reflect the layout the user just picked.
        setPreset(preset);
      },true);
    }

    const active=allPresetButtons().find(btn=>btn.classList.contains('active') || btn.getAttribute('aria-pressed')==='true');
    setPreset(presetFromButton(active)||livePreset||'qr-only');
  }
  function renderPortalQrLock(){if(!isPortal)return;const section=$('#section-qrs');if(!section)return;let b=$('#vmsP4PortalQrEnt');if(!b){b=document.createElement('div');b.id='vmsP4PortalQrEnt';b.className='vms-p4-entitlement-banner';section.querySelector('.intro')?.insertAdjacentElement('afterend',b)}const p=price(dynamicService);b.innerHTML=allowed?'<div><span>QR MODE</span><strong>Dynamic QR Active</strong><small>Tracking and destination management are included.</small></div><span class="vms-status-pill vms-status-green">Active</span>':`<div><span>QR MODE</span><strong>Static QR</strong><small>Dynamic tracking is not included on this account.</small></div><button class="vms-p4-buy" id="vmsP4PortalDynamicInfo" type="button">${dynamicService?`Add Dynamic QR${p?` · ${p}`:''}`:'Dynamic QR Info'}</button>`;$('#vmsP4PortalDynamicInfo')?.addEventListener('click',openLocked);const select=$('#qrEditType');if(select){const dyn=[...select.options].find(o=>/dynamic/i.test(o.textContent));if(dyn)dyn.disabled=!allowed;if(!allowed&&/dynamic/i.test(select.value)){const staticOpt=[...select.options].find(o=>/static/i.test(o.textContent));if(staticOpt)select.value=staticOpt.value}}}
  function observe(){let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{forceBranding();installPresetPreview();installTrackingGuard();if(isAdmin)renderLock();else renderPortalQrLock()},100)}).observe(document.body,{subtree:true,childList:true})}
  async function boot(){installStyle();forceBranding();installPresetPreview();installTrackingGuard();try{await loadCatalog();if(isAdmin)await refreshAdminEntitlement();else await refreshPortalEntitlement()}catch(e){console.warn('VMS QR entitlement check',e);if(isAdmin)renderLock('Dynamic entitlement could not be checked. Static QR remains available.')}observe()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
