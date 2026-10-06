// Public browser configuration. Safe to expose: project URL + publishable key only.
window.VMS_CONFIG = {
  supabaseUrl: 'https://ncfynulcljtdafbuvzeb.supabase.co',
  supabaseAnonKey: 'sb_publishable_mlH8b3vONTCm-PcGQdPKKw_s0xeXxZp'
};

/*
  VMS Admin trusted-tab visual gate
  ---------------------------------
  Every Admin page still runs the real Supabase session, role, and MFA checks.
  Once this browser tab has successfully verified Admin access, we suppress
  the full-screen privacy splash for a short period so normal Admin navigation
  feels continuous instead of flashing "Verifying..." between pages.

  This is only a visual fast-path. Invalid/expired sessions are still rejected
  by VMSAuth.requireSession().
*/
(()=>{
  if(location.protocol==='file:' || !location.pathname.startsWith('/admin/'))return;
  if(/\/admin\/login(?:\.html)?\/?$/i.test(location.pathname))return;

  const KEY='vms_admin_visual_trust_until';

  try{
    const until=Number(sessionStorage.getItem(KEY)||0);
    if(until>Date.now()){
      document.documentElement.classList.remove('vms-auth-pending');
    }else{
      sessionStorage.removeItem(KEY);
    }
  }catch{}
})();

/* LinkHub live publishing/share/social-icon layer. */
/* VMS LinkHub Live · publish/share/social-icons layer · 2026-08-19 */
(()=>{
  if(!location.pathname.toLowerCase().startsWith('/portal'))return;
  if(document.documentElement.dataset.vmsShell==='portal-v2')return; /* Client Portal v2 (assets/vms-portal.js) owns this page. */

  const API='/api/linkhub';
  const PORTAL_STORAGE='vms_client_portal_v4';
  const DIRTY_KEY='vms_linkhub_dirty_v1';
  const CLOUD_VERSION_KEY='vms_linkhub_cloud_version_v1';
  const RELOAD_GUARD='vms_linkhub_cloud_reload_v1';
  let linkhubInfo=null;
  let qrLibPromise=null;
  let lastPublishError='';

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function iconSvg(platform){
    const p=String(platform||'').trim().toLowerCase();
    const common='viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    const icons={
      instagram:`<svg ${common}><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.6" r="1.2" fill="currentColor"/></svg>`,
      facebook:`<svg ${common}><path fill="currentColor" d="M13.8 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.6 1.7-1.6H17V3.8c-.4-.1-1.3-.2-2.4-.2-2.4 0-4 1.5-4 4.2V10H8v3h2.6v8h3.2z"/></svg>`,
      whatsapp:`<svg ${common}><path d="M20 11.7a8 8 0 0 1-11.8 7l-4 .9 1-3.9A8 8 0 1 1 20 11.7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.1 7.8c.3-.4.6-.3.9-.1l1.1 1.4c.2.3.2.5 0 .8l-.6.8c.8 1.6 1.8 2.6 3.5 3.4l.8-.7c.3-.2.5-.2.8 0l1.3 1c.3.2.4.5.2.8-.5.9-1.4 1.5-2.4 1.4-3.3-.4-7-4-7.3-7.4-.1-.5.4-1.1.7-1.4Z" fill="currentColor"/></svg>`,
      tiktok:`<svg ${common}><path d="M14.2 3v11.3a4.3 4.3 0 1 1-3.3-4.2v2.7a1.8 1.8 0 1 0 .8 1.5V3h2.5Zm0 0c.6 2.4 2.1 3.8 4.5 4.1v2.6c-2-.1-3.5-.8-4.5-1.8V3Z" fill="currentColor"/></svg>`,
      youtube:`<svg ${common}><rect x="2.8" y="6" width="18.4" height="12" rx="4" fill="currentColor"/><path d="m10 9 6 3-6 3V9Z" fill="white"/></svg>`,
      x:`<svg ${common} fill="currentColor"><path d="M18.6 3H22l-7.4 8.5L23.3 21h-6.8l-5.3-7-6.1 7H1.7l7.9-9.1L1.3 3h7l4.8 6.4L18.6 3zm-1.2 16.3h1.9L7.3 4.6H5.2l12.2 14.7z"/></svg>`,
      linkedin:`<svg ${common}><rect x="4" y="9" width="3.3" height="10" rx=".6" fill="currentColor"/><circle cx="5.65" cy="5.7" r="1.8" fill="currentColor"/><path d="M10 9h3.2v1.4c.8-1.1 1.9-1.7 3.4-1.7 2.8 0 3.9 1.8 3.9 5V19h-3.3v-4.7c0-1.7-.4-2.8-1.9-2.8-1.7 0-2.1 1.3-2.1 3V19H10V9Z" fill="currentColor"/></svg>`,
      email:`<svg ${common}><rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
      phone:`<svg ${common}><path d="M6.2 3.8 9 3l2 4.6-1.8 1.3c1.1 2.4 2.6 3.9 5 5l1.3-1.8 4.6 2-.8 2.8c-.3 1.1-1.3 1.8-2.4 1.7-6.5-.8-11.8-6-12.5-12.5-.1-1.1.7-2.1 1.8-2.3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
      website:`<svg ${common}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 12h17M12 3c2.2 2.3 3.2 5.3 3.2 9S14.2 18.7 12 21M12 3c-2.2 2.3-3.2 5.3-3.2 9S9.8 18.7 12 21" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`
    };
    return icons[p]||icons.website;
  }

  function platformFromRow(row){
    const text=row?.querySelector('.link-editor-copy span')?.textContent||'';
    return text.split('·')[0].trim();
  }

  function restoreSocialIcons(){
    const rows=[...document.querySelectorAll('#linkHubSocialList .social-row')];
    rows.forEach(row=>{
      const icon=row.querySelector('.social-admin-icon');
      if(!icon)return;
      const platform=platformFromRow(row)||'Website';
      const key=String(platform).trim().toLowerCase();
      if(icon.dataset.vmsSocialIcon!==key || !icon.querySelector('svg')){
        icon.innerHTML=iconSvg(platform);
        icon.dataset.vmsSocialIcon=key;
      }
      icon.setAttribute('aria-label',platform||'Social');
    });
    const preview=[...document.querySelectorAll('#section-linkhub .linkhub-public-social')];
    preview.forEach((button,i)=>{
      const platform=platformFromRow(rows[i])||button.title||'Website';
      const key=String(platform).trim().toLowerCase();
      if(button.dataset.vmsSocialIcon!==key || !button.querySelector('svg')){
        button.innerHTML=iconSvg(platform);
        button.dataset.vmsSocialIcon=key;
      }
      button.setAttribute('aria-label',button.title||platform);
    });
  }

  function installStyles(){
    if($('vmsLinkHubLiveStyles'))return;
    const style=document.createElement('style');
    style.id='vmsLinkHubLiveStyles';
    style.textContent=`
      .social-admin-icon svg,.linkhub-public-social svg{width:18px;height:18px;display:block}
      .social-admin-icon{display:grid!important;place-items:center!important;width:30px!important;height:30px!important;border-radius:9px!important}
      .linkhub-public-social{display:grid!important;place-items:center!important}
      .vms-linkhub-share{margin:0 0 12px;background:#fff;border:1px solid #dfe8ec;border-radius:14px;padding:14px;box-shadow:0 5px 18px rgba(0,48,73,.035)}
      .vms-linkhub-share-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
      .vms-linkhub-share-head strong{display:block;color:#003049;font-size:12px}.vms-linkhub-share-head span{display:block;color:#7b8d97;font-size:8px;margin-top:3px;line-height:1.45}
      .vms-linkhub-pubstatus{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 9px;background:#fff5e8;color:#a9651d;font-size:7px;font-weight:950;white-space:nowrap}
      .vms-linkhub-pubstatus.live{background:#edf7f3;color:#2b8c69}.vms-linkhub-pubstatus.error{background:#fbeff0;color:#b13a43}
      .vms-linkhub-share-grid{display:grid;grid-template-columns:minmax(0,1fr) 132px;gap:14px;align-items:stretch}
      .vms-linkhub-urlbox{display:grid;gap:7px}.vms-linkhub-urlbox label{font-size:7px;color:#78909b;font-weight:950}.vms-linkhub-urlrow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px}
      .vms-linkhub-urlrow input{width:100%;min-width:0;height:42px;border:1px solid #d8e3e7;border-radius:9px;padding:0 10px;background:#f8fafb;color:#173443;font-size:9px}
      .vms-linkhub-share-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:3px}.vms-linkhub-share .btn{min-height:40px}
      #vmsLinkHubPublishBtn{background:#003049;color:#fff;border-color:#003049}
      .vms-linkhub-qr{display:grid;place-items:center;background:#fff;border:1px solid #e1e9ec;border-radius:12px;padding:8px;min-height:132px}.vms-linkhub-qr svg{width:112px!important;height:112px!important;display:block}
      .vms-linkhub-qr small{color:#8b9ca4;font-size:7px;text-align:center;line-height:1.35}
      .vms-linkhub-activity{grid-column:1/-1;border-top:1px solid #edf2f4;padding-top:11px}.vms-linkhub-activity-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.vms-linkhub-activity-head strong{font-size:10px;color:#003049}.vms-linkhub-activity-head span{font-size:7px;color:#80939c}.vms-linkhub-activity-list{display:grid;gap:6px}.vms-linkhub-activity-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 8px;border:1px solid #edf2f4;border-radius:9px;background:#fbfcfd}.vms-linkhub-activity-icon{width:28px;height:28px;border-radius:8px;background:#edf5f8;color:#003049;display:grid;place-items:center;font-size:7px;font-weight:950}.vms-linkhub-activity-row strong{font-size:8px;color:#183746;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vms-linkhub-activity-row small{font-size:7px;color:#84969f;white-space:nowrap}.vms-linkhub-activity-empty{padding:10px;border:1px dashed #d6e1e5;border-radius:9px;color:#78909b;font-size:8px;text-align:center}
      @media(max-width:760px){
        .vms-linkhub-share{padding:12px}.vms-linkhub-share-head{display:grid}.vms-linkhub-share-grid{grid-template-columns:1fr}.vms-linkhub-urlrow{grid-template-columns:1fr 1fr}.vms-linkhub-urlrow input{grid-column:1/-1;height:46px;font-size:10px}.vms-linkhub-urlrow .btn{width:100%}.vms-linkhub-share-actions{display:grid;grid-template-columns:1fr}.vms-linkhub-share-actions .btn{width:100%;min-height:46px}.vms-linkhub-qr{min-height:160px}.vms-linkhub-qr svg{width:142px!important;height:142px!important}
      }
    `;
    document.head.appendChild(style);
  }

  async function getSessionToken(){
    for(let i=0;i<30;i++){
      try{
        if(window.VMSAuth?.client){
          const sb=await window.VMSAuth.client();
          const {data:{session}}=await sb.auth.getSession();
          if(session?.access_token)return session.access_token;
        }
      }catch{}
      await new Promise(r=>setTimeout(r,120));
    }
    return '';
  }

  async function authApi(method='GET',body=null){
    const token=await getSessionToken();
    if(!token)throw new Error('Client Portal session is not ready. Please refresh and sign in again.');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const res=await fetch(API+(method==='GET'?'?mine=1':''),{
        method,
        headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
        body:body?JSON.stringify(body):undefined,
        signal:controller.signal
      });
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(json.error||`LinkHub request failed (${res.status}).`);
      return json;
    }catch(e){
      if(e?.name==='AbortError')throw new Error('Publishing timed out. Please try again.');
      throw e;
    }finally{clearTimeout(timeout)}
  }

  function setStatus(text,type=''){
    const el=$('vmsLinkHubPublishStatus');
    if(!el)return;
    el.textContent=text;
    el.className='vms-linkhub-pubstatus'+(type?' '+type:'');
  }

  function updateSharePanel(info){
    linkhubInfo=info||linkhubInfo||{};
    const input=$('vmsLinkHubPublicUrl');
    if(input)input.value=linkhubInfo.url||'';
    const published=linkhubInfo.status==='published';
    if(lastPublishError)setStatus(lastPublishError,'error');
    else if(published)setStatus('Published','live');
    else setStatus('Not published yet');
    const analytics=linkhubInfo.analytics||{views:0,clicks:0,recent:[]};
    for(const key of [PORTAL_STORAGE,'vms_client_portal_v3']){
      try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.linkHub){saved.linkHub.views=Number(analytics.views||0);saved.linkHub.clicks=Number(analytics.clicks||0);localStorage.setItem(key,JSON.stringify(saved))}}catch{}
    }
    const views=$('linkHubViews'),clicks=$('linkHubClicks');
    if(views)views.textContent=Number(analytics.views||0).toLocaleString();
    if(clicks)clicks.textContent=Number(analytics.clicks||0).toLocaleString();
    const list=$('vmsLinkHubActivityList');
    if(list){
      const recent=Array.isArray(analytics.recent)?analytics.recent:[];
      list.innerHTML=recent.length?recent.slice(0,12).map(event=>{const view=event.type==='view';const when=event.at?new Date(event.at):null;const stamp=when&&!Number.isNaN(when.getTime())?when.toLocaleDateString([], {month:'short',day:'numeric'})+', '+when.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'';const icon=view?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9l11 4-5 2-2 5z"/><path d="M5 3v3M3 5h3M5.6 8.4L4 10M8.4 5.6L10 4"/></svg>';return `<div class="vms-lh-act-row"><span class="vms-lh-act-ico ${view?'is-view':'is-click'}">${icon}</span><span class="vms-lh-act-copy"><b>${esc(event.label||(view?'LinkHub viewed':'Button tapped'))}</b><small>${view?'Page view':'Button tap'}</small></span><time>${esc(stamp)}</time></div>`}).join(''):'<div class="vms-linkhub-activity-empty">No real LinkHub activity yet. New public views and clicks will appear here.</div>';
    }
    renderQr(linkhubInfo.url||'');
  }

  function loadQrLib(){
    if(window.qrcode)return Promise.resolve(window.qrcode);
    if(qrLibPromise)return qrLibPromise;
    qrLibPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-vms-linkhub-qr-lib="1"]');
      if(existing){existing.addEventListener('load',()=>resolve(window.qrcode),{once:true});existing.addEventListener('error',reject,{once:true});return}
      const s=document.createElement('script');
      s.src='https://unpkg.com/qrcode-generator@2.0.4/dist/qrcode.js';
      s.dataset.vmsLinkhubQrLib='1';
      s.onload=()=>resolve(window.qrcode);
      s.onerror=()=>reject(new Error('QR library could not load.'));
      document.head.appendChild(s);
    });
    return qrLibPromise;
  }

  async function renderQr(url){
    const box=$('vmsLinkHubQr');
    if(!box)return;
    if(!url){box.innerHTML='<small>Your QR code appears after your LinkHub URL is ready.</small>';return}
    box.innerHTML='<small>Generating QR…</small>';
    try{
      await loadQrLib();
      if(typeof window.qrcode!=='function')throw new Error('QR unavailable');
      const qr=window.qrcode(0,'M');
      qr.addData(url);qr.make();
      box.innerHTML=qr.createSvgTag({cellSize:4,margin:10,scalable:true});
      box.dataset.url=url;
    }catch(e){
      console.warn('VMS LinkHub QR generation failed',e);
      box.innerHTML='<small>QR unavailable right now. The share link still works.</small>';
    }
  }

  function createSharePanel(){
    if($('vmsLinkHubSharePanel'))return;
    const section=$('section-linkhub');
    if(!section)return;
    const host=$('linkHubPublishPanelHost');
    const panel=document.createElement('div');
    panel.className='vms-linkhub-share';
    panel.id='vmsLinkHubSharePanel';
    panel.innerHTML=`
      <div class="vms-linkhub-share-head">
        <div><strong>Your Public LinkHub</strong><span>This is the permanent link customers can open or scan. Edits stay private until you publish them.</span></div>
        <div class="vms-linkhub-pubstatus" id="vmsLinkHubPublishStatus">Checking…</div>
      </div>
      <div class="vms-linkhub-share-grid">
        <div class="vms-linkhub-urlbox">
          <label>PUBLIC LINKHUB URL</label>
          <div class="vms-linkhub-urlrow">
            <input id="vmsLinkHubPublicUrl" type="text" readonly value="">
            <button class="btn" id="vmsLinkHubCopyBtn" type="button">Copy Link</button>
            <button class="btn" id="vmsLinkHubOpenBtn" type="button">Open</button>
          </div>
          <div class="vms-linkhub-share-actions">
            <button class="btn primary" id="vmsLinkHubPublishBtn" type="button">Publish Changes</button>
            <button class="btn" id="vmsLinkHubDownloadQrBtn" type="button">Download QR</button>
          </div>
        </div>
        <div class="vms-linkhub-qr" id="vmsLinkHubQr"><small>Loading your LinkHub…</small></div>
        <div class="vms-linkhub-activity"><div class="vms-linkhub-activity-head"><strong>Real LinkHub Activity</strong><span>Public views and clicks only</span></div><div class="vms-linkhub-activity-list" id="vmsLinkHubActivityList"><div class="vms-linkhub-activity-empty">Loading real activity…</div></div></div>
      </div>`;
    if(host)host.appendChild(panel);else section.appendChild(panel);

    $('vmsLinkHubCopyBtn').onclick=async()=>{
      const url=$('vmsLinkHubPublicUrl').value;
      if(!url)return;
      try{await navigator.clipboard.writeText(url);setStatus('Link copied','live')}catch{prompt('Copy your LinkHub link:',url)}
    };
    $('vmsLinkHubOpenBtn').onclick=()=>{const url=$('vmsLinkHubPublicUrl').value;if(url)window.open(url,'_blank','noopener')};
    $('vmsLinkHubPublishBtn').onclick=()=>publishCurrentLinkHub(true);
    $('vmsLinkHubDownloadQrBtn').onclick=downloadQr;

    const native=$('saveLinkHubBtn');
    if(native){
      native.textContent='Publish Changes';
      native.addEventListener('click',()=>setTimeout(()=>{
        // Phase 4 owns the Portal publish flow when it is available. Do not run
        // this older API publisher a second time after the same click.
        if(typeof window.VMSLinkHubCloud?.publishPortal==='function')return;
        publishCurrentLinkHub(false);
      },0));
    }
  }

  function setPublishControlsBusy(busy){
    ['vmsLinkHubPublishBtn','saveLinkHubBtn'].forEach(id=>{
      const button=$(id);if(button)button.disabled=!!busy;
    });
    const main=$('vmsLinkHubPublishBtn');
    if(main)main.textContent=busy?'Publishing…':'Publish Changes';
  }

  function readCurrentLinkHub(){
    for(const key of [PORTAL_STORAGE,'vms_client_portal_v3']){
      try{
        const state=JSON.parse(localStorage.getItem(key)||'null');
        if(state?.linkHub&&typeof state.linkHub==='object')return state.linkHub;
      }catch{}
    }
    return null;
  }

  async function publishCurrentLinkHub(runNativeSave){
    if(window.__VMS_LINKHUB_PUBLISHING__)return;
    window.__VMS_LINKHUB_PUBLISHING__=true;
    lastPublishError='';
    setPublishControlsBusy(true);
    try{
      if(runNativeSave){
        const native=$('saveLinkHubBtn');
        if(!native||typeof native.onclick!=='function')throw new Error('LinkHub save control is unavailable. Refresh the Portal and try again.');
        // Run the Portal's existing synchronous save routine directly. This updates
        // localStorage with the latest form values without depending on a second event.
        const nativeResult=native.onclick.call(native,new Event('click'));
        if(typeof window.VMSLinkHubCloud?.publishPortal==='function'){
          await nativeResult;
          lastPublishError='';
          setStatus('Published','live');
          return;
        }
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const data=readCurrentLinkHub();
      if(!data)throw new Error('Could not read your current LinkHub changes.');
      if(!String(data.businessName||'').trim())throw new Error('Add your business or display name before publishing.');
      setStatus('Publishing…');
      const result=await authApi('POST',{action:'publish',data});
      lastPublishError='';
      linkhubInfo=result;
      try{
        localStorage.removeItem(DIRTY_KEY);
        localStorage.setItem(CLOUD_VERSION_KEY,result.publishedAt||'');
      }catch{}
      updateSharePanel(result);
    }catch(e){
      lastPublishError=e?.message||'Publishing failed. Please try again.';
      console.error('VMS LinkHub direct publish failed',e);
      setStatus(lastPublishError,'error');
    }finally{
      setPublishControlsBusy(false);
      window.__VMS_LINKHUB_PUBLISHING__=false;
    }
  }

  async function downloadQr(){
    const url=$('vmsLinkHubPublicUrl')?.value||'';
    if(!url)return;
    try{
      await loadQrLib();
      const qr=window.qrcode(0,'M');qr.addData(url);qr.make();
      const dataUrl=qr.createDataURL(8,32);
      const a=document.createElement('a');a.href=dataUrl;a.download='VMS-LinkHub-QR.png';document.body.appendChild(a);a.click();a.remove();
    }catch(e){setStatus('QR download unavailable','error')}
  }

  function markDirty(){
    try{localStorage.setItem(DIRTY_KEY,'1')}catch{}
    if(linkhubInfo?.status==='published')setStatus('Unpublished changes');
  }

  function installDirtyTracking(){
    const section=$('section-linkhub');
    if(!section||section.dataset.vmsDirtyTracking)return;
    section.dataset.vmsDirtyTracking='1';
    section.addEventListener('input',e=>{if(!e.target.closest('#vmsLinkHubSharePanel'))markDirty()},true);
    section.addEventListener('change',e=>{if(!e.target.closest('#vmsLinkHubSharePanel'))markDirty()},true);
    section.addEventListener('click',e=>{
      if(e.target.closest('#vmsLinkHubSharePanel,#saveLinkHubBtn,#requestLinkHubHelpBtn'))return;
      if(e.target.closest('button'))markDirty();
    },true);
  }


  function hydratePublishedIfNeeded(info){
    if(!info?.publishedData||!info?.publishedAt)return false;
    try{
      if(localStorage.getItem(DIRTY_KEY)==='1')return false;
      const known=localStorage.getItem(CLOUD_VERSION_KEY)||'';
      if(known===info.publishedAt)return false;
      const raw=localStorage.getItem(PORTAL_STORAGE);
      if(!raw)return false;
      const state=JSON.parse(raw);
      if(!state||typeof state!=='object')return false;
      state.linkHub={...info.publishedData};
      localStorage.setItem(PORTAL_STORAGE,JSON.stringify(state));
      localStorage.setItem(CLOUD_VERSION_KEY,info.publishedAt);
      if(sessionStorage.getItem(RELOAD_GUARD)!==info.publishedAt){
        sessionStorage.setItem(RELOAD_GUARD,info.publishedAt);
        location.reload();
        return true;
      }
    }catch(e){console.warn('VMS LinkHub published-state hydration skipped',e)}
    return false;
  }

  async function loadInfo(){
    try{
      const info=await authApi('GET');
      if(hydratePublishedIfNeeded(info))return;
      updateSharePanel(info);
    }catch(e){
      lastPublishError=e?.message||'Could not load public LinkHub';
      setStatus(lastPublishError,'error');
    }
  }

  function boot(){
    installStyles();
    createSharePanel();
    installDirtyTracking();
    restoreSocialIcons();
    let iconRefreshQueued=false;
    const observer=new MutationObserver(()=>{
      if(iconRefreshQueued)return;
      iconRefreshQueued=true;
      requestAnimationFrame(()=>{
        iconRefreshQueued=false;
        restoreSocialIcons();
      });
    });
    const socialList=$('linkHubSocialList');
    const previewScreen=$('linkHubPreviewScreen');
    if(socialList)observer.observe(socialList,{childList:true,subtree:true});
    if(previewScreen)observer.observe(previewScreen,{childList:true,subtree:true});
    loadInfo();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});
  else setTimeout(boot,0);
})();


