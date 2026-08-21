/* VMS Final Polish — Phase 3: Client Portal shell, routing and notification settings */
(()=>{
  'use strict';

  const root=document.documentElement;
  root.classList.add('vms-phase3-portal');

  const STORAGE_KEY='vms_portal_active_section_v1';
  const PREF_LOCAL_KEY='vms_portal_notification_prefs_v1';
  const VALID=new Set(['home','services','qrs','linkhub','audits','projects','files','notifications','requests','billing','contact']);
  const TITLES={
    home:'My VMS Workspace',services:'My Services',qrs:'My QR Codes',linkhub:'My LinkHub',audits:'My Audits',
    projects:'My Projects',files:'My Files',notifications:'Notifications',requests:'My Requests',billing:'Billing & Subscription',contact:'Contact / Schedule'
  };
  let desired='home';
  let holdUntil=0;
  let applying=false;
  let observer=null;

  const toast=(message,kind='success')=>{
    if(window.VMSUI?.toast)return window.VMSUI.toast(message,kind);
    try{window.dispatchEvent(new CustomEvent('vms:toast',{detail:{message,kind}}));}catch{}
  };

  function sectionFromHref(href){
    if(!href)return '';
    let url;
    try{url=new URL(href,location.href);}catch{return ''}
    if(url.origin!==location.origin)return '';
    const hash=(url.hash||'').replace(/^#/,'').toLowerCase();
    if(VALID.has(hash))return hash;
    const p=url.pathname.toLowerCase();
    if(/notification/.test(p))return 'notifications';
    if(/schedul|appointment|contact/.test(p))return 'contact';
    if(/billing|subscription|invoice/.test(p))return 'billing';
    if(/link.?hub/.test(p))return 'linkhub';
    if(/\bqr\b|qr-|qr_/.test(p))return 'qrs';
    if(/audit|report/.test(p))return 'audits';
    if(/project/.test(p))return 'projects';
    if(/file|asset/.test(p))return 'files';
    if(/request/.test(p))return 'requests';
    if(/service/.test(p))return 'services';
    return '';
  }

  function currentActive(){
    const active=document.querySelector('.section.active[id^="section-"]');
    return active?.id?.replace(/^section-/,'')||'';
  }

  function persist(name){
    try{sessionStorage.setItem(STORAGE_KEY,name);}catch{}
  }

  function activate(name,{history='replace',scroll=true,hold=1400}={}){
    name=VALID.has(name)?name:'home';
    const target=document.getElementById('section-'+name);
    if(!target)return false;
    desired=name;
    persist(name);
    holdUntil=performance.now()+Math.max(0,hold);
    applying=true;
    document.querySelectorAll('.section[id^="section-"]').forEach(section=>section.classList.toggle('active',section===target));
    document.querySelectorAll('#nav [data-section]').forEach(button=>button.classList.toggle('active',button.dataset.section===name));
    const title=document.getElementById('topbarTitle');
    if(title)title.textContent=TITLES[name]||'Client Portal';
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('drawerBackdrop')?.classList.remove('show');
    if(location.protocol!=='file:'){
      const next='#'+name;
      try{
        if(history==='push' && location.hash!==next)window.history.pushState({vmsPortalSection:name},'',next);
        else if(history==='replace' && location.hash!==next)window.history.replaceState({vmsPortalSection:name},'',next);
      }catch{}
    }
    if(scroll){
      try{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}catch{window.scrollTo(0,0)}
    }
    queueMicrotask(()=>{applying=false});
    return true;
  }

  function requestedSection(){
    const hash=(location.hash||'').replace(/^#/,'').toLowerCase();
    if(VALID.has(hash))return hash;
    try{
      const saved=sessionStorage.getItem(STORAGE_KEY);
      if(VALID.has(saved))return saved;
    }catch{}
    return 'home';
  }

  function bindStableNavigation(){
    if(root.dataset.vmsPhase3NavBound==='1')return;
    root.dataset.vmsPhase3NavBound='1';

    window.addEventListener('click',event=>{
      const button=event.target?.closest?.('#nav [data-section], [data-section-jump]');
      if(button){
        const name=button.dataset.section||button.dataset.sectionJump;
        if(VALID.has(name)){
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          activate(name,{history:'push'});
          return;
        }
      }

      const anchor=event.target?.closest?.('a[href]');
      if(!anchor)return;
      const inPortalShell=anchor.closest('#nav, #sidebar, aside.sidebar, aside.side, .sidebar, .side') || /\/portal\//i.test(anchor.getAttribute('href')||'');
      if(!inPortalShell)return;
      const name=sectionFromHref(anchor.getAttribute('href'));
      if(!name)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      activate(name,{history:'push'});
    },true);

    window.addEventListener('popstate',()=>activate(requestedSection(),{history:'none',scroll:false,hold:500}));
    window.addEventListener('hashchange',()=>activate(requestedSection(),{history:'none',scroll:false,hold:500}));

    observer=new MutationObserver(()=>{
      if(applying)return;
      const active=currentActive();
      if(active && active!=='home' && VALID.has(active)){
        desired=active;
        persist(active);
        if(location.protocol!=='file:' && location.hash!=='#'+active){
          try{window.history.replaceState({vmsPortalSection:active},'','#'+active);}catch{}
        }
        return;
      }
      if(active==='home' && desired!=='home' && performance.now()<holdUntil){
        requestAnimationFrame(()=>activate(desired,{history:'replace',scroll:false,hold:700}));
      }
    });
    document.querySelectorAll('.section[id^="section-"]').forEach(section=>observer.observe(section,{attributes:true,attributeFilter:['class']}));
  }

  function switchMarkup({id,label,copy,checked=true,disabled=false,required=false}){
    return `<div class="vms-portal-pref-row${disabled?' is-required':''}">
      <div class="vms-portal-pref-copy"><strong>${label}</strong><span>${copy}</span></div>
      <div class="vms-portal-pref-control">
        ${required?'<span class="vms-required-pill">Required</span>':''}
        <label class="vms-portal-switch" aria-label="${label}">
          <input id="${id}" type="checkbox" ${checked?'checked':''} ${disabled?'disabled':''}>
          <span aria-hidden="true"></span>
        </label>
      </div>
    </div>`;
  }

  function buildNotificationSettings(){
    const section=document.getElementById('section-notifications');
    if(!section || document.getElementById('vmsPortalNotificationSettingsPanel'))return;
    const toolbar=section.querySelector('.notification-toolbar');
    if(!toolbar)return;

    const button=document.createElement('button');
    button.type='button';
    button.className='btn small vms-notification-settings-btn';
    button.id='vmsPortalNotificationSettingsBtn';
    button.textContent='Notification Settings';
    toolbar.appendChild(button);

    const panel=document.createElement('section');
    panel.id='vmsPortalNotificationSettingsPanel';
    panel.className='vms-portal-settings-panel';
    panel.hidden=true;
    panel.innerHTML=`
      <div class="vms-portal-settings-head">
        <div><small>NOTIFICATION SETTINGS</small><h3>Choose your optional updates</h3><p>Important account, billing, security and scheduling messages always stay on so you do not miss something that affects your service.</p></div>
        <button class="btn small" id="vmsCloseNotificationSettings" type="button">Done</button>
      </div>
      <div class="vms-portal-pref-group">
        <div class="vms-portal-pref-label">Required account messages</div>
        ${switchMarkup({id:'vmsPrefBilling',label:'Billing & subscription',copy:'Payments, renewals, failed payments and cancellation confirmations.',disabled:true,required:true})}
        ${switchMarkup({id:'vmsPrefScheduling',label:'Scheduling',copy:'Appointment confirmations, reschedules and cancellations.',disabled:true,required:true})}
        ${switchMarkup({id:'vmsPrefSecurity',label:'Portal & security',copy:'Secure sign-in links and important account access messages.',disabled:true,required:true})}
        ${switchMarkup({id:'vmsPrefOnboarding',label:'Account onboarding',copy:'Portal invitations and essential service-start information.',disabled:true,required:true})}
      </div>
      <div class="vms-portal-pref-group">
        <div class="vms-portal-pref-label">Optional updates</div>
        ${switchMarkup({id:'vmsPrefProject',label:'Project updates',copy:'Progress and status updates for work VMS is completing for you.'})}
        ${switchMarkup({id:'vmsPrefFiles',label:'File requests',copy:'Requests and reminders for files or assets VMS needs from you.'})}
        ${switchMarkup({id:'vmsPrefClient',label:'General VMS updates',copy:'Helpful client updates that are not required account notices.'})}
      </div>
      <div class="vms-portal-settings-status" id="vmsPortalSettingsStatus">Loading your preferences…</div>`;
    toolbar.insertAdjacentElement('afterend',panel);

    const setOpen=open=>{
      panel.hidden=!open;
      button.setAttribute('aria-expanded',String(open));
      if(open){panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});loadNotificationPrefs();}
    };
    button.setAttribute('aria-expanded','false');
    button.addEventListener('click',()=>setOpen(panel.hidden));
    panel.querySelector('#vmsCloseNotificationSettings')?.addEventListener('click',()=>setOpen(false));
    ['vmsPrefProject','vmsPrefFiles','vmsPrefClient'].forEach(id=>panel.querySelector('#'+id)?.addEventListener('change',saveNotificationPrefs));
  }

  function localPrefs(){
    try{return {...{project:true,files:true,client:true},...JSON.parse(localStorage.getItem(PREF_LOCAL_KEY)||'{}')}}catch{return {project:true,files:true,client:true}}
  }

  function paintPrefs(prefs){
    const map={vmsPrefProject:'project',vmsPrefFiles:'files',vmsPrefClient:'client'};
    for(const [id,key] of Object.entries(map)){
      const el=document.getElementById(id);
      if(el)el.checked=prefs?.[key]!==false;
    }
  }

  async function portalClientContext(){
    if(!window.VMSAuth?.client)return null;
    const sb=await window.VMSAuth.client();
    if(!sb)return null;
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user)return null;
    const {data:clientRow,error}=await sb.from('clients').select('id').limit(1).maybeSingle();
    if(error)throw error;
    if(!clientRow?.id)return null;
    return {sb,clientId:clientRow.id};
  }

  async function loadNotificationPrefs(){
    const status=document.getElementById('vmsPortalSettingsStatus');
    try{
      if(location.protocol==='file:'){
        paintPrefs(localPrefs());
        if(status)status.textContent='Saved on this preview device.';
        return;
      }
      const ctx=await portalClientContext();
      if(!ctx){paintPrefs(localPrefs());if(status)status.textContent='Preferences will sync after your portal session is verified.';return}
      const {data,error}=await ctx.sb.from('notification_preferences').select('project,files,client,billing,scheduling,onboarding,email_enabled,in_app_enabled').eq('client_id',ctx.clientId).maybeSingle();
      if(error)throw error;
      const prefs=data||{project:true,files:true,client:true};
      paintPrefs(prefs);
      if(!data || data.billing!==true || data.scheduling!==true || data.onboarding!==true || data.email_enabled!==true || data.in_app_enabled!==true){
        const normalized={
          client_id:ctx.clientId,
          email_enabled:true,in_app_enabled:true,billing:true,scheduling:true,onboarding:true,
          project:prefs.project!==false,files:prefs.files!==false,client:prefs.client!==false,
          updated_at:new Date().toISOString()
        };
        const {error:normalizeError}=await ctx.sb.from('notification_preferences').upsert(normalized,{onConflict:'client_id'});
        if(normalizeError)throw normalizeError;
      }
      if(status)status.textContent='Preferences synced with your VMS account.';
    }catch(error){
      console.error('VMS notification preference load failed',error);
      paintPrefs(localPrefs());
      if(status)status.textContent='Could not sync right now. Your current choices are still shown.';
    }
  }

  async function saveNotificationPrefs(){
    const prefs={
      project:document.getElementById('vmsPrefProject')?.checked!==false,
      files:document.getElementById('vmsPrefFiles')?.checked!==false,
      client:document.getElementById('vmsPrefClient')?.checked!==false
    };
    try{localStorage.setItem(PREF_LOCAL_KEY,JSON.stringify(prefs));}catch{}
    const status=document.getElementById('vmsPortalSettingsStatus');
    if(status)status.textContent='Saving…';
    try{
      if(location.protocol!=='file:'){
        const ctx=await portalClientContext();
        if(ctx){
          const record={
            client_id:ctx.clientId,
            email_enabled:true,in_app_enabled:true,
            billing:true,scheduling:true,onboarding:true,
            project:prefs.project,files:prefs.files,client:prefs.client,
            updated_at:new Date().toISOString()
          };
          const {error}=await ctx.sb.from('notification_preferences').upsert(record,{onConflict:'client_id'});
          if(error)throw error;
        }
      }
      if(status)status.textContent='Saved. Required account messages remain enabled.';
      toast('Notification settings saved');
    }catch(error){
      console.error('VMS notification preference save failed',error);
      if(status)status.textContent='Could not sync these settings. Please try again.';
      toast('Could not save notification settings','error');
    }
  }

  function bootIndex(){
    bindStableNavigation();
    buildNotificationSettings();
    const initial=requestedSection();
    activate(initial,{history:'replace',scroll:false,hold:2800});
    setTimeout(()=>{if(desired!=='home'&&currentActive()==='home')activate(desired,{history:'replace',scroll:false,hold:1200});},120);
    setTimeout(()=>{if(desired!=='home'&&currentActive()==='home')activate(desired,{history:'replace',scroll:false,hold:800});},650);
    setTimeout(()=>loadNotificationPrefs(),900);
  }

  function earlyStandaloneRedirect(){
    const p=(location.pathname||'').toLowerCase();
    if(/\/portal\/?(?:index\.html)?$/.test(p)||/\/portal\/$/.test(p))return false;
    const name=sectionFromHref(location.href);
    if(!name)return false;
    location.replace('/portal/#'+name);
    return true;
  }

  if(earlyStandaloneRedirect())return;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootIndex,{once:true});
  else bootIndex();
})();
