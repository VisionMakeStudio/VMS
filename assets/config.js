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
      x:`<svg ${common}><path d="M5 4 19 20M19 4 5 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
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
      if(icon){
        const platform=platformFromRow(row);
        icon.innerHTML=iconSvg(platform);
        icon.setAttribute('aria-label',platform||'Social');
      }
    });
    const preview=[...document.querySelectorAll('#section-linkhub .linkhub-public-social')];
    preview.forEach((button,i)=>{
      const platform=platformFromRow(rows[i])||button.title||'Website';
      button.innerHTML=iconSvg(platform);
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
      .vms-linkhub-mobile-publish{display:none}
      @media(max-width:760px){
        .vms-linkhub-share{padding:12px}.vms-linkhub-share-head{display:grid}.vms-linkhub-share-grid{grid-template-columns:1fr}.vms-linkhub-urlrow{grid-template-columns:1fr 1fr}.vms-linkhub-urlrow input{grid-column:1/-1;height:46px;font-size:10px}.vms-linkhub-urlrow .btn{width:100%}.vms-linkhub-share-actions{display:grid;grid-template-columns:1fr}.vms-linkhub-share-actions .btn{width:100%;min-height:46px}.vms-linkhub-qr{min-height:160px}.vms-linkhub-qr svg{width:142px!important;height:142px!important}
        .vms-linkhub-mobile-publish{display:block;position:sticky;bottom:8px;z-index:15;margin:12px 0 0;padding:8px;background:rgba(255,255,255,.94);border:1px solid #dfe8ec;border-radius:13px;box-shadow:0 12px 30px rgba(0,48,73,.16);backdrop-filter:blur(12px)}
        .vms-linkhub-mobile-publish button{width:100%;min-height:48px}
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
    if(!token)throw new Error('Client Portal session is not ready.');
    const res=await fetch(API+(method==='GET'?'?mine=1':''),{
      method,
      headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    });
    const json=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(json.error||'LinkHub request failed.');
    return json;
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
    const intro=section.querySelector('.intro');
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
      </div>`;
    if(intro?.nextSibling)section.insertBefore(panel,intro.nextSibling);else section.prepend(panel);

    const mobile=document.createElement('div');
    mobile.className='vms-linkhub-mobile-publish';
    mobile.innerHTML='<button class="btn primary" id="vmsLinkHubMobilePublishBtn" type="button">Publish LinkHub Changes</button>';
    section.appendChild(mobile);

    $('vmsLinkHubCopyBtn').onclick=async()=>{
      const url=$('vmsLinkHubPublicUrl').value;
      if(!url)return;
      try{await navigator.clipboard.writeText(url);setStatus('Link copied','live')}catch{prompt('Copy your LinkHub link:',url)}
    };
    $('vmsLinkHubOpenBtn').onclick=()=>{const url=$('vmsLinkHubPublicUrl').value;if(url)window.open(url,'_blank','noopener')};
    const publish=()=>{
      lastPublishError='';
      setStatus('Publishing…');
      const native=$('saveLinkHubBtn');
      if(native)native.click();else setStatus('Publish control unavailable','error');
    };
    $('vmsLinkHubPublishBtn').onclick=publish;
    $('vmsLinkHubMobilePublishBtn').onclick=publish;
    $('vmsLinkHubDownloadQrBtn').onclick=downloadQr;

    const native=$('saveLinkHubBtn');
    if(native){native.textContent='Publish Changes';native.addEventListener('click',()=>setStatus('Publishing…'),true)}
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
      if(e.target.closest('#vmsLinkHubSharePanel,.vms-linkhub-mobile-publish,#saveLinkHubBtn,#requestLinkHubHelpBtn'))return;
      if(e.target.closest('button'))markDirty();
    },true);
  }

  function installFetchPublishBridge(){
    if(window.__VMS_LINKHUB_PUBLISH_FETCH__)return;
    window.__VMS_LINKHUB_PUBLISH_FETCH__=true;
    const original=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const response=await original(input,init);
      try{
        const url=typeof input==='string'?new URL(input,location.origin):new URL(input.url,location.origin);
        if(url.origin===location.origin&&url.pathname==='/api/client-event'&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
          const body=JSON.parse(init.body);
          if(body?.type==='client_linkhub_updated'&&response.ok){
            const headers=new Headers(init.headers||{});
            const token=headers.get('Authorization')||headers.get('authorization')||'';
            const pub=await original(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':token},body:JSON.stringify({action:'publish',data:body.payload})});
            const result=await pub.json().catch(()=>({}));
            if(!pub.ok)throw new Error(result.error||'Publishing failed.');
            lastPublishError='';
            linkhubInfo=result;
            try{localStorage.removeItem(DIRTY_KEY);localStorage.setItem(CLOUD_VERSION_KEY,result.publishedAt||'')}catch{}
            updateSharePanel(result);
          }
        }
      }catch(e){
        lastPublishError=e?.message||'Publishing failed';
        console.error('VMS LinkHub publish bridge failed',e);
        setStatus(lastPublishError,'error');
      }
      return response;
    };
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
    installFetchPublishBridge();
    createSharePanel();
    installDirtyTracking();
    restoreSocialIcons();
    const observer=new MutationObserver(()=>restoreSocialIcons());
    const section=$('section-linkhub');
    if(section)observer.observe(section,{childList:true,subtree:true});
    loadInfo();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});
  else setTimeout(boot,0);
})();

