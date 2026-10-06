(()=>{
  if(document.documentElement.dataset.vmsShell==='v2')return; /* Admin v2 Audit page owns the live audit flow. */
  if(!/\/admin\/audit(?:\.html)?$/i.test(location.pathname))return;

  const CATS=['website','google','reviews','systems'];
  const DISPLAY={website:'Website',google:'Local Presence',reviews:'Reviews',systems:'Systems'};
  const cap=s=>s?String(s)[0].toUpperCase()+String(s).slice(1):'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function token(){
    const sb=await VMSAuth.client();
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Please sign in again.');
    return session.access_token;
  }
  function field(id){return document.getElementById(id)?.value?.trim?.()||''}
  function body(){
    let platforms=[];
    try{
      if(typeof REVIEW_PLATFORMS!=='undefined'&&Array.isArray(REVIEW_PLATFORMS)){
        platforms=REVIEW_PLATFORMS.map(p=>({name:p.name||p.platform||'',url:p.url||p.link||'',rating:p.rating??null,reviews:p.reviews??p.count??null})).slice(0,8);
      }
    }catch{}
    return {business_name:field('businessName'),industry:field('industry'),website_url:field('websiteUrl'),google_url:field('googleUrl'),internal_notes:field('overviewNotes'),review_platforms:platforms};
  }

  function style(){
    if(document.getElementById('vms-audit-ai-live-style'))return;
    const s=document.createElement('style');
    s.id='vms-audit-ai-live-style';
    s.textContent=`
      .vms-ai-live-meta{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
      .vms-ai-live-chip{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;background:#f0f5f7;color:#527080;font:850 9px/1 Inter,system-ui,sans-serif}
      .vms-ai-live-chip.good{background:#edf8f1;color:#28764a}.vms-ai-live-chip.warn{background:#fff6e8;color:#9a681d}
      .vms-ai-source-details,.vms-ai-tech-details{margin-top:9px;border-top:1px solid #e7edef;padding-top:8px}
      .vms-ai-source-details summary,.vms-ai-tech-details summary{cursor:pointer;color:#56717e;font-size:10px;font-weight:850}
      .vms-ai-source-list{display:grid;gap:5px;margin-top:7px}.vms-ai-source-list a{font-size:10px;color:#315f79;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vms-ai-source-list a:hover{text-decoration:underline}
      .vms-ai-live-note{margin-top:7px;font-size:9px;color:#7b8b93;line-height:1.45}.ai-check-result .vms-confidence{margin-left:5px;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#83949d}
      #runAiAudit[data-live-audit='true']{box-shadow:0 8px 22px rgba(0,48,73,.14)}
      .vms-manual-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;margin:0 0 10px;border:1px solid #dbe5e9;border-radius:12px;background:#f8fbfc;color:#526672;font-size:10px}
      .vms-manual-bar strong{display:block;color:#173041;font-size:11px;margin-bottom:2px}.vms-manual-bar button{border:1px solid #cad9df;background:#fff;color:#173041;border-radius:9px;padding:7px 9px;font-size:9px;font-weight:900;white-space:nowrap}
      .vms-priority-card{margin-top:16px;border:1px solid rgba(193,18,31,.25);background:#fff9f9;border-radius:15px;padding:14px}
      .vms-priority-card.is-empty{border-color:#dce6ea;background:#fbfcfd}.vms-priority-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}.vms-priority-head h3{font-size:15px;margin:0;color:#173041}.vms-priority-count{font-size:9px;font-weight:900;border-radius:999px;padding:5px 8px;background:#f7e4e6;color:#9e1722}
      .vms-priority-list{display:grid;gap:8px}.vms-priority-item{border:1px solid #eadcdf;background:#fff;border-radius:11px;padding:10px}.vms-priority-item strong{display:block;color:#8d1721;font-size:11px;margin-bottom:4px}.vms-priority-item p{margin:0;color:#586b76;font-size:10px;line-height:1.45}.vms-priority-item .why{margin-top:4px;color:#7a5d61}.vms-priority-item a{display:inline-block;margin-top:6px;font-size:9px;color:#315f79;text-decoration:none;font-weight:850}
      .vms-next-steps{margin-top:12px;border:1px solid #dce6ea;background:#fff;border-radius:15px;padding:14px}.vms-next-steps h3{font-size:15px;color:#173041;margin:0 0 9px}.vms-next-step{padding:8px 0;border-top:1px solid #edf1f3}.vms-next-step:first-of-type{border-top:0}.vms-next-step strong{display:block;font-size:10px;color:#173041}.vms-next-step span{display:block;font-size:9px;color:#6f818c;margin-top:2px;line-height:1.4}
      .vms-submit-btn{background:#003049!important;color:#FDF0D5!important}.vms-submit-btn.is-done{background:#28764a!important;color:#fff!important}
      .vms-submit-feedback{position:fixed;right:16px;bottom:16px;z-index:2147483000;max-width:360px;border-radius:12px;padding:11px 13px;background:#173041;color:#fff;font:800 10px/1.4 Inter,system-ui,sans-serif;box-shadow:0 14px 36px rgba(0,0,0,.18)}
      .vms-submit-feedback.warn{background:#9a681d}.vms-submit-feedback.good{background:#28764a}
      .vms-reaudit-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 7px;background:#edf8f1;color:#28764a;font-size:8px;font-weight:900}
      .vms-report-priority{margin:8px 0 10px;border:1px solid #e6c9cc;background:#fff8f8;border-radius:10px;padding:10px}.vms-report-priority h3{font-size:11px;margin:0 0 7px;color:#8d1721}.vms-report-priority-item{font-size:9px;color:#5e6870;line-height:1.35;margin-top:5px}.vms-report-priority-item:first-of-type{margin-top:0}
      .assistant-status.error{background:#fff0f1!important;color:#9e1722!important}.assistant-status.running{background:#eef7fb!important;color:#315f79!important}
      .vms-report-link-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #e4ebee}.vms-report-link-controls label{display:flex;align-items:center;gap:7px;color:#5d737f;font-size:12px;font-weight:800}.vms-report-link-controls select{min-height:38px;border:1px solid #cedbe0;border-radius:9px;background:#fff;color:#173041;padding:0 9px;font-size:13px}.vms-report-link-controls .btn{min-height:38px!important}.vms-report-danger{color:#9e1722!important;border-color:#e1c4c7!important}
      .vms-ai-live-chip,.vms-priority-count,.vms-reaudit-badge{font-size:10px}.vms-ai-live-note,.vms-priority-item a,.vms-next-step span,.vms-report-priority-item{font-size:11px}.vms-ai-source-details summary,.vms-ai-tech-details summary,.vms-priority-item p,.vms-next-step strong,.vms-manual-bar{font-size:12px}.vms-priority-item strong,.vms-manual-bar strong{font-size:13px}
      @media(max-width:700px){.vms-manual-bar{align-items:flex-start;flex-direction:column}.vms-manual-bar button{width:100%}.vms-submit-feedback{left:12px;right:12px;bottom:12px;max-width:none}.vms-report-link-controls{display:grid;grid-template-columns:1fr}.vms-report-link-controls label{justify-content:space-between}.vms-report-link-controls select,.vms-report-link-controls .btn{width:100%}}

      /* Client report mode must be completely separate from the unified Admin shell. */
      body.vms-unified-admin.client-mode{padding:0!important;margin:0!important;background:#eef3f5!important;overflow-x:hidden!important}
      body.vms-unified-admin.client-mode #vms-admin-sidebar,
      body.vms-unified-admin.client-mode #vms-admin-topbar,
      body.vms-unified-admin.client-mode #vms-admin-backdrop,
      body.vms-unified-admin.client-mode .vms-audit-workspace-tabs,
      body.vms-unified-admin.client-mode .audit-subnav-wrap,
      body.vms-unified-admin.client-mode .workspace-steps,
      body.vms-unified-admin.client-mode .workspace-savebar{display:none!important}
      body.vms-unified-admin.client-mode .main{margin:0!important;padding:0!important;width:100%!important;max-width:none!important}
      body.vms-unified-admin.client-mode .content{max-width:980px!important;margin:0 auto!important;padding:28px 18px 60px!important}

      @media print{
        #vms-admin-sidebar,#vms-admin-topbar,#vms-admin-backdrop,.vms-audit-workspace-tabs,.audit-subnav-wrap,.workspace-steps,.workspace-savebar,
        .vms-manual-bar,.vms-ai-tech-details,.vms-ai-source-details,.vms-submit-feedback{display:none!important}
        body.vms-unified-admin,body.vms-unified-admin.client-mode{padding:0!important;margin:0!important;background:#fff!important;overflow:visible!important}
        body.vms-unified-admin .main,body.vms-unified-admin.client-mode .main{margin:0!important;padding:0!important;width:100%!important;max-width:none!important}
        body.vms-unified-admin .content,body.vms-unified-admin.client-mode .content{padding:0!important;margin:0!important;max-width:none!important;width:100%!important}
        body.vms-printing-audit-report *{visibility:hidden!important}
        body.vms-printing-audit-report #printReport,body.vms-printing-audit-report #printReport *{visibility:visible!important}
        body.vms-printing-audit-report #printReport{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important}
      }
    `;
    document.head.appendChild(s);
  }

  function setState(text,kind=''){
    const el=document.getElementById('aiState');
    if(el){el.textContent=text;el.className='assistant-status ai-state'+(kind?' '+kind:'')}
  }

  function localPresenceLabels(){
    const nav=document.querySelector('.workspace-steps [data-view="google"]');if(nav)nav.textContent='Local Presence';
    const v=document.getElementById('view-google');if(v){
      const eyebrow=v.querySelector('.audit-page-head .eyebrow');if(eyebrow)eyebrow.textContent='Local Presence Audit';
      const h=v.querySelector('.audit-page-head h1');if(h)h.textContent='Local Presence';
      const ah=v.querySelector('#aiCard-google h3');if(ah)ah.textContent='Local Presence';
      v.querySelectorAll('.item-title').forEach(el=>{
        if(el.textContent.trim()==='Google Business Profile setup')el.textContent='Primary local profile setup';
        if(el.textContent.trim()==='Google matches website/business info')el.textContent='Listings match website/business info';
      });
    }
    const mini=document.getElementById('aiMiniGoogle')?.parentElement?.querySelector('span');if(mini)mini.textContent='Local Presence';
    const report=document.getElementById('reportGoogle')?.closest('.report-cat')?.querySelector('span');if(report)report.textContent='Local Presence';
    const print=document.getElementById('printGoogle')?.parentElement?.parentElement?.querySelector('span');if(print)print.textContent='Local Presence';
    document.querySelectorAll('.history-category-row div:nth-child(2) span,.report-breakdown-head h3').forEach(el=>{if(el.textContent.trim()==='Google')el.textContent='Local Presence'});
    const rec=document.getElementById('reportRec');if(rec&&/Prioritize Google Business Profile improvements\.?/i.test(rec.textContent))rec.textContent='Prioritize Local Presence and listing consistency improvements.';
  }

  function ensureTechDetails(){
    let d=document.getElementById('vms-ai-tech-details');if(d)return d;
    const host=document.querySelector('.overview-assistant');if(!host)return null;
    d=document.createElement('details');d.id='vms-ai-tech-details';d.className='vms-ai-tech-details';d.hidden=true;d.innerHTML='<summary>View technical details</summary><div class="vms-ai-live-note" id="vms-ai-tech-text"></div>';
    host.appendChild(d);return d;
  }
  function setTechDetails(text=''){
    const d=ensureTechDetails();if(!d)return;const t=d.querySelector('#vms-ai-tech-text');if(t)t.textContent=text;d.hidden=!text;if(!text)d.open=false;
  }

  function ensureManualControls(cat){
    const list=document.getElementById(cat+'List');if(!list||document.getElementById('vms-manual-'+cat))return;
    const bar=document.createElement('div');bar.id='vms-manual-'+cat;bar.className='vms-manual-bar';bar.innerHTML=`<div><strong>Manual scoring is always available</strong><span>Choose the VMS rubric option you can verify. Use N/A instead of guessing.</span></div><button type="button" data-vms-na="${cat}">Mark unanswered N/A</button>`;
    list.parentElement?.insertBefore(bar,list);
  }
  function repaintCategory(cat){
    try{
      if(typeof D==='undefined'||typeof S==='undefined')return;
      D[cat].forEach((item,idx)=>{
        const [id,,max,,opts]=item;const v=S[cat][id];const itemEl=document.querySelector(`#${cat}List .item:nth-child(${idx+1})`);if(!itemEl)return;
        const buttons=[...itemEl.querySelectorAll('.opt')];buttons.forEach(b=>b.classList.remove('sel'));
        if(Object.prototype.hasOwnProperty.call(S[cat],id)){
          const wi=opts.findIndex(o=>o[1]===v);if(buttons[wi])buttons[wi].classList.add('sel');
        }
        const scoreEl=document.getElementById(`${cat}-${id}-score`);if(scoreEl)scoreEl.textContent=!Object.prototype.hasOwnProperty.call(S[cat],id)?`— / ${max}`:(v===null?'N/A':`${v} / ${max}`);
      });
      if(typeof update==='function')update();
      if(typeof updateCompletionUI==='function')updateCompletionUI();
      if(typeof scheduleAutosave==='function')scheduleAutosave();
    }catch(e){console.warn('Manual scoring repaint failed.',e)}
  }
  function markUnansweredNA(cat){
    try{
      if(typeof D==='undefined'||typeof S==='undefined')return;
      D[cat].forEach(([id])=>{if(!Object.prototype.hasOwnProperty.call(S[cat],id))S[cat][id]=null});
      repaintCategory(cat);
      feedback(`${DISPLAY[cat]}: unanswered checks marked N/A.`,'good');
    }catch(e){console.warn(e)}
  }

  function ensurePriorityHosts(){
    const overview=document.getElementById('view-overview');const grid=overview?.querySelector('.overview-grid');
    if(overview&&grid&&!document.getElementById('vms-priority-findings')){
      const host=document.createElement('section');host.id='vms-priority-findings';host.className='vms-priority-card is-empty';host.innerHTML='<div class="vms-priority-head"><h3>Priority Findings</h3><span class="vms-priority-count">None flagged</span></div><div class="vms-priority-list"><div class="vms-ai-live-note">Run the audit or add manual findings. Serious issues will be separated from ordinary score deductions here.</div></div>';
      grid.insertAdjacentElement('afterend',host);
      const steps=document.createElement('section');steps.id='vms-next-steps';steps.className='vms-next-steps';steps.hidden=true;steps.innerHTML='<h3>Recommended Next Steps</h3><div class="vms-next-steps-list"></div>';host.insertAdjacentElement('afterend',steps);
    }
  }
  function renderPriority(result){
    ensurePriorityHosts();
    const host=document.getElementById('vms-priority-findings');if(!host)return;
    let items=Array.isArray(result?.priority_findings)?result.priority_findings:[];
    if(!items.length)items=(result?.recommendations||[]).filter(x=>x.priority==='high').slice(0,4).map(x=>({severity:'high',category:x.category,title:x.title,finding:x.why,why_it_matters:x.next_step,source_urls:[]}));
    const count=host.querySelector('.vms-priority-count');const list=host.querySelector('.vms-priority-list');
    if(!items.length){host.classList.add('is-empty');if(count)count.textContent='None flagged';if(list)list.innerHTML='<div class="vms-ai-live-note">No priority-level issue was verified from the available evidence.</div>'}
    else{
      host.classList.remove('is-empty');if(count)count.textContent=`${items.length} flagged`;
      if(list)list.innerHTML=items.map(x=>`<article class="vms-priority-item"><strong>⚠ ${esc(x.title||'Priority finding')} · ${esc(DISPLAY[x.category]||cap(x.category))}</strong><p>${esc(x.finding||'')}</p>${x.why_it_matters?`<p class="why">Why it matters: ${esc(x.why_it_matters)}</p>`:''}${(x.source_urls||[])[0]?`<a href="${esc((x.source_urls||[])[0])}" target="_blank" rel="noopener noreferrer">Open evidence</a>`:''}</article>`).join('');
    }
    renderRecommendations(result);
    renderReportPriority(items);
  }
  function renderRecommendations(result){
    const host=document.getElementById('vms-next-steps');const list=host?.querySelector('.vms-next-steps-list');const recs=Array.isArray(result?.recommendations)?result.recommendations:[];
    if(!host||!list)return;host.hidden=!recs.length;if(!recs.length)return;
    list.innerHTML=recs.slice(0,6).map(r=>`<div class="vms-next-step"><strong>${esc(r.title||'Next step')} · ${esc(DISPLAY[r.category]||cap(r.category))}</strong><span>${esc(r.next_step||r.why||'')}</span></div>`).join('');
  }
  function renderReportPriority(items){
    const body=document.querySelector('#view-report .report-body');if(!body)return;
    let box=document.getElementById('vms-report-priority');if(box)box.remove();if(!items?.length)return;
    box=document.createElement('div');box.id='vms-report-priority';box.className='vms-report-priority';box.innerHTML=`<h3>Priority Findings</h3>${items.slice(0,4).map(x=>`<div class="vms-report-priority-item"><strong>${esc(x.title||'Priority finding')}:</strong> ${esc(x.finding||'')}</div>`).join('')}`;
    const meaning=document.getElementById('reportMeaning');if(meaning)meaning.insertAdjacentElement('afterend',box);else body.prepend(box);
  }

  function reasonMeta(cat,c){
    const reason=document.getElementById('aiReason-'+cat);if(!reason)return;
    let box=reason.parentElement?.querySelector('.vms-ai-live-meta');if(!box){box=document.createElement('div');box.className='vms-ai-live-meta';reason.insertAdjacentElement('afterend',box)}
    const count=(c.items||[]).filter(x=>typeof x.points==='number').length,total=(c.items||[]).length;
    box.innerHTML=`<span class="vms-ai-live-chip good">Live evidence</span><span class="vms-ai-live-chip">${count}/${total} checks assessed</span>${c.assessed_max<100?'<span class="vms-ai-live-chip warn">Manual checks remain</span>':''}`;
  }
  function sources(cat,c,result){
    const reason=document.getElementById('aiReason-'+cat);if(!reason)return;
    let d=reason.parentElement?.querySelector('.vms-ai-source-details');if(d)d.remove();
    const urls=new Set();(c.items||[]).forEach(i=>(i.source_urls||[]).forEach(u=>urls.add(u)));const matched=(result.sources||[]).filter(s=>urls.has(s.url)).slice(0,8);if(!matched.length)return;
    d=document.createElement('details');d.className='vms-ai-source-details';d.innerHTML=`<summary>View evidence (${matched.length})</summary><div class="vms-ai-source-list">${matched.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a>`).join('')}</div>`;reason.parentElement?.appendChild(d);
  }

  function paint(result){
    window.__VMS_AUDIT_AI_LIVE_STATE__=result;setTechDetails('');
    try{
      if(typeof AI_STATE!=='undefined'){
        AI_STATE.ready=true;
        CATS.forEach(cat=>{const c=result.categories?.[cat];if(!c)return;AI_STATE.scores[cat]=c.score;AI_STATE.reasons[cat]=c.reason;AI_STATE.selections[cat]={};(c.items||[]).forEach(i=>{if(typeof i.points==='number')AI_STATE.selections[cat][i.id]={points:i.points,label:i.label,title:i.title,max:i.max,evidence:i.evidence,confidence:i.confidence}})});
      }
    }catch(e){console.warn('Audit AI state could not be synchronized.',e)}

    CATS.forEach(cat=>{
      const c=result.categories?.[cat];if(!c)return;
      const score=document.getElementById('aiScore-'+cat);if(score)score.textContent=c.score==null?'—':String(c.score);
      const mini=document.getElementById('aiMini'+cap(cat));if(mini)mini.textContent=c.score==null?'—':String(c.score);
      const reason=document.getElementById('aiReason-'+cat);if(reason)reason.textContent=c.reason||'Manual review is still required for this section.';
      const note=document.getElementById(cat+'Ai');if(note)note.value=c.assessment_note||'';
      const accept=document.querySelector(`[data-ai-accept="${cat}"]`);if(accept)accept.disabled=!(c.items||[]).some(i=>typeof i.points==='number');
      try{if(typeof showAiCheckExplanations==='function')showAiCheckExplanations(cat)}catch{}
      (c.items||[]).forEach(i=>{
        const wrap=document.getElementById(`ai-check-${cat}-${i.id}`),res=document.getElementById(`ai-check-result-${cat}-${i.id}`),text=document.getElementById(`ai-check-text-${cat}-${i.id}`);
        if(wrap)wrap.classList.add('ready');
        if(res)res.innerHTML=i.points==null?`Needs manual review <span class="vms-confidence">${esc(i.confidence||'low')} confidence</span>`:`${esc(i.label)} • ${i.points}/${i.max}<span class="vms-confidence">${esc(i.confidence||'')} confidence</span>`;
        if(text)text.textContent=i.evidence||'No supporting evidence was available.';
      });
      reasonMeta(cat,c);sources(cat,c,result);
    });
    const overall=document.getElementById('aiOverallScore');if(overall)overall.textContent=result.overall_score==null?'—':String(result.overall_score);
    renderPriority(result);localPresenceLabels();setState('Live suggestions ready','ready');
    try{if(typeof scheduleAutosave==='function')scheduleAutosave();else if(typeof saveDraftSilently==='function')saveDraftSilently()}catch{}
  }

  function friendlyFailure(e){
    const status=e?.httpStatus||0,code=e?.code||'',stage=e?.stage||'';
    let publicText='Live Audit Assistant is temporarily unavailable. You can continue scoring manually.';
    if(status===401||status===403)publicText='Your secure admin session needs to be refreshed. Manual scoring is still available.';
    if(status===400)publicText='The live audit could not use one of the business links. Manual scoring is still available.';
    if(/quota|billing|credits|exceeded your current quota/i.test(String(e?.message||'')))publicText='The OpenAI API quota is currently unavailable. Your audit is safe and manual scoring remains available; re-run after the API quota or credits are available again.';
    const tech=[status?`HTTP ${status}`:'',code,stage,e?.message||''].filter(Boolean).join(' · ');
    setState('Live audit unavailable — manual scoring available','error');setTechDetails(tech);
    CATS.forEach(cat=>{const s=document.getElementById('aiScore-'+cat);if(s&&s.textContent==='…')s.textContent='—';const r=document.getElementById('aiReason-'+cat);if(r&&r.textContent==='Reviewing live evidence…')r.textContent=publicText;const m=document.getElementById('aiMini'+cap(cat));if(m&&m.textContent==='…')m.textContent='—'});
  }

  async function run(){
    const btn=document.getElementById('runAuditInsideAssistant')||document.getElementById('runAiAudit'),payload=body();
    if(!payload.business_name){setState('Add the business name first','error');document.getElementById('businessName')?.focus();return}
    if(btn){btn.disabled=true;btn.innerHTML='<span class="ai-loading"><span class="desktop-label">Running Live Audit</span><span class="mobile-label">Running…</span></span>'}
    setTechDetails('');setState('Checking website + public presence…','running');
    CATS.forEach(cat=>{const s=document.getElementById('aiScore-'+cat);if(s)s.textContent='…';const r=document.getElementById('aiReason-'+cat);if(r)r.textContent='Reviewing live evidence…';const m=document.getElementById('aiMini'+cap(cat));if(m)m.textContent='…'});
    try{
      const t=await token();
      const r=await fetch('/api/ai-audit',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){const err=new Error(d.error||`Audit request failed (${r.status}).`);err.httpStatus=r.status;err.code=d.code||'';err.stage=d.stage||'';throw err}
      if(!d?.result)throw new Error('Audit service returned no result.');
      paint(d.result);if(d.result?.warnings?.length)console.info('VMS Audit AI warnings:',d.result.warnings);
    }catch(e){console.error(e);friendlyFailure(e)}
    finally{if(btn){btn.disabled=false;btn.innerHTML='<span class="desktop-label">✦ Re-run Audit</span><span class="mobile-label">✦ Re-run</span>'}}
  }

  function clientReportPayload(){
    try{if(typeof update==='function')update()}catch{}
    const scores={};
    CATS.forEach(cat=>{try{scores[cat]=typeof score==='function'?score(cat):Number(document.getElementById('report'+cap(cat))?.textContent||0)}catch{scores[cat]=0}});
    const shownOverall=Number(document.getElementById('overallTotal')?.textContent||document.getElementById('overallScore')?.textContent||NaN);
    const vals=Object.values(scores).map(Number).filter(v=>Number.isFinite(v));
    const overall=Number.isFinite(shownOverall)?shownOverall:(vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0);
    const breakdown={};
    CATS.forEach(cat=>{
      const items=[];
      try{
        if(typeof D!=='undefined'&&typeof S!=='undefined')D[cat].forEach(([id,title,max,,opts])=>{
          if(!Object.prototype.hasOwnProperty.call(S[cat]||{},id))return;
          const v=S[cat][id];if(v===null||typeof v!=='number'||v>=max)return;
          const chosen=(opts||[]).find(o=>o[1]===v);
          items.push({title,label:chosen?.[0]||'Selected result',points:v,max,lost:max-v});
        });
      }catch{}
      items.sort((a,b)=>(b.lost||0)-(a.lost||0));
      breakdown[cat]={score:scores[cat]||0,items:items.slice(0,6),note:field(cat+'You')};
    });
    const live=window.__VMS_AUDIT_AI_LIVE_STATE__||{};
    return {
      v:2,
      business_name:field('businessName')||'Business Checkup',
      industry:field('industry')||'Business audit',
      scores,
      overall,
      grade:(typeof grade==='function'?grade(overall):''),
      meaning:document.getElementById('reportMeaning')?.textContent?.trim?.()||'',
      recommendation:document.getElementById('reportRec')?.textContent?.trim?.()||'',
      breakdown,
      priority_findings:Array.isArray(live.priority_findings)?live.priority_findings.slice(0,6):[],
      recommendations:Array.isArray(live.recommendations)?live.recommendations.slice(0,6):[],
      generated_at:new Date().toISOString()
    };
  }
  function encodeClientPayload(obj){return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))}
  function buildPublicClientLink(){
    const target=new URL('../audit-report.html',location.href);target.hash='report='+encodeClientPayload(clientReportPayload());return target.href;
  }
  let activeReportToken='';
  function ensureReportLinkControls(){
    const panel=document.getElementById('sharePanel');if(!panel)return null;
    let open=document.getElementById('openShareBtn');const row=panel.querySelector('.share-row');
    if(!open&&row){open=document.createElement('button');open.type='button';open.id='openShareBtn';open.className='btn light';const copy=document.getElementById('copyShareBtn');if(copy)row.insertBefore(open,copy);else row.appendChild(open)}
    if(open)open.textContent='View as Client';
    let controls=document.getElementById('vms-report-link-controls');
    if(!controls){
      controls=document.createElement('div');controls.id='vms-report-link-controls';controls.className='vms-report-link-controls';
      controls.innerHTML=`<label>Link expires <select id="vmsReportExpiry"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="0">Never</option></select></label><button type="button" class="btn light" id="vmsRegenerateReportLink">Regenerate</button><button type="button" class="btn light vms-report-danger" id="vmsDisableReportLink">Disable Link</button>`;
      panel.appendChild(controls);
    }
    return controls;
  }
  async function reportLinkApi(payload){
    const t=await token();
    const r=await fetch('/api/audit-report-links',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Report link request failed (${r.status}).`);return d;
  }
  async function createClientReportLink(regenerate=false){
    const fieldEl=document.getElementById('shareUrl'),panel=document.getElementById('sharePanel'),help=document.getElementById('shareHelp');
    ensureReportLinkControls();
    if(panel)panel.style.display='block';if(help)help.textContent='Creating a revocable client-only report link…';
    try{
      if(location.protocol==='file:')throw new Error('local-preview');
      const days=Number(document.getElementById('vmsReportExpiry')?.value||30);
      const d=await reportLinkApi({action:'create',report_data:clientReportPayload(),expires_in_days:days,previous_token:regenerate?activeReportToken:''});
      activeReportToken=d.token||'';if(fieldEl)fieldEl.value=d.public_url||'';
      if(help)help.textContent=d.expires_at?`Client-only report link ready. It expires ${new Date(d.expires_at).toLocaleDateString()}. You can regenerate or disable it anytime.`:'Client-only report link ready. You can regenerate or disable it anytime.';
      panel?.scrollIntoView?.({behavior:'smooth',block:'start'});
      feedback(regenerate?'Client report link regenerated.':'Client report link created.','good');
      return;
    }catch(err){
      if(String(err?.message||'')!=='local-preview')console.warn('Revocable report link unavailable; using static fallback.',err);
      const url=buildPublicClientLink();activeReportToken='';if(fieldEl)fieldEl.value=url;
      if(help)help.textContent=location.protocol==='file:'?'Local preview link created. On the hosted VMS site, client report links are revocable and can expire.':'A client-only fallback link was created. Revocation controls require the report-link service to be deployed.';
      panel?.scrollIntoView?.({behavior:'smooth',block:'start'});
    }
  }
  function installClientReportSharing(){
    ensureReportLinkControls();
    document.addEventListener('click',async e=>{
      const share=e.target.closest?.('#shareBtn');
      const regen=e.target.closest?.('#vmsRegenerateReportLink');
      const disable=e.target.closest?.('#vmsDisableReportLink');
      if(!share&&!regen&&!disable)return;
      e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
      if(disable){
        const fieldEl=document.getElementById('shareUrl'),help=document.getElementById('shareHelp');
        if(!activeReportToken){if(help)help.textContent='This fallback link cannot be revoked. Generate a hosted report link after the Phase 5 report service is deployed.';return}
        disable.disabled=true;
        try{await reportLinkApi({action:'revoke',token:activeReportToken});activeReportToken='';if(fieldEl)fieldEl.value='';if(help)help.textContent='This client report link is disabled. Generate a new link whenever you are ready.';feedback('Client report link disabled.','good')}catch(err){console.error(err);feedback('The report link could not be disabled.','warn')}finally{disable.disabled=false}
        return;
      }
      try{await createClientReportLink(!!regen)}catch(err){console.error(err);feedback('The client report link could not be generated.','warn')}
    },true);
  }

  function installButton(){
    if(window.__VMS_AUDIT_AI_CLICK_OWNER__)return;window.__VMS_AUDIT_AI_CLICK_OWNER__=true;
    window.addEventListener('click',e=>{
      const target=e.target?.closest?.('#runAuditInsideAssistant,#runAiAudit,[data-action="run-audit"]');if(!target)return;
      e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();document.getElementById('moreActionsMenu')?.classList.remove('open');run();
    },true);
    if(!document.getElementById('runAiAudit')){const bridge=document.createElement('button');bridge.type='button';bridge.id='runAiAudit';bridge.hidden=true;bridge.setAttribute('aria-hidden','true');document.body.appendChild(bridge)}
  }

  function overrideAccept(){
    try{
      if(typeof applyAiScore!=='function'||applyAiScore.__vmsLiveV2)return;
      const fn=function(cat){
        try{
          const generated=AI_STATE?.selections?.[cat]||{},sel={};Object.entries(generated).forEach(([id,obj])=>{if(typeof obj?.points==='number')sel[id]=obj.points});
          S[cat]={...(S[cat]||{}),...sel};repaintCategory(cat);
          const reason=document.getElementById('aiReason-'+cat);if(reason)reason.textContent='Suggested assessment accepted. Verified findings were applied to the VMS checklist. Manual and N/A checks remain editable.';
          feedback(`${DISPLAY[cat]} suggested score applied. You can still edit every check.`,'good');
        }catch(e){console.warn(e)}
      };fn.__vmsLiveV2=true;applyAiScore=fn;
    }catch(e){console.warn('Accept-score override unavailable.',e)}
  }

  function auditPayload(data){
    return {business_name:data.businessName,local_id:data.id,status:data.status||'draft',scoring:data.scoring||{},industry:data.industry||'',website_url:data.websiteUrl||'',google_url:data.googleUrl||'',internal_notes:data.internalNotes||'',final_notes:data.sectionNotes||{},assessment_notes:data.assessmentNotes||{},ai_audit:data.aiAudit||window.__VMS_AUDIT_AI_LIVE_STATE__||null};
  }
  async function cloudSave(data){
    try{const t=await token();const r=await fetch('/api/audits',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(auditPayload(data))});if(!r.ok)throw new Error(`Cloud save failed (${r.status}).`);return true}catch(e){console.warn(e);return false}
  }
  function patchPersistence(){
    try{
      if(typeof captureAudit==='function'&&!captureAudit.__vmsAiLive){
        const original=captureAudit;const wrapped=function(){const data=original();data.aiAudit=window.__VMS_AUDIT_AI_LIVE_STATE__||null;if(window.__VMS_REAUDIT_BASELINE__){data.reAuditOf=window.__VMS_REAUDIT_BASELINE__.id;data.baselineOverall=window.__VMS_REAUDIT_BASELINE__.overall;data.baselineScores=window.__VMS_REAUDIT_BASELINE__.scores}return data};wrapped.__vmsAiLive=true;captureAudit=wrapped;
      }
    }catch(e){console.warn('Audit AI local save patch unavailable.',e)}
    try{
      if(typeof restoreAudit==='function'&&!restoreAudit.__vmsAiLive){
        const original=restoreAudit;const wrapped=function(data){const v=original(data);window.__VMS_REAUDIT_BASELINE__=data?.reAuditOf?{id:data.reAuditOf,overall:data.baselineOverall||0,scores:data.baselineScores||{}}:null;if(data?.aiAudit)setTimeout(()=>paint(data.aiAudit),0);else window.__VMS_AUDIT_AI_LIVE_STATE__=null;return v};wrapped.__vmsAiLive=true;restoreAudit=wrapped;
      }
    }catch(e){console.warn('Audit AI restore patch unavailable.',e)}
    try{
      if(typeof saveAudit==='function'&&!saveAudit.__vmsCloudSave){
        const original=saveAudit;const wrapped=function(showMessage=true){const data=original(showMessage);void cloudSave(data).then(ok=>{if(ok)feedback('Audit saved to History and cloud.','good')});return data};wrapped.__vmsCloudSave=true;saveAudit=wrapped;
      }
    }catch(e){console.warn('Cloud save patch unavailable.',e)}
    try{
      if(typeof reAudit==='function'&&!reAudit.__vmsReaudit){const original=reAudit;const wrapped=function(id){const item=typeof getHistory==='function'?getHistory().find(x=>x.id===id):null;window.__VMS_REAUDIT_BASELINE__=item?{id:item.id,overall:item.overall||0,scores:item.scores||{}}:null;return original(id)};wrapped.__vmsReaudit=true;reAudit=wrapped}
    }catch(e){console.warn('Re-audit patch unavailable.',e)}
    try{
      if(typeof renderHistory==='function'&&!renderHistory.__vmsHistoryDecor){const original=renderHistory;const wrapped=function(){const v=original();setTimeout(decorateHistory,0);return v};wrapped.__vmsHistoryDecor=true;renderHistory=wrapped}
    }catch(e){console.warn('History decoration patch unavailable.',e)}
    try{
      if(typeof phase6CurrentAuditPayload==='function'&&!phase6CurrentAuditPayload.__vmsAiLive){const original=phase6CurrentAuditPayload;const wrapped=function(){const p=original();p.ai_audit=window.__VMS_AUDIT_AI_LIVE_STATE__||null;return p};wrapped.__vmsAiLive=true;phase6CurrentAuditPayload=wrapped}
    }catch(e){console.warn('Audit AI cloud payload patch unavailable.',e)}
  }

  function decorateHistory(){
    try{
      localPresenceLabels();if(typeof getHistory!=='function')return;const arr=getHistory();
      document.querySelectorAll('.history-item').forEach(card=>{const id=card.querySelector('[data-history-open]')?.dataset?.historyOpen,item=arr.find(x=>x.id===id);if(!item?.reAuditOf||card.querySelector('.vms-reaudit-badge'))return;const delta=(Number(item.overall)||0)-(Number(item.baselineOverall)||0);const meta=card.querySelector('.history-meta');if(meta){const b=document.createElement('span');b.className='vms-reaudit-badge';b.textContent=`Re-Audit ${delta>=0?'+':''}${delta}`;meta.appendChild(b)}});
    }catch(e){console.warn(e)}
  }

  function ensureSubmit(){
    const actions=document.querySelector('.top-actions.clean-actions')||document.querySelector('.top-actions');if(!actions||document.getElementById('submitAuditTop'))return;
    const b=document.createElement('button');b.type='button';b.id='submitAuditTop';b.className='btn vms-submit-btn';b.textContent='Submit Audit';
    const report=document.getElementById('toReport');if(report)actions.insertBefore(b,report);else actions.appendChild(b);
  }
  function feedback(text,kind=''){
    document.querySelector('.vms-submit-feedback')?.remove();const el=document.createElement('div');el.className='vms-submit-feedback'+(kind?' '+kind:'');el.textContent=text;document.body.appendChild(el);setTimeout(()=>el.remove(),3200);
  }
  function firstUnansweredCategory(){
    try{if(typeof D==='undefined'||typeof S==='undefined')return null;for(const cat of CATS){for(const [id] of D[cat])if(!Object.prototype.hasOwnProperty.call(S[cat]||{},id))return cat}}catch{}return null;
  }
  async function submitAudit(){
    const btn=document.getElementById('submitAuditTop');if(!field('businessName')){feedback('Add the business name before submitting.','warn');document.getElementById('businessName')?.focus();return}
    const cat=firstUnansweredCategory();if(cat){feedback(`Finish ${DISPLAY[cat]} or mark unverified checks N/A before submitting.`,'warn');try{if(typeof v32ActivateView==='function')v32ActivateView(cat);else if(typeof show==='function')show(cat)}catch{}return}
    try{
      if(btn){btn.disabled=true;btn.textContent='Submitting…'}
      const status=document.getElementById('auditStatus');if(status)status.value='completed';
      const data=typeof saveAudit==='function'?saveAudit(true):null;
      if(data)await cloudSave(data);
      if(btn){btn.classList.add('is-done');btn.textContent='Submitted ✓'}
      feedback('Audit submitted and saved to History.','good');
      if(typeof renderHistory==='function')renderHistory();if(typeof renderAuditDashboard==='function')renderAuditDashboard();
      await sleep(450);try{if(typeof v32ActivateView==='function')v32ActivateView('history');else if(typeof show==='function')show('history')}catch{}
    }catch(e){console.error(e);feedback('The audit could not be submitted. Your local draft is still saved.','warn');if(btn)btn.textContent='Submit Audit'}
    finally{if(btn){btn.disabled=false;setTimeout(()=>{btn.classList.remove('is-done');btn.textContent='Submit Audit'},2200)}}
  }

  function installControlEvents(){
    document.addEventListener('click',e=>{
      const na=e.target.closest('[data-vms-na]');if(na){e.preventDefault();markUnansweredNA(na.dataset.vmsNa);return}
      const manual=e.target.closest('[data-ai-manual]');if(manual){setState('Manual scoring mode — use N/A for anything unverified','');ensureManualControls(manual.dataset.aiManual)}
      const submit=e.target.closest('#submitAuditTop');if(submit){e.preventDefault();e.stopPropagation();submitAudit();return}
      const print=e.target.closest('#printBtn');if(print){document.body.classList.add('vms-printing-audit-report');setTimeout(()=>document.body.classList.remove('vms-printing-audit-report'),1800)}
    });
    document.addEventListener('click',e=>{if(e.target.closest('[data-action="new-audit"],#newAuditBtn')){window.__VMS_REAUDIT_BASELINE__=null;window.__VMS_AUDIT_AI_LIVE_STATE__=null;setTechDetails('');setTimeout(()=>renderPriority({priority_findings:[],recommendations:[]}),0)}} ,true);
  }

  function observer(){
    let timer=null;const mo=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{localPresenceLabels();decorateHistory()},40)});mo.observe(document.body,{subtree:true,childList:true});
  }

  function boot(){
    style();localPresenceLabels();ensureTechDetails();CATS.forEach(ensureManualControls);ensurePriorityHosts();ensureSubmit();installButton();installClientReportSharing();overrideAccept();patchPersistence();installControlEvents();decorateHistory();observer();
    setTimeout(()=>{overrideAccept();patchPersistence();localPresenceLabels();decorateHistory()},700);
    setTimeout(()=>{overrideAccept();patchPersistence();localPresenceLabels();decorateHistory()},1800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
