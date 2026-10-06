(()=>{
  if(document.documentElement.dataset.vmsShell==='v2')return; /* Admin v2 pages have delete built in. */
  const page=(()=>{let p=(location.pathname||'').split('/').filter(Boolean).pop()||'index.html';if(!p.includes('.'))p+='.html';return p.toLowerCase()})();
  if(!['leads.html','audit.html'].includes(page))return;

  async function token(){
    const sb=await VMSAuth.client();
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Please sign in again.');
    return session.access_token;
  }
  async function request(path,method='POST',body={}){
    const t=await token();
    const r=await fetch(path,{method,headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||`Request failed (${r.status}).`);
    return d;
  }
  function installBaseStyle(){
    if(document.getElementById('vms-admin-cleanup-style'))return;
    const s=document.createElement('style');s.id='vms-admin-cleanup-style';s.textContent=`
      .vms-cleanup-modal{position:fixed;inset:0;z-index:2147483000;display:none;place-items:center;padding:18px;background:rgba(0,31,49,.48);backdrop-filter:blur(4px)}
      .vms-cleanup-modal.show{display:grid}.vms-cleanup-dialog{width:min(500px,100%);background:#fff;border:1px solid #dce6ea;border-radius:18px;box-shadow:0 28px 80px rgba(0,30,45,.25);overflow:hidden}
      .vms-cleanup-dialog-head{padding:16px 17px;border-bottom:1px solid #e8eef0}.vms-cleanup-dialog-head strong{display:block;color:#003049;font-size:15px}.vms-cleanup-dialog-head span{display:block;margin-top:5px;color:#73858e;font-size:10px;line-height:1.5}
      .vms-cleanup-dialog-body{padding:16px 17px;color:#526a76;font-size:10px;line-height:1.55}.vms-cleanup-warning{padding:11px 12px;border:1px solid #efc8cd;background:#fff7f7;border-radius:12px;color:#9d2f39}
      .vms-cleanup-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;padding:13px 17px;border-top:1px solid #e8eef0}.vms-cleanup-actions button{min-height:38px;border-radius:10px;border:1px solid #d8e3e7;background:#fff;color:#34515f;padding:0 12px;font:850 10px/1 Inter,system-ui,sans-serif}.vms-cleanup-actions .danger{background:#C1121F;border-color:#C1121F;color:#fff}.vms-cleanup-actions .danger-outline{border-color:#e8b8bd;color:#a92d37;background:#fff8f8}
      .vms-recent-audit-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:stretch;position:relative}.vms-recent-audit-wrap>.phase4-recent-item{width:100%;min-width:0}.vms-recent-audit-more{width:40px;border:1px solid #dce6ea;border-radius:11px;background:#fff;color:#003049;font-size:18px;font-weight:900;cursor:pointer}.vms-recent-audit-more:hover{background:#f6f9fa}
      @media(max-width:600px){.vms-cleanup-actions{display:grid}.vms-cleanup-actions button{width:100%}.vms-recent-audit-more{width:38px}}
    `;document.head.appendChild(s);
  }
  function dialog(title,subtitle,body,actions){
    let m=document.getElementById('vmsCleanupModal');
    if(!m){m=document.createElement('div');m.id='vmsCleanupModal';m.className='vms-cleanup-modal';document.body.appendChild(m)}
    m.innerHTML=`<div class="vms-cleanup-dialog" role="dialog" aria-modal="true"><div class="vms-cleanup-dialog-head"><strong>${title}</strong><span>${subtitle||''}</span></div><div class="vms-cleanup-dialog-body">${body||''}</div><div class="vms-cleanup-actions"></div></div>`;
    const a=m.querySelector('.vms-cleanup-actions');
    (actions||[]).forEach(x=>{const b=document.createElement('button');b.type='button';b.textContent=x.label;b.className=x.className||'';b.onclick=async()=>{if(x.close!==false)m.classList.remove('show');await x.onClick?.(b)};a.appendChild(b)});
    m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')},{once:true});m.classList.add('show');return m;
  }

  async function bootLeads(){
    const saveRow=document.querySelector('.save-row');if(!saveRow||document.getElementById('vmsDeleteLeadBtn'))return;
    const b=document.createElement('button');b.id='vmsDeleteLeadBtn';b.type='button';b.className='btn red';b.textContent='Delete';saveRow.insertBefore(b,saveRow.firstChild);
    b.addEventListener('click',async()=>{
      const active=document.querySelector('.lead-row.active[data-lead]');const id=active?.dataset?.lead;if(!id){alert('Choose a lead first.');return}
      try{
        b.disabled=true;const info=(await request('/api/admin-cleanup','POST',{action:'inspect_lead',id})).lead;
        const name=String(info?.businessName||'this lead').replace(/[<>]/g,'');
        if(!info?.converted){
          dialog('Delete lead?',name,'<div class="vms-cleanup-warning">This permanently removes the inquiry, its private notes, and CRM follow-up records.</div>',[
            {label:'Cancel'},
            {label:'Delete Lead',className:'danger',onClick:async()=>{try{await request('/api/admin-cleanup','POST',{action:'delete_lead',id});location.reload()}catch(e){alert(e.message)}}}
          ]);
        }else{
          const clientCopy=info.canDeleteClient
            ? 'This lead has already been converted. You can remove only the CRM lead and keep the client, or permanently remove both the lead and the client record with its related VMS database records.'
            : 'This lead has already been converted and has Stripe billing history. The client cannot be permanently deleted here; archive the client instead.';
          const actions=[{label:'Cancel'},{label:'Delete Lead Only',className:'danger-outline',onClick:async()=>{try{await request('/api/admin-cleanup','POST',{action:'delete_lead',id});location.reload()}catch(e){alert(e.message)}}}];
          if(info.canDeleteClient)actions.push({label:'Delete Lead + Client',className:'danger',onClick:async()=>{if(!confirm(`Permanently delete ${name}, the client record, and related VMS database records? This cannot be undone.`))return;try{await request('/api/admin-cleanup','POST',{action:'delete_lead_client',id});location.reload()}catch(e){alert(e.message)}}});
          dialog('Converted lead',name,`<div class="vms-cleanup-warning">${clientCopy}</div>`,actions);
        }
      }catch(e){alert(e.message)}finally{b.disabled=false}
    });
  }

  function currentAuditId(){
    try{return JSON.parse(localStorage.getItem('vms_phase3_current_v1')||'null')?.id||''}catch{return''}
  }
  function patchAuditCloudSave(){
    try{
      if(window.__VMS_AUDIT_LOCAL_ID_PATCH__)return;
      if(typeof phase6CurrentAuditPayload!=='function')return;
      const original=phase6CurrentAuditPayload;
      phase6CurrentAuditPayload=function(){const payload=original();payload.local_id=currentAuditId()||((typeof PHASE3_CURRENT_ID!=='undefined'&&PHASE3_CURRENT_ID)||'');return payload};
      window.__VMS_AUDIT_LOCAL_ID_PATCH__=true;
    }catch(e){console.warn('VMS audit cloud identifier could not be attached.',e)}
  }
  async function deleteAudit(id){
    const rows=typeof phase3History==='function'?phase3History():[];const item=(rows||[]).find(x=>String(x.id)===String(id));
    const name=String(item?.businessName||'this audit').replace(/[<>]/g,'');
    dialog('Delete audit?',name,'<div class="vms-cleanup-warning">This removes the saved audit from Recent Audits, History, the current draft when it is the same audit, and its linked cloud record.</div>',[
      {label:'Cancel'},
      {label:'Delete Audit',className:'danger',onClick:async()=>{
        try{
          await request('/api/audits','DELETE',{local_id:String(id)});
          const next=(typeof phase3History==='function'?phase3History():[]).filter(x=>String(x.id)!==String(id));
          if(typeof phase3SetHistory==='function')phase3SetHistory(next);else localStorage.setItem('vms_phase3_history_v1',JSON.stringify(next));
          if(currentAuditId()===String(id)){
            localStorage.removeItem('vms_phase3_current_v1');
            try{if(typeof PHASE3_AUTOSAVE_TIMER!=='undefined'&&PHASE3_AUTOSAVE_TIMER)clearTimeout(PHASE3_AUTOSAVE_TIMER)}catch{}
            try{PHASE3_CURRENT_ID=null}catch{}
          }
          try{if(typeof phase3RenderHistory==='function')phase3RenderHistory()}catch{}
          try{if(typeof phase4RenderDashboard==='function')phase4RenderDashboard()}catch{}
          try{if(typeof phase4ShowDashboard==='function')phase4ShowDashboard()}catch{}
        }catch(e){alert(e.message)}
      }}
    ]);
  }
  function syncRecentAuditActions(){
    const recent=document.getElementById('phase4Recent');if(!recent)return;
    [...recent.querySelectorAll('.phase4-recent-item[data-phase4-open]')].forEach(row=>{
      if(row.parentElement?.classList.contains('vms-recent-audit-wrap'))return;
      const wrap=document.createElement('div');wrap.className='vms-recent-audit-wrap';row.parentNode.insertBefore(wrap,row);wrap.appendChild(row);
      const more=document.createElement('button');more.type='button';more.className='vms-recent-audit-more';more.setAttribute('aria-label','Audit actions');more.textContent='⋯';more.onclick=e=>{e.preventDefault();e.stopPropagation();deleteAudit(row.dataset.phase4Open)};wrap.appendChild(more);
    });
  }
  function bindHistoryDelete(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-p3-delete]');if(!b)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();deleteAudit(String(b.dataset.p3Delete||''));
    },true);
  }
  function bootAudit(){
    patchAuditCloudSave();bindHistoryDelete();syncRecentAuditActions();
    const recent=document.getElementById('phase4Recent');if(recent)new MutationObserver(()=>requestAnimationFrame(syncRecentAuditActions)).observe(recent,{childList:true,subtree:false});
  }

  installBaseStyle();
  const boot=()=>page==='leads.html'?bootLeads():bootAudit();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
