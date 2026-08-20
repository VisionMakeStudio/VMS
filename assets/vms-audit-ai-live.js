(()=>{
  if(!/\/admin\/audit(?:\.html)?$/i.test(location.pathname))return;
  const CATS=['website','google','reviews','systems'];
  const cap=s=>s?String(s)[0].toUpperCase()+String(s).slice(1):'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  async function token(){const sb=await VMSAuth.client();const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error('Please sign in again.');return session.access_token}
  function field(id){return document.getElementById(id)?.value?.trim?.()||''}
  function body(){let platforms=[];try{if(typeof REVIEW_PLATFORMS!=='undefined'&&Array.isArray(REVIEW_PLATFORMS))platforms=REVIEW_PLATFORMS.map(p=>({name:p.name||p.platform||'',url:p.url||p.link||'',rating:p.rating??null,reviews:p.reviews??p.count??null})).slice(0,8)}catch{}return {business_name:field('businessName'),industry:field('industry'),website_url:field('websiteUrl'),google_url:field('googleUrl'),internal_notes:field('overviewNotes'),review_platforms:platforms}}
  function setState(text,kind=''){const el=document.getElementById('aiState');if(el){el.textContent=text;el.className='ai-state'+(kind?' '+kind:'')}}
  function style(){if(document.getElementById('vms-audit-ai-live-style'))return;const s=document.createElement('style');s.id='vms-audit-ai-live-style';s.textContent=`
    .vms-ai-live-meta{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}.vms-ai-live-chip{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;background:#f0f5f7;color:#527080;font:850 9px/1 Inter,system-ui,sans-serif}.vms-ai-live-chip.good{background:#edf8f1;color:#28764a}.vms-ai-live-chip.warn{background:#fff6e8;color:#9a681d}
    .vms-ai-source-details{margin-top:9px;border-top:1px solid #e7edef;padding-top:8px}.vms-ai-source-details summary{cursor:pointer;color:#56717e;font-size:10px;font-weight:850}.vms-ai-source-list{display:grid;gap:5px;margin-top:7px}.vms-ai-source-list a{font-size:10px;color:#315f79;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vms-ai-source-list a:hover{text-decoration:underline}
    .vms-ai-live-note{margin-top:7px;font-size:9px;color:#7b8b93;line-height:1.45}.ai-check-result .vms-confidence{margin-left:5px;font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#83949d}
    #runAiAudit[data-live-audit='true']{box-shadow:0 8px 22px rgba(0,48,73,.14)}
  `;document.head.appendChild(s)}
  function reasonMeta(cat,c){const reason=document.getElementById('aiReason-'+cat);if(!reason)return;let box=reason.parentElement?.querySelector('.vms-ai-live-meta');if(!box){box=document.createElement('div');box.className='vms-ai-live-meta';reason.insertAdjacentElement('afterend',box)}const count=(c.items||[]).filter(x=>typeof x.points==='number').length;const total=(c.items||[]).length;box.innerHTML=`<span class="vms-ai-live-chip good">Live evidence</span><span class="vms-ai-live-chip">${count}/${total} checks assessed</span>${c.assessed_max<100?'<span class="vms-ai-live-chip warn">Manual checks remain</span>':''}`}
  function sources(cat,c,result){const reason=document.getElementById('aiReason-'+cat);if(!reason)return;let d=reason.parentElement?.querySelector('.vms-ai-source-details');if(d)d.remove();const urls=new Set();(c.items||[]).forEach(i=>(i.source_urls||[]).forEach(u=>urls.add(u)));const matched=(result.sources||[]).filter(s=>urls.has(s.url)).slice(0,6);if(!matched.length)return;d=document.createElement('details');d.className='vms-ai-source-details';d.innerHTML=`<summary>Evidence sources (${matched.length})</summary><div class="vms-ai-source-list">${matched.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a>`).join('')}</div>`;reason.parentElement?.appendChild(d)}
  function paint(result){
    window.__VMS_AUDIT_AI_LIVE_STATE__=result;
    try{if(typeof AI_STATE!=='undefined'){AI_STATE.ready=true;CATS.forEach(cat=>{const c=result.categories?.[cat];if(!c)return;AI_STATE.scores[cat]=c.score;AI_STATE.reasons[cat]=c.reason;AI_STATE.selections[cat]={};(c.items||[]).forEach(i=>{if(typeof i.points==='number')AI_STATE.selections[cat][i.id]={points:i.points,label:i.label,title:i.title,max:i.max,evidence:i.evidence,confidence:i.confidence}})})}}catch(e){console.warn('Audit AI state could not be synchronized.',e)}
    CATS.forEach(cat=>{
      const c=result.categories?.[cat];if(!c)return;
      const score=document.getElementById('aiScore-'+cat);if(score)score.textContent=c.score==null?'—':String(c.score);
      const mini=document.getElementById('aiMini'+cap(cat));if(mini)mini.textContent=c.score==null?'—':String(c.score);
      const reason=document.getElementById('aiReason-'+cat);if(reason)reason.textContent=c.reason||'Manual review is still required for this section.';
      const note=document.getElementById(cat+'Ai');if(note)note.value=c.assessment_note||'';
      const accept=document.querySelector(`[data-ai-accept="${cat}"]`);if(accept)accept.disabled=!(c.items||[]).some(i=>typeof i.points==='number');
      try{if(typeof showAiCheckExplanations==='function')showAiCheckExplanations(cat)}catch{}
      (c.items||[]).forEach(i=>{const wrap=document.getElementById(`ai-check-${cat}-${i.id}`);const res=document.getElementById(`ai-check-result-${cat}-${i.id}`);const text=document.getElementById(`ai-check-text-${cat}-${i.id}`);if(wrap)wrap.classList.add('ready');if(res)res.innerHTML=i.points==null?`Needs manual review <span class="vms-confidence">${esc(i.confidence||'low')} confidence</span>`:`${esc(i.label)} • ${i.points}/${i.max}<span class="vms-confidence">${esc(i.confidence||'')} confidence</span>`;if(text)text.textContent=i.evidence||'No supporting evidence was available.'});
      reasonMeta(cat,c);sources(cat,c,result);
    });
    const overall=document.getElementById('aiOverallScore');if(overall)overall.textContent=result.overall_score==null?'—':String(result.overall_score);
    setState('Live suggestions ready','ready');
    try{if(typeof scheduleAutosave==='function')scheduleAutosave();else if(typeof saveDraftSilently==='function')saveDraftSilently()}catch{}
  }
  async function run(){
    const btn=document.getElementById('runAiAudit');const payload=body();if(!payload.business_name){alert('Add the business name before running the audit.');document.getElementById('businessName')?.focus();return}
    if(btn){btn.disabled=true;btn.innerHTML='<span class="ai-loading"><span class="desktop-label">Running Live Audit</span><span class="mobile-label">Running…</span></span>'}
    setState('Checking website + public presence…','running');CATS.forEach(cat=>{const s=document.getElementById('aiScore-'+cat);if(s)s.textContent='…';const r=document.getElementById('aiReason-'+cat);if(r)r.textContent='Reviewing live evidence…';const m=document.getElementById('aiMini'+cap(cat));if(m)m.textContent='…'});
    try{const t=await token();const r=await fetch('/api/ai-audit',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Audit request failed (${r.status}).`);paint(d.result);if(d.result?.warnings?.length)console.info('VMS Audit AI warnings:',d.result.warnings)}catch(e){console.error(e);setState('Audit needs attention','');alert(e.message||'The live audit could not be completed.');CATS.forEach(cat=>{const s=document.getElementById('aiScore-'+cat);if(s&&s.textContent==='…')s.textContent='—'})}finally{if(btn){btn.disabled=false;btn.innerHTML='<span class="desktop-label">✦ Re-run Audit</span><span class="mobile-label">✦ Re-run</span>'}}
  }
  function installButton(){const old=document.getElementById('runAiAudit');if(!old||old.dataset.liveAudit==='true')return;const btn=old.cloneNode(true);btn.dataset.liveAudit='true';btn.innerHTML='<span class="desktop-label">✦ Run Audit</span><span class="mobile-label">✦ Run Audit</span>';old.replaceWith(btn);btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();document.getElementById('moreActionsMenu')?.classList.remove('open');run()})}
  function patchPersistence(){
    try{if(typeof captureAudit==='function'&&!captureAudit.__vmsAiLive){const original=captureAudit;const wrapped=function(){const data=original();data.aiAudit=window.__VMS_AUDIT_AI_LIVE_STATE__||null;return data};wrapped.__vmsAiLive=true;captureAudit=wrapped}}
    catch(e){console.warn('Audit AI local save patch unavailable.',e)}
    try{if(typeof restoreAudit==='function'&&!restoreAudit.__vmsAiLive){const original=restoreAudit;const wrapped=function(data){const v=original(data);if(data?.aiAudit)setTimeout(()=>paint(data.aiAudit),0);else window.__VMS_AUDIT_AI_LIVE_STATE__=null;return v};wrapped.__vmsAiLive=true;restoreAudit=wrapped}}
    catch(e){console.warn('Audit AI restore patch unavailable.',e)}
    try{if(typeof phase6CurrentAuditPayload==='function'&&!phase6CurrentAuditPayload.__vmsAiLive){const original=phase6CurrentAuditPayload;const wrapped=function(){const p=original();p.ai_audit=window.__VMS_AUDIT_AI_LIVE_STATE__||null;return p};wrapped.__vmsAiLive=true;phase6CurrentAuditPayload=wrapped}}
    catch(e){console.warn('Audit AI cloud save patch unavailable.',e)}
  }
  function boot(){style();installButton();patchPersistence();setTimeout(patchPersistence,700);setTimeout(patchPersistence,1800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