/* VMS Client Portal production cleanup + live panels. */
(()=>{
  const path=String(location.pathname||'').toLowerCase();
  if(!(path==='/portal'||path==='/portal/'||path.startsWith('/portal/')))return;
  if(document.documentElement.dataset.vmsShell==='portal-v2')return; /* Client Portal v2 (assets/vms-portal.js) owns this page. */

  const PORTAL_KEY='vms_client_portal_v4';
  const TEST_EMAIL='info@visionmakestudio.com';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lower=value=>String(value||'').trim().toLowerCase();
  const titleStatus=value=>String(value||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const activeService=row=>{
    const service=lower(row?.service_status),billing=lower(row?.billing_status);
    return ['active','completed'].includes(service)&&!['pending','unpaid','past_due','past due','paused','suspended','canceled','cancelled'].includes(billing);
  };
  let liveContext=null;
  let cleanupRunning=false;

  /* A service is recurring only when its catalog pricing model is Recurring.
     (Without a catalog row, fall back to a real monthly/yearly cadence - never "one-time".) */
  function isRecurring(row,cat){
    const model=String(cat?.pricing_model||'').trim().toLowerCase();
    if(model)return model==='recurring';
    return /^(month|year|annual|week|quarter)/i.test(String(row?.billing_cadence||'').trim());
  }
  function portalState(){
    try{return JSON.parse(localStorage.getItem(PORTAL_KEY)||'null')}catch{return null}
  }

  function scrubLegacyTestDefaults(email){
    if(!email||lower(email)===TEST_EMAIL)return false;
    const state=portalState();
    if(!state||typeof state!=='object')return false;
    let changed=false;
    const set=(obj,key,value)=>{if(obj&&obj[key]!==value){obj[key]=value;changed=true}};
    const h=state.linkHub||{};
    if(h.businessName==='VMS Test Client')set(h,'businessName','');
    if(h.title==='Vision Make Studio Test Client')set(h,'title','');
    if(/test account/i.test(String(h.bio||'')))set(h,'bio','');
    if(lower(h.email)===TEST_EMAIL)set(h,'email','');
    if(h.restaurant?.name==='VMS Test Client')set(h.restaurant,'name','');
    if(h.visit?.name==='VMS Test Client')set(h.visit,'name','');
    if(lower(h.visit?.email)===TEST_EMAIL)set(h.visit,'email','');
    if(state.qr?.name==='VMS Test QR'){
      set(state.qr,'name','My VMS QR');
      set(state.qr,'destination','');
      set(state.qr,'cta','Scan to connect');
      set(state.qr,'updated','Not configured');
    }
    if(state.subscription?.planName==='VMS LinkHub Pro'&&Number(state.subscription?.price)===14.99){
      set(state.subscription,'planName','');
      set(state.subscription,'planId','');
      set(state.subscription,'price',0);
      set(state.subscription,'status','');
      set(state.subscription,'paused',false);
      set(state.subscription,'cancelAtPeriodEnd',false);
    }
    if(changed)localStorage.setItem(PORTAL_KEY,JSON.stringify(state));
    return changed;
  }

  function replaceLegacyProjectPanels(){
    const projectSection=$('section-projects');
    if(projectSection){
      const card=projectSection.querySelector('.card');
      if(card&&(/website revamp|homepage photos|started aug/i.test(card.textContent||''))){
        card.innerHTML='<div class="empty">No live project timeline has been shared with your portal yet. When VMS publishes a project update, it will appear here.</div>';
      }
    }
    const home=$('section-home');
    if(home){
      [...home.querySelectorAll('.card,.next-step')].forEach(card=>{
        if(/website revamp|homepage photos|design & content/i.test(card.textContent||'')){
          card.innerHTML='<div class="empty">No active project update has been shared yet.</div>';
        }
      });
    }
  }

  function scoreValue(scores){
    if(scores==null)return null;
    if(typeof scores==='number')return scores;
    if(typeof scores!=='object')return null;
    const preferred=['overall','overall_score','score','total'];
    for(const key of preferred){const n=Number(scores[key]);if(Number.isFinite(n))return n}
    const nums=Object.values(scores).map(Number).filter(Number.isFinite);
    return nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length):null;
  }

  function ensureLiveAuditModal(){
    let modal=$('vmsLiveAuditModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.className='modal-backdrop';modal.id='vmsLiveAuditModal';
    modal.innerHTML='<div class="modal"><div class="modal-head"><h3 id="vmsLiveAuditTitle">VMS Audit</h3><button class="close" id="vmsLiveAuditClose" type="button">×</button></div><div class="modal-body" id="vmsLiveAuditBody"></div><div class="modal-foot"><button class="btn" id="vmsLiveAuditClose2" type="button">Close</button><button class="btn primary" id="vmsLiveAuditPrint" type="button">Print</button></div></div>';
    document.body.appendChild(modal);
    const close=()=>modal.classList.remove('show');
    $('vmsLiveAuditClose').onclick=close;$('vmsLiveAuditClose2').onclick=close;
    $('vmsLiveAuditPrint').onclick=()=>window.print();
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    return modal;
  }

  function prettyJson(value){
    if(value==null)return '<div class="empty">No details have been published yet.</div>';
    if(Array.isArray(value))return `<div class="list">${value.map(v=>`<div class="list-item"><div class="list-item-main"><span>${esc(typeof v==='object'?JSON.stringify(v):v)}</span></div></div>`).join('')}</div>`;
    if(typeof value==='object')return `<div class="kv">${Object.entries(value).map(([k,v])=>`<div class="kv-item"><span>${esc(String(k).replace(/_/g,' ').toUpperCase())}</span><strong>${esc(typeof v==='object'?JSON.stringify(v):v)}</strong></div>`).join('')}</div>`;
    return `<p>${esc(value)}</p>`;
  }

  function renderAudits(audits){
    const section=$('section-audits');if(!section)return;
    const list=section.querySelector('.list');if(!list)return;
    if(!audits?.length){list.innerHTML='<div class="empty">No VMS audit has been published to your portal yet.</div>';return}
    list.innerHTML=audits.map(row=>{
      const score=scoreValue(row.scores),date=row.updated_at||row.created_at;
      const when=date?new Date(date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Recently';
      return `<div class="list-item"><div style="display:flex;align-items:center;gap:11px"><div class="audit-score">${score==null?'—':esc(score)}</div><div class="list-item-main"><strong>${esc(row.business_name||'VMS Business & Website Audit')}</strong><span>${esc(titleStatus(row.status||'Published'))} · ${esc(when)}</span></div></div><div class="list-actions"><button class="btn small vms-live-audit-view" data-audit-id="${esc(row.id)}" type="button">View Report</button></div></div>`;
    }).join('');
    list.querySelectorAll('.vms-live-audit-view').forEach(button=>button.addEventListener('click',()=>{
      const row=audits.find(x=>String(x.id)===String(button.dataset.auditId));if(!row)return;
      const modal=ensureLiveAuditModal();
      $('vmsLiveAuditTitle').textContent=row.business_name||'VMS Business & Website Audit';
      $('vmsLiveAuditBody').innerHTML=`<div class="card" style="box-shadow:none"><div class="card-head"><div><h3>Scores</h3><p>Published VMS audit data</p></div></div>${prettyJson(row.scores)}</div><div class="card" style="box-shadow:none;margin-top:10px"><div class="card-head"><div><h3>Findings & Recommendations</h3></div></div>${prettyJson(row.findings)}</div>`;
      modal.classList.add('show');
    }));
  }

  function billingName(row,catalogMap){return row?.service_name||catalogMap.get(row?.service_key)?.name||'VMS Subscription'}

  async function sendClientEvent(type,payload){
    const sb=await window.VMSAuth?.client?.();
    if(!sb)throw new Error('Client Portal session is not ready.');
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Please sign in again.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const res=await fetch('/api/client-event',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({type,payload}),signal:controller.signal});
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(json.error||'VMS could not save this request.');
      return json;
    }catch(e){if(e?.name==='AbortError')throw new Error('The request timed out. Please try again.');throw e}finally{clearTimeout(timer)}
  }

  function installBillingActions(rows,catalog){
    const hero=document.querySelector('#section-billing .billing-hero small');if(hero)hero.textContent='BILLING & SUBSCRIPTION';
    const manage=document.querySelector('#section-billing .card:last-of-type .card-head p');
    if(manage)manage.textContent='Subscription changes are securely sent to VMS. Payment self-service will appear here when live billing is connected.';
    const note=document.querySelector('#section-billing .card:last-of-type .note');
    if(note)note.textContent='Canceling does not erase your client history. VMS will confirm the effective date and any paid-through access before changing the service.';

    const catalogMap=new Map((catalog||[]).map(x=>[x.id,x]));
    const recurring=(rows||[]).filter(activeService).filter(row=>isRecurring(row,catalogMap.get(row.service_key)));
    const pause=$('pauseSubscriptionBtn'),cancel=$('cancelSubscriptionBtn');
    if(pause)pause.textContent='Request Pause';
    if(cancel)cancel.textContent='Request Cancellation';
    if(!pause||!cancel)return;
    pause.disabled=cancel.disabled=!recurring.length;
    if(!recurring.length)return;
    const planLabel=recurring.length===1?billingName(recurring[0],catalogMap):`${recurring.length} VMS subscriptions`;

    const openAction=mode=>{
      const modal=$('subscriptionModal'),title=$('subscriptionModalTitle'),body=$('subscriptionModalBody'),foot=$('subscriptionModalFoot');
      if(!modal||!title||!body||!foot)return;
      const canceling=mode==='cancel';
      title.textContent=canceling?`Request Cancellation — ${planLabel}`:`Request Pause — ${planLabel}`;
      body.innerHTML=`<p style="margin:0;color:var(--muted);font-size:9px;line-height:1.6">${canceling?'Send a cancellation request to Vision Make Studio. Your service stays unchanged until VMS confirms the effective date and any paid-through access.':'Send a pause request to Vision Make Studio. Your service stays active until VMS reviews and confirms the pause date.'}</p>${canceling?'<div class="field" style="margin-top:12px"><label>OPTIONAL — REASON</label><select id="vmsCancelReason"><option>Need a break</option><option>Service completed</option><option>Too expensive</option><option>Not using it</option><option>Business closed</option><option>Other</option></select></div>':''}<div class="note" id="vmsBillingActionStatus" style="margin-top:10px">No immediate billing change is made by this request.</div>`;
      foot.innerHTML=`<button class="btn" id="vmsBillingBack" type="button">Go Back</button><button class="btn ${canceling?'red':'primary'}" id="vmsBillingConfirm" type="button">${canceling?'Send Cancellation Request':'Send Pause Request'}</button>`;
      modal.classList.add('show');
      $('vmsBillingBack').onclick=()=>modal.classList.remove('show');
      $('vmsBillingConfirm').onclick=async()=>{
        const button=$('vmsBillingConfirm'),status=$('vmsBillingActionStatus');button.disabled=true;button.textContent='Sending…';
        try{
          const payload={plan:planLabel};if(canceling)payload.reason=$('vmsCancelReason')?.value||'';
          await sendClientEvent(canceling?'subscription_cancel_requested':'subscription_pause_requested',payload);
          if(status)status.textContent=canceling?'Cancellation request sent to VMS.':'Pause request sent to VMS.';
          const billingStatus=$('billingStatusText');if(billingStatus)billingStatus.textContent=canceling?'Cancellation requested':'Pause requested';
          button.textContent='Sent';setTimeout(()=>modal.classList.remove('show'),700);
        }catch(e){if(status)status.textContent=e?.message||'Could not send request.';button.disabled=false;button.textContent=canceling?'Send Cancellation Request':'Send Pause Request'}
      };
    };
    pause.onclick=()=>openAction('pause');cancel.onclick=()=>openAction('cancel');
  }

  function scrubQrForUnconfiguredRealClient(email){
    return; // The portal now builds the QR list from the client's real QR codes.
    if(lower(email)===TEST_EMAIL)return;
    const state=portalState();
    if(!state?.qr||state.qr.destination)return;
    const section=$('section-qrs');if(!section)return;
    const card=section.querySelector('.qr-card');
    if(card)card.innerHTML='<div class="empty" style="grid-column:1/-1">Your VMS Smart QR will appear here after VMS creates and connects it to your client account.</div>';
  }

  async function syncLivePanels(){
    if(cleanupRunning)return;cleanupRunning=true;
    try{
      if(!window.VMSAuth?.client)return;
      const sb=await VMSAuth.client();if(!sb)return;
      const {data:{session}}=await sb.auth.getSession();const email=lower(session?.user?.email);if(!email)return;
      if(scrubLegacyTestDefaults(email)&&sessionStorage.getItem('vms_portal_legacy_cleanup')!=='1'){
        sessionStorage.setItem('vms_portal_legacy_cleanup','1');location.reload();return;
      }
      const {data:client,error:clientError}=await sb.from('clients').select('id,business_name,owner_email').ilike('owner_email',email).maybeSingle();
      if(clientError||!client)return;
      const [{data:rows,error:serviceError},{data:catalog,error:catalogError},{data:audits,error:auditError}]=await Promise.all([
        sb.from('client_services').select('*').eq('client_id',client.id),
        sb.from('service_catalog').select('*').eq('status','Published'),
        sb.from('audit_records').select('*').eq('client_id',client.id).order('created_at',{ascending:false})
      ]);
      if(serviceError)throw serviceError;if(catalogError)throw catalogError;if(auditError)throw auditError;
      liveContext={client,rows:rows||[],catalog:catalog||[],audits:audits||[]};
      replaceLegacyProjectPanels();renderAudits(liveContext.audits);installBillingActions(liveContext.rows,liveContext.catalog);scrubQrForUnconfiguredRealClient(email);
    }catch(e){console.warn('VMS Client Portal production cleanup skipped',e)}finally{cleanupRunning=false}
  }

  function boot(){
    [500,1200,2600,5000].forEach(ms=>setTimeout(syncLivePanels,ms));
    window.addEventListener('focus',syncLivePanels);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncLivePanels()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* VMS Client Portal · Billing Center v1 · real data / provider-ready */
(()=>{
  const path=String(location.pathname||'').toLowerCase();
  if(!(path==='/portal'||path==='/portal/'||path.startsWith('/portal/')))return;
  if(document.documentElement.dataset.vmsShell==='portal-v2')return; /* Client Portal v2 (assets/vms-portal.js) owns this page. */

  const TEST_EMAIL='info@visionmakestudio.com';
  const lower=v=>String(v||'').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(value,currency='USD')=>{
    const n=Number(value||0);
    try{return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency||'USD').toUpperCase(),minimumFractionDigits:2}).format(Number.isFinite(n)?n:0)}catch{return `$${(Number.isFinite(n)?n:0).toFixed(2)}`}
  };
  const date=value=>{
    if(!value)return '';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  };
  const safeUrl=value=>{try{const u=new URL(String(value||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const titleStatus=value=>{
    const s=lower(value).replace(/[_-]+/g,' ');
    if(s==='past due')return 'Past Due';
    if(s==='test')return 'Test Access';
    return s?s.replace(/\b\w/g,c=>c.toUpperCase()):'Active';
  };
  const statusTone=value=>{
    const s=lower(value);
    if(['active','paid','test','trialing','completed'].includes(s))return 'green';
    if(['past_due','past due','unpaid','incomplete'].includes(s))return 'red';
    if(['paused','pending'].includes(s))return 'orange';
    if(['canceled','cancelled'].includes(s))return 'muted';
    return 'blue';
  };
  /* A service is recurring only when its catalog pricing model is Recurring.
     (Without a catalog row, fall back to a real monthly/yearly cadence - never "one-time".) */
  function isRecurring(row,cat){
    const model=String(cat?.pricing_model||'').trim().toLowerCase();
    if(model)return model==='recurring';
    return /^(month|year|annual|week|quarter)/i.test(String(row?.billing_cadence||'').trim());
  }
  const recurringRow=(row,catalogMap)=>{
    const cat=catalogMap.get(row?.service_key);
    return isRecurring(row,cat);
  };
  const serviceActive=row=>!['canceled','cancelled'].includes(lower(row?.service_status));
  let running=false;

  function installStyles(){
    if(document.getElementById('vms-billing-center-style'))return;
    const style=document.createElement('style');
    style.id='vms-billing-center-style';
    style.textContent=`
      #section-billing.vms-billing-center{--billNavy:#003049;--billBlue:#669BBC;--billGreen:#2b8c69;--billOrange:#d97818;--billRed:#C1121F;--billInk:#173443;--billMuted:#71858f;--billLine:#dfe8ec;--billSoft:#f6f9fa}
      #section-billing .vms-billing-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:14px}
      #section-billing .vms-billing-head h2{margin:0;color:var(--billNavy);font-size:24px;line-height:1.05;letter-spacing:-.035em}
      #section-billing .vms-billing-head p{margin:6px 0 0;color:var(--billMuted);font-size:10px;line-height:1.55;max-width:700px}
      #section-billing .vms-billing-provider{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--billLine);border-radius:999px;background:#fff;padding:7px 10px;color:#637b87;font-size:8px;font-weight:950;white-space:nowrap}
      #section-billing .vms-billing-provider:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--billBlue)}
      #section-billing .vms-billing-provider.live:before{background:var(--billGreen)}
      #section-billing .vms-billing-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:12px;margin-bottom:12px}
      #section-billing .vms-billing-primary{position:relative;overflow:hidden;border-radius:18px;padding:22px;background:linear-gradient(145deg,#003049 0%,#0c4a66 100%);color:#fff;min-height:184px;box-shadow:0 16px 40px rgba(0,48,73,.13)}
      #section-billing .vms-billing-primary:after{content:"";position:absolute;right:-60px;bottom:-85px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.14),transparent 65%);pointer-events:none}
      #section-billing .vms-billing-kicker{display:block;color:#b9d2dc;font-size:8px;font-weight:950;letter-spacing:.11em}
      #section-billing .vms-billing-primary strong{display:block;margin-top:10px;font-size:30px;line-height:1;letter-spacing:-.045em}
      #section-billing .vms-billing-primary p{margin:10px 0 0;color:#c4d8e0;font-size:9px;line-height:1.5;max-width:580px}
      #section-billing .vms-billing-quick{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #section-billing .vms-billing-quick-card{border:1px solid var(--billLine);border-radius:15px;background:#fff;padding:15px;min-width:0}
      #section-billing .vms-billing-quick-card span{display:block;color:#84969f;font-size:7px;font-weight:950;letter-spacing:.05em}
      #section-billing .vms-billing-quick-card strong{display:block;margin-top:6px;color:var(--billNavy);font-size:13px;line-height:1.25;overflow-wrap:anywhere}
      #section-billing .vms-billing-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:12px;align-items:start}
      #section-billing .vms-billing-stack{display:grid;gap:12px}
      #section-billing .vms-billing-card{border:1px solid var(--billLine);border-radius:16px;background:#fff;padding:15px;box-shadow:0 5px 18px rgba(0,48,73,.035)}
      #section-billing .vms-billing-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      #section-billing .vms-billing-card-head h3{margin:0;color:var(--billNavy);font-size:13px}
      #section-billing .vms-billing-card-head p{margin:4px 0 0;color:var(--billMuted);font-size:8px;line-height:1.5}
      #section-billing .vms-sub-list,#section-billing .vms-invoice-list{display:grid;gap:9px}
      #section-billing .vms-sub-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid #e3ebee;border-radius:13px;padding:12px;background:#fbfdfd}
      #section-billing .vms-sub-main{min-width:0}
      #section-billing .vms-sub-title{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      #section-billing .vms-sub-title strong{color:var(--billNavy);font-size:10px;line-height:1.25}
      #section-billing .vms-sub-meta{display:flex;gap:6px 12px;flex-wrap:wrap;margin-top:6px;color:var(--billMuted);font-size:8px}
      #section-billing .vms-sub-price{text-align:right;white-space:nowrap}
      #section-billing .vms-sub-price strong{display:block;color:var(--billNavy);font-size:12px}
      #section-billing .vms-sub-price span{display:block;margin-top:3px;color:#899ba4;font-size:7px}
      #section-billing .vms-billing-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;font-size:7px;font-weight:950;background:#edf5f8;color:#3a7390}
      #section-billing .vms-billing-badge.green{background:#edf7f3;color:var(--billGreen)}
      #section-billing .vms-billing-badge.orange{background:#fff5e8;color:#a9651d}
      #section-billing .vms-billing-badge.red{background:#fbeff0;color:#b13a43}
      #section-billing .vms-billing-badge.muted{background:#f1f3f4;color:#74858d}
      #section-billing .vms-invoice-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border-bottom:1px solid #edf1f3;padding:10px 0}
      #section-billing .vms-invoice-row:last-child{border-bottom:0}
      #section-billing .vms-invoice-row strong{display:block;color:var(--billNavy);font-size:9px}
      #section-billing .vms-invoice-row span{display:block;margin-top:3px;color:var(--billMuted);font-size:7px}
      #section-billing .vms-invoice-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      #section-billing .vms-billing-actions{display:grid;gap:8px}
      #section-billing .vms-billing-action{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e3ebee;border-radius:13px;padding:11px;background:#fbfdfd}
      #section-billing .vms-billing-action strong{display:block;color:var(--billNavy);font-size:9px}
      #section-billing .vms-billing-action span{display:block;margin-top:3px;color:var(--billMuted);font-size:7px;line-height:1.4}
      #section-billing .vms-billing-empty{border:1px dashed #cbd9df;border-radius:13px;background:#fafcfd;padding:20px;text-align:center;color:#7f929b;font-size:8px;line-height:1.55}
      #section-billing .vms-billing-note{margin-top:10px;border-radius:12px;background:#f5f8f9;border:1px solid #e4ecef;padding:10px;color:#758a94;font-size:7.5px;line-height:1.5}
      #section-billing .vms-billing-modal{position:fixed;inset:0;z-index:10050;display:none;place-items:center;padding:18px;background:rgba(0,38,58,.44);backdrop-filter:blur(4px)}
      #section-billing .vms-billing-modal.show{display:grid}
      #section-billing .vms-billing-dialog{width:min(520px,100%);border-radius:18px;background:#fff;border:1px solid var(--billLine);box-shadow:0 28px 80px rgba(0,35,52,.23);overflow:hidden}
      #section-billing .vms-billing-dialog-head,#section-billing .vms-billing-dialog-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 15px;border-bottom:1px solid #edf1f3}
      #section-billing .vms-billing-dialog-head h3{margin:0;color:var(--billNavy);font-size:12px}
      #section-billing .vms-billing-dialog-body{padding:15px;color:var(--billMuted);font-size:9px;line-height:1.55}
      #section-billing .vms-billing-dialog-foot{border-top:1px solid #edf1f3;border-bottom:0;justify-content:flex-end}
      @media(max-width:900px){
        #section-billing .vms-billing-head{align-items:flex-start;flex-direction:column;gap:9px}
        #section-billing .vms-billing-head h2{font-size:22px}
        #section-billing .vms-billing-head p{font-size:10px}
        #section-billing .vms-billing-hero,#section-billing .vms-billing-grid{grid-template-columns:1fr}
        #section-billing .vms-billing-primary{min-height:160px;padding:18px}
        #section-billing .vms-billing-primary strong{font-size:27px}
        #section-billing .vms-billing-quick{grid-template-columns:1fr 1fr}
        #section-billing .vms-sub-row{grid-template-columns:1fr}
        #section-billing .vms-sub-price{text-align:left;display:flex;align-items:baseline;gap:5px}
      }
      @media(max-width:520px){
        #section-billing .vms-billing-quick{grid-template-columns:1fr 1fr}
        #section-billing .vms-billing-quick-card{padding:12px}
        #section-billing .vms-billing-action{align-items:flex-start;flex-direction:column}
        #section-billing .vms-billing-action .btn{width:100%}
        #section-billing .vms-invoice-row{grid-template-columns:1fr}
        #section-billing .vms-invoice-actions{justify-content:flex-start}
      }
    `;
    document.head.appendChild(style);
  }

  async function sendEvent(type,payload){
    const sb=await window.VMSAuth?.client?.();
    if(!sb)throw new Error('Client Portal session is not ready.');
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Please sign in again.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const res=await fetch('/api/client-event',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({type,payload}),signal:controller.signal});
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(json.error||'VMS could not save this request.');
      return json;
    }catch(e){if(e?.name==='AbortError')throw new Error('The request timed out. Please try again.');throw e}finally{clearTimeout(timer)}
  }

  function openManageModal(service,mode){
    const modal=document.getElementById('vmsBillingCenterModal');if(!modal)return;
    const title=modal.querySelector('[data-vms-billing-modal-title]');
    const body=modal.querySelector('[data-vms-billing-modal-body]');
    const confirm=modal.querySelector('[data-vms-billing-confirm]');
    const cancel=modal.querySelector('[data-vms-billing-close]');
    const isCancel=mode==='cancel';
    title.textContent=isCancel?'Request Cancellation':'Request Pause';
    body.innerHTML=`<p style="margin:0">${isCancel?'VMS will review this request and confirm the effective cancellation date. Your service does not shut off immediately.':'VMS will review your pause request and confirm when the pause takes effect.'}</p><div style="margin-top:12px;padding:11px;border-radius:11px;background:#f6f9fa;border:1px solid #e3ebee"><strong style="display:block;color:#003049;font-size:10px">${esc(service.name)}</strong><span style="display:block;margin-top:4px;font-size:8px">${esc(service.priceLabel)} · ${esc(service.statusLabel)}</span></div>${isCancel?'<label style="display:grid;gap:5px;margin-top:12px;font-size:8px;font-weight:900;color:#6f828d">OPTIONAL REASON<select data-vms-billing-reason style="min-height:42px;border:1px solid #d8e3e7;border-radius:10px;padding:9px 10px;background:#fff"><option>Need a break</option><option>Service completed</option><option>Too expensive</option><option>Not using it</option><option>Business closed</option><option>Other</option></select></label>':''}<div data-vms-billing-modal-status style="margin-top:10px;font-size:8px">No immediate billing change is made by this request.</div>`;
    confirm.textContent=isCancel?'Send Cancellation Request':'Send Pause Request';
    confirm.className=`btn ${isCancel?'red':'primary'}`;
    const close=()=>modal.classList.remove('show');
    cancel.onclick=close;
    modal.onclick=e=>{if(e.target===modal)close()};
    confirm.onclick=async()=>{
      if(confirm.disabled)return;confirm.disabled=true;const original=confirm.textContent;confirm.textContent='Sending…';
      const status=modal.querySelector('[data-vms-billing-modal-status]');
      try{
        await sendEvent(isCancel?'subscription_cancel_requested':'subscription_pause_requested',{
          plan:service.name,serviceKey:service.serviceKey,reason:isCancel?(modal.querySelector('[data-vms-billing-reason]')?.value||''):''
        });
        status.textContent=isCancel?'Cancellation request sent to VMS.':'Pause request sent to VMS.';
        confirm.textContent='Sent';setTimeout(close,850);
      }catch(e){status.textContent=e?.message||'Could not send request.';confirm.disabled=false;confirm.textContent=original}
    };
    modal.classList.add('show');
  }

  function invoiceMarkup(invoices){
    if(!invoices.length)return '<div class="vms-billing-empty"><strong style="display:block;color:#526c78;font-size:10px;margin-bottom:4px">No invoices yet</strong>Real invoices and receipts will appear here automatically after live payment processing is connected. No sample charges are shown.</div>';
    return invoices.map(inv=>{
      const number=inv.invoice_number||'Invoice';
      const when=date(inv.paid_at||inv.issued_at||inv.created_at)||'Recent';
      const amount=money(inv.status==='paid'?inv.amount_paid:inv.amount_due,inv.currency);
      const hosted=safeUrl(inv.hosted_invoice_url),pdf=safeUrl(inv.invoice_pdf_url);
      return `<div class="vms-invoice-row"><div><strong>${esc(number)} · ${esc(amount)}</strong><span>${esc(titleStatus(inv.status))} · ${esc(when)}</span></div><div class="vms-invoice-actions">${hosted?`<a class="btn small" href="${esc(hosted)}" target="_blank" rel="noopener">View</a>`:''}${pdf?`<a class="btn small" href="${esc(pdf)}" target="_blank" rel="noopener">PDF</a>`:''}</div></div>`;
    }).join('');
  }

  function subscriptionView(services,catalog,ledger,email){
    const catalogMap=new Map(catalog.map(x=>[x.id,x]));
    const ledgerByService=new Map(ledger.filter(x=>x.client_service_id).map(x=>[String(x.client_service_id),x]));
    return services.filter(serviceActive).filter(row=>recurringRow(row,catalogMap)).map(row=>{
      const cat=catalogMap.get(row.service_key)||{};
      const sub=ledgerByService.get(String(row.id));
      const amount=sub?.amount!=null?Number(sub.amount):row.agreed_price!=null?Number(row.agreed_price):Number(cat.recurring_price||0);
      const cadence=sub?.cadence||row.billing_cadence||cat.cadence||'Monthly';
      const rawStatus=sub?.status||row.billing_status||row.service_status||'active';
      const isTest=row?.metadata?.testAccess===true||lower(rawStatus)==='test';
      const next=sub?.current_period_end||null;
      return {
        id:row.id,serviceKey:row.service_key,name:row.service_name||cat.name||'VMS Subscription',amount,currency:sub?.currency||'USD',cadence,
        rawStatus,statusLabel:isTest?'Test Access':titleStatus(rawStatus),tone:isTest?'blue':statusTone(rawStatus),next,
        start:row.start_date||sub?.current_period_start||null,isTest,provider:sub?.provider||'manual',manageUrl:safeUrl(sub?.metadata?.manage_url||sub?.metadata?.customer_portal_url),
        priceLabel:`${money(amount,sub?.currency||'USD')}/${/year|annual/i.test(cadence)?'yr':'mo'}`
      };
    });
  }

  async function render(){
    if(running)return;running=true;
    try{
      const section=document.getElementById('section-billing');
      if(!section||!window.VMSAuth?.client)return;
      const sb=await VMSAuth.client();if(!sb)return;
      const {data:{session}}=await sb.auth.getSession();const email=lower(session?.user?.email);if(!email)return;
      const {data:client,error:clientError}=await sb.from('clients').select('id,business_name,owner_email').ilike('owner_email',email).maybeSingle();
      if(clientError||!client)return;
      const [{data:services,error:serviceError},{data:catalog,error:catalogError},{data:ledger,error:ledgerError},{data:invoices,error:invoiceError}]=await Promise.all([
        sb.from('client_services').select('*').eq('client_id',client.id),
        sb.from('service_catalog').select('id,name,pricing_model,recurring_price,cadence').eq('status','Published'),
        sb.from('billing_subscriptions').select('*').eq('client_id',client.id).order('created_at',{ascending:false}),
        sb.from('billing_invoices').select('*').eq('client_id',client.id).order('created_at',{ascending:false}).limit(24)
      ]);
      if(serviceError)throw serviceError;if(catalogError)throw catalogError;if(ledgerError)throw ledgerError;if(invoiceError)throw invoiceError;
      const subs=subscriptionView(services||[],catalog||[],ledger||[],email);
      const invs=invoices||[];
      const allTest=subs.length>0&&subs.every(x=>x.isTest);
      const liveProvider=(ledger||[]).some(x=>x.provider&&lower(x.provider)!=='manual');
      const monthly=subs.filter(x=>!/year|annual/i.test(x.cadence)).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
      const annual=subs.filter(x=>/year|annual/i.test(x.cadence)).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
      const nextDates=subs.map(x=>x.next).filter(Boolean).map(x=>new Date(x)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>a-b);
      const nextBilling=nextDates.length?date(nextDates[0]):'Not scheduled';
      const liveStatus=subs.some(x=>['past_due','past due','unpaid','incomplete'].includes(lower(x.rawStatus)))?'Needs attention':subs.length?(allTest?'Test access':'Active'):'No subscription';
      const heroValue=allTest?'Test access':monthly?`${money(monthly)}/mo`:annual?`${money(annual)}/yr`:'No recurring charge';
      const heroNote=allTest?'This account is using VMS test access. Nothing shown here is a live charge.':subs.length?'Your recurring services use the agreed client price stored by VMS.':'No recurring VMS service is assigned to this account.';
      const paymentMethod=(ledger||[]).find(x=>x?.metadata?.payment_method_label)?.metadata?.payment_method_label||'Not connected';
      const manageUrl=subs.map(x=>x.manageUrl).find(Boolean)||'';
      installStyles();
      section.classList.add('vms-billing-center');
      section.innerHTML=`
        <div class="vms-billing-head"><div><h2>Billing & Subscription</h2><p>See your actual VMS recurring services, agreed pricing, invoice history, next billing date, and subscription controls in one place.</p></div><span class="vms-billing-provider ${liveProvider?'live':''}">${liveProvider?'Live billing connected':'VMS-managed billing'}</span></div>
        <div class="vms-billing-hero">
          <div class="vms-billing-primary"><span class="vms-billing-kicker">${allTest?'TEST ACCOUNT':'CURRENT RECURRING TOTAL'}</span><strong>${esc(heroValue)}</strong><p>${esc(heroNote)}</p>${annual&&!allTest?`<p>Plus ${esc(money(annual))}/year in annual recurring services.</p>`:''}</div>
          <div class="vms-billing-quick">
            <div class="vms-billing-quick-card"><span>STATUS</span><strong>${esc(liveStatus)}</strong></div>
            <div class="vms-billing-quick-card"><span>NEXT BILLING</span><strong>${esc(nextBilling)}</strong></div>
            <div class="vms-billing-quick-card"><span>PAYMENT METHOD</span><strong>${esc(paymentMethod)}</strong></div>
            <div class="vms-billing-quick-card"><span>INVOICES</span><strong>${invs.length}</strong></div>
          </div>
        </div>
        <div class="vms-billing-grid">
          <div class="vms-billing-stack">
            <div class="vms-billing-card"><div class="vms-billing-card-head"><div><h3>Your Subscriptions</h3><p>These prices come from the service assigned to your VMS client account.</p></div></div>
              <div class="vms-sub-list">${subs.length?subs.map(s=>`<div class="vms-sub-row"><div class="vms-sub-main"><div class="vms-sub-title"><strong>${esc(s.name)}</strong><span class="vms-billing-badge ${esc(s.tone)}">${esc(s.statusLabel)}</span></div><div class="vms-sub-meta"><span>${s.start?`Started ${esc(date(s.start))}`:'Start date not set'}</span><span>${s.next?`Next billing ${esc(date(s.next))}`:'Billing date appears when live payments are connected'}</span></div></div><div class="vms-sub-price"><strong>${esc(s.priceLabel)}</strong><span>agreed price</span></div></div>`).join(''):'<div class="vms-billing-empty">No recurring subscription is assigned to this client account.</div>'}</div>
            </div>
            <div class="vms-billing-card"><div class="vms-billing-card-head"><div><h3>Invoices & Receipts</h3><p>Only real billing records are shown here.</p></div></div><div class="vms-invoice-list">${invoiceMarkup(invs)}</div></div>
          </div>
          <div class="vms-billing-stack">
            <div class="vms-billing-card"><div class="vms-billing-card-head"><div><h3>Manage Subscription</h3><p>Make a billing request without losing your VMS client history.</p></div></div>
              <div class="vms-billing-actions">
                ${subs.length?`<div class="vms-billing-action"><div><strong>Pause a subscription</strong><span>Ask VMS to temporarily pause one of your recurring services.</span></div><button class="btn" type="button" data-vms-billing-action="pause">Request Pause</button></div>
                <div class="vms-billing-action"><div><strong>Cancel a subscription</strong><span>Request cancellation and receive a confirmed effective date.</span></div><button class="btn red" type="button" data-vms-billing-action="cancel">Request Cancellation</button></div>`:'<div class="vms-billing-empty">Subscription controls will appear when a recurring service is assigned.</div>'}
                <div class="vms-billing-action"><div><strong>Payment method</strong><span>${manageUrl?'Open the secure billing portal to update your payment method.':'Self-service payment methods become available when live checkout is connected.'}</span></div><button class="btn" type="button" data-vms-payment-manage ${manageUrl?'':'disabled'}>${manageUrl?'Manage Payment':'Not Available Yet'}</button></div>
                <div class="vms-billing-action"><div><strong>Need help?</strong><span>Contact Vision Make Studio about a charge, invoice, or subscription.</span></div><a class="btn" href="mailto:info@visionmakestudio.com?subject=VMS%20Billing%20Help">Contact VMS</a></div>
              </div>
              <div class="vms-billing-note">Pause and cancellation buttons send a request to VMS; they do not silently shut off paid services. Once a payment provider is connected, the next charge date, payment method, and invoices will populate from the live billing ledger.</div>
            </div>
          </div>
        </div>
        <div class="vms-billing-modal" id="vmsBillingCenterModal"><div class="vms-billing-dialog"><div class="vms-billing-dialog-head"><h3 data-vms-billing-modal-title>Manage Subscription</h3><button class="btn small" type="button" data-vms-billing-close>Close</button></div><div class="vms-billing-dialog-body" data-vms-billing-modal-body></div><div class="vms-billing-dialog-foot"><button class="btn primary" type="button" data-vms-billing-confirm>Send Request</button></div></div></div>`;

      const chooseService=mode=>{
        if(!subs.length)return;
        if(subs.length===1)return openManageModal(subs[0],mode);
        const modal=document.getElementById('vmsBillingCenterModal'),title=modal?.querySelector('[data-vms-billing-modal-title]'),body=modal?.querySelector('[data-vms-billing-modal-body]'),confirm=modal?.querySelector('[data-vms-billing-confirm]'),close=modal?.querySelector('[data-vms-billing-close]');
        if(!modal||!title||!body||!confirm||!close)return;
        title.textContent=mode==='cancel'?'Choose Subscription to Cancel':'Choose Subscription to Pause';
        body.innerHTML=`<p style="margin-top:0">Choose the recurring service you want VMS to review.</p><div style="display:grid;gap:7px">${subs.map((s,i)=>`<button type="button" class="btn" data-vms-sub-choice="${i}" style="justify-content:space-between;width:100%"><span>${esc(s.name)}</span><span>${esc(s.priceLabel)}</span></button>`).join('')}</div>`;
        confirm.style.display='none';close.onclick=()=>{modal.classList.remove('show');confirm.style.display=''};modal.classList.add('show');
        body.querySelectorAll('[data-vms-sub-choice]').forEach(btn=>btn.onclick=()=>{confirm.style.display='';openManageModal(subs[Number(btn.dataset.vmsSubChoice)],mode)});
      };
      section.querySelector('[data-vms-billing-action="pause"]')?.addEventListener('click',()=>chooseService('pause'));
      section.querySelector('[data-vms-billing-action="cancel"]')?.addEventListener('click',()=>chooseService('cancel'));
      const manage=section.querySelector('[data-vms-payment-manage]');if(manageUrl&&manage)manage.addEventListener('click',()=>window.open(manageUrl,'_blank','noopener'));
    }catch(e){console.warn('VMS Billing Center could not load.',e)}finally{running=false}
  }

  function boot(){[1800,3400,5600].forEach(ms=>setTimeout(render,ms));window.addEventListener('focus',render);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* ============================================================
   VMS PHASE 2 — CLIENT PORTAL UI POLISH
   Visual / responsive layer only. Existing portal business logic remains intact.
   ============================================================ */
(()=>{
  const path=String(location.pathname||'').toLowerCase();
  if(!(path==='/portal'||path==='/portal/'||path.startsWith('/portal/')))return;
  if(document.documentElement.dataset.vmsShell==='portal-v2')return; /* Client Portal v2 (assets/vms-portal.js) owns this page. */
  if(document.getElementById('vms-client-portal-phase2-ui'))return;

  const style=document.createElement('style');
  style.id='vms-client-portal-phase2-ui';
  style.textContent=`
    :root{
      --vms-p2-navy:#003049;
      --vms-p2-navy-deep:#00263a;
      --vms-p2-blue:#669BBC;
      --vms-p2-cream:#FDF0D5;
      --vms-p2-orange:#EB5E28;
      --vms-p2-red:#C1121F;
      --vms-p2-green:#2b8c69;
      --vms-p2-ink:#173443;
      --vms-p2-muted:#6e828d;
      --vms-p2-line:#dce6ea;
      --vms-p2-bg:#f5f6f8;
      --vms-p2-card:rgba(255,255,255,.94);
      --vms-p2-shadow:0 10px 32px rgba(0,48,73,.055);
      --vms-p2-radius-xl:22px;
      --vms-p2-radius-lg:18px;
      --vms-p2-radius-md:14px;
    }

    html.vms-portal-phase2,html.vms-portal-phase2 body{
      background:
        radial-gradient(circle at 86% -12%,rgba(102,155,188,.14),transparent 29%),
        linear-gradient(180deg,#f8f9fa 0%,var(--vms-p2-bg) 100%)!important;
      color:var(--vms-p2-ink)!important;
      font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif!important;
      -webkit-font-smoothing:antialiased;
      text-rendering:optimizeLegibility;
    }
    html.vms-portal-phase2 button,html.vms-portal-phase2 input,html.vms-portal-phase2 select,html.vms-portal-phase2 textarea{font:inherit}
    html.vms-portal-phase2 :focus-visible{outline:3px solid rgba(102,155,188,.28)!important;outline-offset:2px!important}

    /* Shell + sidebar */
    html.vms-portal-phase2 .shell{grid-template-columns:244px minmax(0,1fr)!important;min-height:100vh!important}
    html.vms-portal-phase2 .sidebar{
      width:244px!important;min-width:244px!important;height:100vh!important;
      position:sticky!important;top:0!important;padding:18px 14px 20px!important;
      background:linear-gradient(180deg,var(--vms-p2-navy) 0%,#002d45 68%,var(--vms-p2-navy-deep) 100%)!important;
      color:#fff!important;overflow-y:auto!important;overflow-x:hidden!important;
      box-shadow:inset -1px 0 rgba(255,255,255,.04)!important;
    }
    html.vms-portal-phase2 .brand{
      min-height:70px!important;padding:4px 8px 17px!important;margin:0!important;
      border-bottom:1px solid rgba(255,255,255,.12)!important;gap:11px!important;
    }
    html.vms-portal-phase2 .brand img{width:88px!important;max-width:88px!important;height:auto!important;max-height:48px!important;object-fit:contain!important}
    html.vms-portal-phase2 .brand-mark{width:42px!important;height:42px!important;border-radius:13px!important;font-size:13px!important}
    html.vms-portal-phase2 .brand-copy strong{font-size:12.5px!important;line-height:1.2!important;font-weight:800!important}
    html.vms-portal-phase2 .brand-copy span{font-size:9px!important;line-height:1.15!important;margin-top:3px!important;letter-spacing:.1em!important}
    html.vms-portal-phase2 .nav{gap:5px!important;margin-top:15px!important}
    html.vms-portal-phase2 .nav button{
      min-height:44px!important;padding:11px 12px!important;border-radius:12px!important;
      color:rgba(255,255,255,.78)!important;font-size:13px!important;line-height:1.2!important;font-weight:700!important;
      transition:background .16s ease,color .16s ease,transform .16s ease!important;
    }
    html.vms-portal-phase2 .nav button:hover{background:rgba(255,255,255,.075)!important;color:#fff!important;transform:translateX(2px)!important}
    html.vms-portal-phase2 .nav button.active{
      background:rgba(255,255,255,.105)!important;color:#fff!important;
      box-shadow:inset 3px 0 0 var(--vms-p2-orange)!important;
    }
    html.vms-portal-phase2 .nav button .pill{min-width:22px!important;height:22px!important;padding:0 7px!important;font-size:9px!important;background:rgba(255,255,255,.12)!important}
    html.vms-portal-phase2 .side-foot{padding:15px 8px 3px!important}
    html.vms-portal-phase2 .side-client{gap:10px!important}
    html.vms-portal-phase2 .side-client .avatar{width:40px!important;height:40px!important;font-size:11px!important}
    html.vms-portal-phase2 .side-client strong{font-size:11px!important;line-height:1.25!important}
    html.vms-portal-phase2 .side-client span{font-size:9px!important;margin-top:3px!important}

    /* Topbar */
    html.vms-portal-phase2 .topbar{
      min-height:76px!important;height:auto!important;padding:11px 26px!important;
      background:rgba(255,255,255,.88)!important;border-bottom:1px solid rgba(0,48,73,.09)!important;
      -webkit-backdrop-filter:saturate(155%) blur(18px)!important;backdrop-filter:saturate(155%) blur(18px)!important;
    }
    html.vms-portal-phase2 .topbar-left small{font-size:10px!important;line-height:1!important;font-weight:800!important;letter-spacing:.1em!important;color:#82959f!important}
    html.vms-portal-phase2 .topbar-left strong{font-size:22px!important;line-height:1.08!important;font-weight:760!important;letter-spacing:-.032em!important;margin-top:4px!important;color:var(--vms-p2-ink)!important}
    html.vms-portal-phase2 .portal-sync{font-size:10px!important;font-weight:800!important}

    /* Canvas + section rhythm */
    html.vms-portal-phase2 .content{width:min(100%,1420px)!important;max-width:1420px!important;margin:0 auto!important;padding:28px 28px 52px!important}
    html.vms-portal-phase2 .section.active{animation:vmsP2SectionIn .18s ease-out}
    @keyframes vmsP2SectionIn{from{opacity:.72;transform:translateY(3px)}to{opacity:1;transform:none}}
    html.vms-portal-phase2 .intro{gap:18px!important;margin-bottom:18px!important;align-items:center!important}
    html.vms-portal-phase2 .intro p{max-width:820px!important;color:var(--vms-p2-muted)!important;font-size:13px!important;line-height:1.58!important}
    html.vms-portal-phase2 .intro-actions{gap:8px!important}

    /* Buttons */
    html.vms-portal-phase2 .btn{
      min-height:42px!important;padding:9px 14px!important;border-radius:12px!important;
      font-size:12px!important;line-height:1!important;font-weight:750!important;letter-spacing:-.005em!important;
      transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease!important;
    }
    html.vms-portal-phase2 .btn:hover{transform:translateY(-1px)!important;box-shadow:0 8px 20px rgba(0,48,73,.075)!important}
    html.vms-portal-phase2 .btn.primary{background:var(--vms-p2-navy)!important;border-color:var(--vms-p2-navy)!important;color:#fff!important}
    html.vms-portal-phase2 .btn.red{background:var(--vms-p2-red)!important;border-color:var(--vms-p2-red)!important;color:#fff!important}
    html.vms-portal-phase2 .btn.small{min-height:36px!important;padding:8px 11px!important;font-size:11px!important}
    html.vms-portal-phase2 .icon-btn{width:42px!important;min-width:42px!important;padding:0!important}

    /* Cards and summaries */
    html.vms-portal-phase2 .status-strip{gap:12px!important;margin-bottom:18px!important}
    html.vms-portal-phase2 .stat{
      min-height:112px!important;padding:17px 18px!important;border-radius:18px!important;
      background:var(--vms-p2-card)!important;border:1px solid rgba(0,48,73,.09)!important;box-shadow:var(--vms-p2-shadow)!important;
    }
    html.vms-portal-phase2 .stat span{font-size:10.5px!important;line-height:1.15!important;font-weight:800!important;letter-spacing:.055em!important}
    html.vms-portal-phase2 .stat strong{font-size:29px!important;line-height:1!important;margin-top:8px!important;font-weight:760!important;letter-spacing:-.04em!important}
    html.vms-portal-phase2 .stat small{font-size:11px!important;line-height:1.4!important;margin-top:7px!important;color:#82959f!important}
    html.vms-portal-phase2 .grid{gap:16px!important}
    html.vms-portal-phase2 .card,
    html.vms-portal-phase2 .linkhub-panel,
    html.vms-portal-phase2 .optional-feature-card,
    html.vms-portal-phase2 .feature-admin-card,
    html.vms-portal-phase2 .vms-billing-card{
      border-radius:18px!important;border:1px solid rgba(0,48,73,.095)!important;
      background:var(--vms-p2-card)!important;box-shadow:var(--vms-p2-shadow)!important;
    }
    html.vms-portal-phase2 .card{padding:18px!important}
    html.vms-portal-phase2 .card-head{margin-bottom:15px!important;gap:12px!important}
    html.vms-portal-phase2 .card-head h3,
    html.vms-portal-phase2 .linkhub-panel-head h3,
    html.vms-portal-phase2 .catalog-head h3{font-size:16px!important;line-height:1.2!important;font-weight:760!important;letter-spacing:-.018em!important;color:var(--vms-p2-ink)!important}
    html.vms-portal-phase2 .card-head p,
    html.vms-portal-phase2 .linkhub-panel-head p,
    html.vms-portal-phase2 .catalog-head p{font-size:11.5px!important;line-height:1.5!important;color:var(--vms-p2-muted)!important}
    html.vms-portal-phase2 .badge{padding:6px 9px!important;font-size:9.5px!important;font-weight:800!important}

    /* Lists / project / files / requests / notifications */
    html.vms-portal-phase2 .list{gap:10px!important}
    html.vms-portal-phase2 .list-item,
    html.vms-portal-phase2 .notification-item,
    html.vms-portal-phase2 .request-card{
      border-radius:15px!important;padding:13px 14px!important;border-color:rgba(0,48,73,.09)!important;background:#fff!important;
    }
    html.vms-portal-phase2 .list-item-main strong,
    html.vms-portal-phase2 .service-copy strong,
    html.vms-portal-phase2 .notification-copy strong,
    html.vms-portal-phase2 .timeline-item strong{font-size:12.5px!important;line-height:1.3!important;font-weight:730!important;color:var(--vms-p2-ink)!important}
    html.vms-portal-phase2 .list-item-main span,
    html.vms-portal-phase2 .service-copy span,
    html.vms-portal-phase2 .notification-copy span,
    html.vms-portal-phase2 .timeline-item span{font-size:11px!important;line-height:1.48!important;color:var(--vms-p2-muted)!important}
    html.vms-portal-phase2 .service-icon{width:48px!important;height:48px!important;border-radius:14px!important}
    html.vms-portal-phase2 .file-icon{width:42px!important;height:42px!important;border-radius:12px!important}
    html.vms-portal-phase2 .audit-score{width:52px!important;height:52px!important;font-size:16px!important}
    html.vms-portal-phase2 .timeline-item{grid-template-columns:30px minmax(0,1fr)!important;gap:10px!important;padding:10px 0!important}
    html.vms-portal-phase2 .dot{width:28px!important;height:28px!important;font-size:9px!important}
    html.vms-portal-phase2 .next-step{border-radius:15px!important;padding:15px!important}
    html.vms-portal-phase2 .next-step strong{font-size:13px!important}
    html.vms-portal-phase2 .next-step p{font-size:11px!important;line-height:1.5!important}
    html.vms-portal-phase2 .upload-zone{border-radius:17px!important;padding:24px!important;margin-bottom:14px!important;background:rgba(255,255,255,.72)!important}
    html.vms-portal-phase2 .upload-zone strong{font-size:13px!important}
    html.vms-portal-phase2 .upload-zone span{font-size:11px!important;line-height:1.45!important}
    html.vms-portal-phase2 .empty{min-height:110px!important;padding:22px!important;border-radius:15px!important;font-size:11.5px!important;line-height:1.55!important}
    html.vms-portal-phase2 .note{border-radius:14px!important;padding:12px 13px!important;font-size:10.5px!important;line-height:1.55!important}

    /* Services and catalog */
    html.vms-portal-phase2 .service-grid{gap:12px!important}
    html.vms-portal-phase2 .service-card{min-height:172px!important;padding:17px!important}
    html.vms-portal-phase2 .catalog-wrap{margin-top:22px!important}
    html.vms-portal-phase2 .catalog-head{margin-bottom:12px!important}
    html.vms-portal-phase2 .catalog-grid{gap:12px!important}
    html.vms-portal-phase2 .catalog-card{min-height:190px!important;padding:17px!important}
    html.vms-portal-phase2 .catalog-card h4{font-size:14px!important;line-height:1.25!important}
    html.vms-portal-phase2 .catalog-card p{font-size:11px!important;line-height:1.55!important}
    html.vms-portal-phase2 .tool-access{font-size:10px!important}

    /* QR */
    html.vms-portal-phase2 .qr-card{grid-template-columns:104px minmax(0,1fr) auto!important;gap:16px!important}
    html.vms-portal-phase2 .qr-preview{width:104px!important;height:104px!important;border-radius:14px!important;padding:8px!important}
    html.vms-portal-phase2 .metric-row{gap:18px!important;margin-top:10px!important}
    html.vms-portal-phase2 .metric span{font-size:9.5px!important;font-weight:800!important}
    html.vms-portal-phase2 .metric strong{font-size:13px!important;margin-top:4px!important}
    html.vms-portal-phase2 .qr-settings{gap:9px!important;margin-top:12px!important}
    html.vms-portal-phase2 .qr-setting{border-radius:12px!important;padding:11px!important}

    /* Forms */
    html.vms-portal-phase2 .form-grid{gap:13px!important}
    html.vms-portal-phase2 .field{gap:7px!important}
    html.vms-portal-phase2 .field label{font-size:10.5px!important;line-height:1.2!important;font-weight:800!important;letter-spacing:.045em!important;color:#657d88!important}
    html.vms-portal-phase2 .field input,
    html.vms-portal-phase2 .field select,
    html.vms-portal-phase2 .field textarea{
      min-height:46px!important;border-radius:12px!important;padding:11px 12px!important;font-size:13px!important;color:var(--vms-p2-ink)!important;
    }
    html.vms-portal-phase2 .field textarea{min-height:108px!important}
    html.vms-portal-phase2 .choice{border-radius:14px!important;padding:15px!important}
    html.vms-portal-phase2 .choice strong{font-size:12px!important}
    html.vms-portal-phase2 .choice span{font-size:10px!important;line-height:1.4!important}

    /* LinkHub editor */
    html.vms-portal-phase2 .linkhub-layout{gap:18px!important;align-items:start!important}
    html.vms-portal-phase2 .linkhub-editor{gap:14px!important}
    html.vms-portal-phase2 .linkhub-panel{padding:17px!important}
    html.vms-portal-phase2 .linkhub-panel-head{margin-bottom:14px!important;gap:12px!important}
    html.vms-portal-phase2 .link-editor-list,
    html.vms-portal-phase2 .social-list{gap:9px!important}
    html.vms-portal-phase2 .link-editor-row,
    html.vms-portal-phase2 .social-row{border-radius:13px!important;padding:10px 11px!important;gap:10px!important}
    html.vms-portal-phase2 .link-editor-copy strong{font-size:11.5px!important}
    html.vms-portal-phase2 .link-editor-copy span{font-size:10px!important;margin-top:3px!important}
    html.vms-portal-phase2 .social-admin-icon{width:38px!important;height:38px!important;border-radius:11px!important}
    html.vms-portal-phase2 .mini-btn{width:34px!important;height:34px!important;border-radius:9px!important;font-size:10px!important}
    html.vms-portal-phase2 .optional-feature-grid{gap:10px!important}
    html.vms-portal-phase2 .optional-feature-card{grid-template-columns:48px minmax(0,1fr)!important;gap:11px!important;padding:13px!important}
    html.vms-portal-phase2 .optional-feature-icon{width:48px!important;height:48px!important;border-radius:14px!important}
    html.vms-portal-phase2 .optional-feature-title strong{font-size:12px!important}
    html.vms-portal-phase2 .optional-feature-copy p{font-size:10.5px!important;line-height:1.5!important}
    html.vms-portal-phase2 .linkhub-photo{width:64px!important;height:64px!important}

    /* Modern, smaller LinkHub preview in the client portal too. */
    html.vms-portal-phase2 .linkhub-preview-wrap{max-width:320px!important;width:100%!important;margin-left:auto!important;margin-right:auto!important}
    html.vms-portal-phase2 .linkhub-phone{
      position:relative!important;width:100%!important;min-height:0!important;aspect-ratio:9/19.5!important;
      padding:5px!important;border:3px solid #27343b!important;border-radius:43px!important;background:#080d10!important;
      box-shadow:0 20px 46px rgba(0,35,52,.16),0 6px 14px rgba(0,35,52,.09),inset 0 0 0 1px rgba(255,255,255,.36)!important;
    }
    html.vms-portal-phase2 .linkhub-phone::before{
      content:"";position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:20;
      width:82px;height:24px;border-radius:999px;background:#05080a;box-shadow:0 2px 8px rgba(0,0,0,.25);
    }
    html.vms-portal-phase2 .linkhub-phone::after{
      content:"";position:absolute;top:23px;left:calc(50% + 27px);z-index:21;width:6px;height:6px;border-radius:50%;background:#102a44;
      box-shadow:inset 0 0 0 1px rgba(71,110,147,.45),0 0 3px rgba(44,92,138,.35);
    }
    html.vms-portal-phase2 .linkhub-phone-screen{
      width:100%!important;height:100%!important;min-height:0!important;border-radius:35px!important;overflow-y:auto!important;overflow-x:hidden!important;
      padding:58px 17px 22px!important;scrollbar-width:none;
    }
    html.vms-portal-phase2 .linkhub-phone-screen::-webkit-scrollbar{display:none}
    html.vms-portal-phase2 .linkhub-phone-photo{width:68px!important;height:68px!important}
    html.vms-portal-phase2 .linkhub-phone h3{font-size:17px!important}
    html.vms-portal-phase2 .linkhub-phone p{font-size:9.5px!important;line-height:1.5!important}

    /* Published LinkHub share block */
    html.vms-portal-phase2 .vms-linkhub-share{border-radius:17px!important;padding:16px!important;box-shadow:var(--vms-p2-shadow)!important}
    html.vms-portal-phase2 .vms-linkhub-share-head strong{font-size:14px!important}
    html.vms-portal-phase2 .vms-linkhub-share-head span{font-size:10.5px!important;line-height:1.45!important}
    html.vms-portal-phase2 .vms-linkhub-pubstatus{font-size:9px!important;padding:7px 10px!important}
    html.vms-portal-phase2 .vms-linkhub-urlbox label{font-size:10px!important}
    html.vms-portal-phase2 .vms-linkhub-urlrow input{height:46px!important;border-radius:11px!important;font-size:11px!important}

    /* Billing Center overrides */
    html.vms-portal-phase2 #section-billing .vms-billing-head{margin-bottom:17px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-head h2{font-size:27px!important;line-height:1.06!important}
    html.vms-portal-phase2 #section-billing .vms-billing-head p{font-size:12px!important;line-height:1.55!important}
    html.vms-portal-phase2 #section-billing .vms-billing-provider{font-size:10px!important;padding:8px 11px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-hero{gap:14px!important;margin-bottom:14px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-primary{min-height:180px!important;border-radius:20px!important;padding:22px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-kicker{font-size:10px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-primary strong{font-size:34px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-primary p{font-size:11px!important;line-height:1.5!important}
    html.vms-portal-phase2 #section-billing .vms-billing-quick{gap:10px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-quick-card{border-radius:16px!important;padding:15px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-quick-card span{font-size:9.5px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-quick-card strong{font-size:14px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-grid{gap:14px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-stack{gap:14px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-card{padding:17px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-card-head h3{font-size:15px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-card-head p{font-size:10.5px!important;line-height:1.5!important}
    html.vms-portal-phase2 #section-billing .vms-sub-row{border-radius:14px!important;padding:13px!important}
    html.vms-portal-phase2 #section-billing .vms-sub-title strong{font-size:12px!important}
    html.vms-portal-phase2 #section-billing .vms-sub-meta{font-size:10px!important}
    html.vms-portal-phase2 #section-billing .vms-sub-price strong{font-size:14px!important}
    html.vms-portal-phase2 #section-billing .vms-sub-price span{font-size:9px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-badge{font-size:9px!important;padding:6px 9px!important}
    html.vms-portal-phase2 #section-billing .vms-invoice-row strong{font-size:11.5px!important}
    html.vms-portal-phase2 #section-billing .vms-invoice-row span{font-size:9.5px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-action{border-radius:14px!important;padding:13px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-action strong{font-size:11.5px!important}
    html.vms-portal-phase2 #section-billing .vms-billing-action span{font-size:10px!important;line-height:1.45!important}
    html.vms-portal-phase2 #section-billing .vms-billing-note{font-size:10px!important;line-height:1.5!important;padding:12px!important;border-radius:13px!important}

    /* Modal system */
    html.vms-portal-phase2 .modal{border-radius:22px!important;box-shadow:0 30px 80px rgba(0,30,46,.22)!important;border:1px solid rgba(0,48,73,.10)!important}
    html.vms-portal-phase2 .modal-head{padding:17px 18px!important}
    html.vms-portal-phase2 .modal-head h3{font-size:16px!important;line-height:1.2!important}
    html.vms-portal-phase2 .modal-body{padding:18px!important;font-size:12px!important}
    html.vms-portal-phase2 .modal-foot{padding:14px 18px!important;gap:8px!important}
    html.vms-portal-phase2 .close{width:38px!important;height:38px!important;border-radius:11px!important}
    html.vms-portal-phase2 .floating-menu{width:210px!important;border-radius:13px!important;padding:6px!important}
    html.vms-portal-phase2 .floating-menu button{min-height:40px!important;border-radius:9px!important;font-size:11px!important}

    @media(max-width:1100px){
      html.vms-portal-phase2 .catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      html.vms-portal-phase2 .linkhub-layout{grid-template-columns:minmax(0,1fr) 290px!important}
      html.vms-portal-phase2 .linkhub-preview-wrap{max-width:290px!important}
    }

    @media(max-width:900px){
      html.vms-portal-phase2 .shell{grid-template-columns:1fr!important}
      html.vms-portal-phase2 .sidebar{
        position:fixed!important;inset:0 auto 0 0!important;width:min(86vw,315px)!important;min-width:0!important;max-width:315px!important;height:100dvh!important;
        transform:translate3d(-105%,0,0)!important;left:0!important;z-index:9999!important;transition:transform .22s cubic-bezier(.22,.61,.36,1)!important;
        box-shadow:18px 0 54px rgba(0,25,38,.27)!important;
      }
      html.vms-portal-phase2 .sidebar.open{transform:translate3d(0,0,0)!important}
      html.vms-portal-phase2 .nav button{min-height:46px!important;font-size:14px!important;padding:12px!important}
      html.vms-portal-phase2 .drawer-backdrop{z-index:9998!important;background:rgba(0,28,43,.44)!important;-webkit-backdrop-filter:blur(4px)!important;backdrop-filter:blur(4px)!important}
      html.vms-portal-phase2 .topbar{min-height:66px!important;padding:9px 13px!important}
      html.vms-portal-phase2 .mobile-menu{display:inline-flex!important}
      html.vms-portal-phase2 .topbar-left small{font-size:9px!important}
      html.vms-portal-phase2 .topbar-left strong{font-size:19px!important;white-space:normal!important}
      html.vms-portal-phase2 .topbar-actions .desktop-only{display:none!important}
      html.vms-portal-phase2 .content{padding:16px 13px 34px!important}
      html.vms-portal-phase2 .intro{display:block!important;margin-bottom:13px!important}
      html.vms-portal-phase2 .intro p{font-size:12.5px!important;line-height:1.55!important}
      html.vms-portal-phase2 .intro-actions{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;justify-content:flex-start!important;margin-top:10px!important;padding-bottom:2px!important;scrollbar-width:none}
      html.vms-portal-phase2 .intro-actions::-webkit-scrollbar{display:none}
      html.vms-portal-phase2 .intro-actions .btn,html.vms-portal-phase2 .intro-actions .badge{flex:0 0 auto!important;width:auto!important;white-space:nowrap!important}

      /* Keep summary metrics in one swipeable row to reduce vertical scrolling. */
      html.vms-portal-phase2 .status-strip{
        display:flex!important;gap:9px!important;overflow-x:auto!important;scroll-snap-type:x proximity!important;padding:1px 1px 8px!important;margin:0 -1px 12px!important;scrollbar-width:none!important;
      }
      html.vms-portal-phase2 .status-strip::-webkit-scrollbar{display:none}
      html.vms-portal-phase2 .status-strip .stat{flex:0 0 158px!important;min-height:96px!important;padding:14px!important;scroll-snap-align:start!important}
      html.vms-portal-phase2 .stat strong{font-size:25px!important}
      html.vms-portal-phase2 .stat small{font-size:10px!important;margin-top:6px!important}

      html.vms-portal-phase2 .grid{grid-template-columns:1fr!important;gap:11px!important}
      html.vms-portal-phase2 .card{padding:14px!important;border-radius:16px!important}
      html.vms-portal-phase2 .card-head{margin-bottom:12px!important}
      html.vms-portal-phase2 .card-head h3,html.vms-portal-phase2 .linkhub-panel-head h3{font-size:15px!important}
      html.vms-portal-phase2 .list-item{padding:12px!important}
      html.vms-portal-phase2 .service-grid{grid-template-columns:1fr!important;gap:9px!important}
      html.vms-portal-phase2 .service-card{min-height:0!important;padding:14px!important;gap:10px!important}
      html.vms-portal-phase2 .catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
      html.vms-portal-phase2 .catalog-card{min-height:168px!important;padding:13px!important}
      html.vms-portal-phase2 .catalog-card h4{font-size:12.5px!important}
      html.vms-portal-phase2 .catalog-card p{font-size:10px!important}
      html.vms-portal-phase2 .qr-card{grid-template-columns:82px minmax(0,1fr)!important;gap:11px!important}
      html.vms-portal-phase2 .qr-preview{width:82px!important;height:82px!important}
      html.vms-portal-phase2 .qr-card>.list-actions{grid-column:1/-1!important;display:flex!important;gap:7px!important}
      html.vms-portal-phase2 .qr-card>.list-actions .btn{flex:1 1 0!important}
      html.vms-portal-phase2 .kv{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
      html.vms-portal-phase2 .kv-item{padding:10px!important;border-radius:12px!important}
      html.vms-portal-phase2 .kv-item span{font-size:9px!important}
      html.vms-portal-phase2 .kv-item strong{font-size:11px!important}
      html.vms-portal-phase2 .notification-toolbar{display:flex!important;align-items:flex-start!important;gap:8px!important;overflow-x:auto!important;padding-bottom:3px!important}
      html.vms-portal-phase2 .filter-chips{flex-wrap:nowrap!important;overflow-x:auto!important;scrollbar-width:none!important}
      html.vms-portal-phase2 .filter-chips::-webkit-scrollbar{display:none}
      html.vms-portal-phase2 .chip{flex:0 0 auto!important;font-size:10px!important;padding:8px 11px!important}

      html.vms-portal-phase2 .linkhub-layout{grid-template-columns:1fr!important;gap:12px!important}
      html.vms-portal-phase2 .linkhub-preview-wrap{position:static!important;max-width:270px!important;order:-1!important;margin:0 auto 4px!important}
      html.vms-portal-phase2 .linkhub-panel{padding:14px!important;border-radius:16px!important}
      html.vms-portal-phase2 .optional-feature-grid{grid-template-columns:1fr!important}
      html.vms-portal-phase2 .link-editor-row,html.vms-portal-phase2 .social-row{grid-template-columns:auto minmax(0,1fr) auto!important}
      html.vms-portal-phase2 .mini-actions{flex-wrap:nowrap!important}
      html.vms-portal-phase2 .linkhub-phone{border-radius:39px!important}
      html.vms-portal-phase2 .linkhub-phone-screen{border-radius:32px!important;padding:54px 15px 20px!important}

      html.vms-portal-phase2 #section-billing .vms-billing-head{gap:8px!important;margin-bottom:13px!important}
      html.vms-portal-phase2 #section-billing .vms-billing-head h2{font-size:23px!important}
      html.vms-portal-phase2 #section-billing .vms-billing-head p{font-size:11px!important}
      html.vms-portal-phase2 #section-billing .vms-billing-hero,
      html.vms-portal-phase2 #section-billing .vms-billing-grid{grid-template-columns:1fr!important}
      html.vms-portal-phase2 #section-billing .vms-billing-primary{min-height:150px!important;padding:18px!important;border-radius:18px!important}
      html.vms-portal-phase2 #section-billing .vms-billing-primary strong{font-size:29px!important}
      html.vms-portal-phase2 #section-billing .vms-billing-quick{grid-template-columns:1fr 1fr!important;gap:8px!important}
      html.vms-portal-phase2 #section-billing .vms-billing-quick-card{padding:12px!important;border-radius:14px!important}
      html.vms-portal-phase2 #section-billing .vms-sub-row{grid-template-columns:1fr auto!important;gap:8px!important;padding:11px!important}
      html.vms-portal-phase2 #section-billing .vms-sub-price{text-align:right!important;display:block!important}
      html.vms-portal-phase2 #section-billing .vms-billing-action{align-items:flex-start!important;flex-direction:column!important}
      html.vms-portal-phase2 #section-billing .vms-billing-action .btn{width:100%!important}

      html.vms-portal-phase2 .field input,html.vms-portal-phase2 .field select,html.vms-portal-phase2 .field textarea{font-size:16px!important} /* prevent iOS zoom */
      html.vms-portal-phase2 .modal-backdrop{padding:0!important;align-items:flex-end!important}
      html.vms-portal-phase2 .modal{width:100%!important;max-height:94dvh!important;border-radius:20px 20px 0 0!important}
      html.vms-portal-phase2 .modal-head{padding:15px!important}
      html.vms-portal-phase2 .modal-body{padding:15px!important}
      html.vms-portal-phase2 .modal-foot{position:sticky!important;bottom:0!important;z-index:3!important;padding:11px!important;background:rgba(255,255,255,.96)!important;-webkit-backdrop-filter:blur(14px)!important;backdrop-filter:blur(14px)!important}
      html.vms-portal-phase2 .modal-foot .btn{min-height:44px!important}
      html.vms-portal-phase2 #section-billing .vms-billing-modal{place-items:end center!important;padding:0!important}
      html.vms-portal-phase2 #section-billing .vms-billing-dialog{width:100%!important;border-radius:20px 20px 0 0!important}
    }

    @media(max-width:520px){
      html.vms-portal-phase2 .catalog-grid{grid-template-columns:1fr!important}
      html.vms-portal-phase2 .catalog-card{min-height:0!important}
      html.vms-portal-phase2 .contact-choice{display:flex!important;grid-template-columns:none!important;gap:8px!important;overflow-x:auto!important;scroll-snap-type:x proximity!important;scrollbar-width:none!important}
      html.vms-portal-phase2 .contact-choice::-webkit-scrollbar{display:none}
      html.vms-portal-phase2 .choice{flex:0 0 76%!important;scroll-snap-align:start!important}
      html.vms-portal-phase2 .list-actions{display:flex!important;flex-wrap:wrap!important;gap:7px!important}
      html.vms-portal-phase2 .list-actions .btn{flex:1 1 130px!important;width:auto!important}
      html.vms-portal-phase2 .kv{grid-template-columns:1fr 1fr!important}
      html.vms-portal-phase2 .linkhub-preview-wrap{max-width:252px!important}
      html.vms-portal-phase2 #section-billing .vms-sub-row{grid-template-columns:1fr!important}
      html.vms-portal-phase2 #section-billing .vms-sub-price{text-align:left!important;display:flex!important;align-items:baseline!important;gap:5px!important}
    }
  `;

  function install(){
    document.documentElement.classList.add('vms-portal-phase2');
    if(!document.getElementById(style.id))document.head.appendChild(style);
  }

  install();
  /* Existing LinkHub/Billing modules inject their own styles after page load.
     Keep this Phase 2 layer last in the cascade without rebuilding their logic. */
  [80,2200,6000].forEach(ms=>setTimeout(()=>{
    if(style.parentNode)style.parentNode.appendChild(style);
  },ms));
})();

/* ============================================================
   VMS PHASE 3 — REAL BILLING & STRIPE CHECKOUT
   Client Portal wiring only. Secrets stay in Netlify Functions.
   ============================================================ */
(()=>{
  const path=String(location.pathname||'').toLowerCase();
  if(!(path==='/portal'||path==='/portal/'||path.startsWith('/portal/')))return;
  if(document.documentElement.dataset.vmsShell==='portal-v2')return; /* Client Portal v2 (assets/vms-portal.js) owns this page. */
  if(window.__VMS_PHASE3_BILLING__)return;window.__VMS_PHASE3_BILLING__=true;

  let pendingBuyKey='';
  let accountCache=null;
  let accountLoadedAt=0;
  let accountLoading=null;

  async function sessionToken(){
    if(!window.VMSAuth?.client)throw new Error('Client Portal session is not ready.');
    const sb=await VMSAuth.client();
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Please sign in again.');
    return session.access_token;
  }

  async function api(path,method='GET',body){
    const token=await sessionToken();
    const res=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const json=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(json.error||`Billing request failed (${res.status}).`);
    return json;
  }

  function notice(message,tone='success'){
    let el=document.getElementById('vmsPhase3BillingNotice');
    if(!el){
      el=document.createElement('div');el.id='vmsPhase3BillingNotice';
      Object.assign(el.style,{position:'fixed',left:'50%',bottom:'22px',transform:'translate(-50%,20px)',opacity:'0',zIndex:'2147483000',maxWidth:'min(92vw,520px)',padding:'12px 15px',borderRadius:'14px',font:'750 12px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',boxShadow:'0 18px 48px rgba(0,35,52,.2)',transition:'.2s ease',textAlign:'center'});
      document.body.appendChild(el);
    }
    el.textContent=message;
    el.style.background=tone==='error'?'#fff0f1':'#003049';
    el.style.color=tone==='error'?'#A8222E':'#fff';
    el.style.border=tone==='error'?'1px solid #efcbd0':'1px solid rgba(255,255,255,.12)';
    requestAnimationFrame(()=>{el.style.opacity='1';el.style.transform='translate(-50%,0)'});
    clearTimeout(window.__vmsP3NoticeTimer);window.__vmsP3NoticeTimer=setTimeout(()=>{el.style.opacity='0';el.style.transform='translate(-50%,20px)'},4200);
  }

  async function startCheckout(serviceKey,button){
    const original=button.textContent;
    button.disabled=true;button.textContent='Opening secure checkout…';
    const modal=document.getElementById('serviceActionModal');
    const body=document.getElementById('serviceActionBody');
    try{
      const result=await api('/api/billing-checkout','POST',{serviceKey});
      if(!result?.url)throw new Error('Stripe did not return a checkout page.');
      if(body){
        let status=body.querySelector('[data-vms-phase3-checkout-status]');
        if(!status){status=document.createElement('div');status.dataset.vmsPhase3CheckoutStatus='1';status.className='note';status.style.marginTop='10px';body.appendChild(status)}
        status.textContent=result.activationFee>0?`Secure checkout ready. Your first paid VMS order includes the $${Number(result.activationFee).toFixed(2)} activation fee.`:'Secure checkout ready. Redirecting to Stripe…';
      }
      window.location.assign(result.url);
    }catch(e){
      button.disabled=false;button.textContent=original;
      if(body){
        let status=body.querySelector('[data-vms-phase3-checkout-status]');
        if(!status){status=document.createElement('div');status.dataset.vmsPhase3CheckoutStatus='1';status.className='note';status.style.marginTop='10px';body.appendChild(status)}
        status.textContent=e?.message||'Checkout could not start.';
      }else notice(e?.message||'Checkout could not start.','error');
      modal?.classList.add('show');
    }
  }

  async function loadAccount(force=false){
    if(!force&&accountCache&&(Date.now()-accountLoadedAt)<60000)return accountCache;
    if(accountLoading)return accountLoading;
    accountLoading=api('/api/billing-account').then(data=>{accountCache=data;accountLoadedAt=Date.now();return data}).catch(e=>{accountCache={connected:false,error:e?.message||'Billing account unavailable'};accountLoadedAt=Date.now();return accountCache}).finally(()=>{accountLoading=null});
    return accountLoading;
  }

  async function openBillingPortal(action='portal'){
    try{
      notice('Opening secure billing portal…');
      const result=await api('/api/billing-account','POST',{action});
      if(!result?.url)throw new Error('Secure billing portal is unavailable.');
      window.location.assign(result.url);
    }catch(e){notice(e?.message||'Could not open billing portal.','error')}
  }

  function quickCard(label){
    return [...document.querySelectorAll('#section-billing .vms-billing-quick-card')].find(card=>String(card.querySelector('span')?.textContent||'').trim().toUpperCase()===label)?.querySelector('strong');
  }

  async function bindBillingControls(){
    const section=document.getElementById('section-billing');
    if(!section||!section.classList.contains('vms-billing-center'))return;
    const account=await loadAccount(false);
    const payment=quickCard('PAYMENT METHOD');
    if(payment&&account?.connected&&account?.paymentMethodLabel)payment.textContent=account.paymentMethodLabel;

    const provider=section.querySelector('.vms-billing-provider');
    if(provider&&account?.connected){provider.classList.add('live');provider.textContent=account.livemode?'Live Stripe billing':'Stripe test billing'}

    const manage=section.querySelector('[data-vms-payment-manage]');
    if(manage&&account?.connected){
      manage.removeAttribute('disabled');manage.textContent='Manage Payment';
      if(manage.dataset.vmsP3!=='1'){
        manage.dataset.vmsP3='1';
        manage.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openBillingPortal('payment_method')},true);
      }
      const copy=manage.closest('.vms-billing-action')?.querySelector('span');if(copy)copy.textContent='Update your saved payment method securely through Stripe.';
    }

    const cancel=section.querySelector('[data-vms-billing-action="cancel"]');
    if(cancel&&account?.connected){
      cancel.textContent='Manage / Cancel';cancel.classList.remove('red');
      const copy=cancel.closest('.vms-billing-action')?.querySelector('span');if(copy)copy.textContent='Open your secure billing portal to review or cancel Stripe subscriptions.';
      if(cancel.dataset.vmsP3!=='1'){
        cancel.dataset.vmsP3='1';
        cancel.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openBillingPortal('portal')},true);
      }
    }
  }

  document.addEventListener('click',e=>{
    const serviceButton=e.target.closest?.('[data-service-action]');
    if(serviceButton){pendingBuyKey=/start purchase/i.test(serviceButton.textContent||'')?serviceButton.dataset.serviceAction||'':'';return}
    const confirm=e.target.closest?.('#confirmServiceActionBtn');
    if(confirm&&pendingBuyKey&&/continue to checkout/i.test(confirm.textContent||'')){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const key=pendingBuyKey;pendingBuyKey='';startCheckout(key,confirm);
    }
  },true);

  function handleReturn(){
    const url=new URL(location.href);const state=url.searchParams.get('billing');if(!state)return;
    if(state==='success'){
      notice('Payment completed. VMS is syncing your service and receipt now.');
      accountCache=null;accountLoadedAt=0;
      setTimeout(()=>document.querySelector('[data-section="billing"]')?.click(),350);
      setTimeout(()=>bindBillingControls(),1800);
    }else if(state==='cancel')notice('Checkout canceled — no payment was completed.','error');
    else if(state==='portal-return'){notice('Billing settings updated.');accountCache=null;accountLoadedAt=0;setTimeout(()=>bindBillingControls(),500)}
    url.searchParams.delete('billing');url.searchParams.delete('session_id');history.replaceState({},'',url.pathname+(url.search?url.search:'')+url.hash);
  }

  handleReturn();
  [1800,3600,6000].forEach(ms=>setTimeout(bindBillingControls,ms));
  setInterval(bindBillingControls,12000);
  window.addEventListener('focus',()=>{accountCache=null;accountLoadedAt=0;bindBillingControls()});
})();
