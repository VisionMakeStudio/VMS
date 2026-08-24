/* Vision Make Studio — Phase 1 Admin enhancement bridge
   Page-level enhancements only. Navigation/shell ownership lives in vms-admin-shell.* */
(()=>{
  'use strict';
  const path=(location.pathname||'/').toLowerCase();
  if(!path.startsWith('/admin/')||/\/admin\/login(?:\.html)?\/?$/.test(path))return;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const lower=s=>clean(s).toLowerCase();
  const current=(path.split('/').filter(Boolean).pop()||'index.html').toLowerCase();

  function ensureSharedAdminFoundation(){
    if(!document.querySelector('link[href*="vms-admin-shell.css"]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/assets/vms-admin-shell.css?v=20260822-phase1';
      link.dataset.vmsAdminShellCss='1';
      document.head.appendChild(link);
    }
    if(!document.getElementById('vmsCanonicalAdminSidebar')&&!document.querySelector('script[data-vms-canonical-admin-shell="1"],script[src*="vms-admin-shell.js"]')){
      const script=document.createElement('script');
      script.src='/assets/vms-admin-shell.js?v=20260822-phase1';
      script.async=false;
      script.dataset.vmsCanonicalAdminShell='1';
      document.head.appendChild(script);
    }
  }

  function dropdown(trigger,items,{align='right'}={}){
    const wrap=document.createElement('span');wrap.className='vms-phase2-menu-wrap';
    const menu=document.createElement('div');menu.className='vms-phase2-action-menu';menu.dataset.align=align;
    items.forEach(({label,action,danger})=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;if(danger)b.classList.add('danger');b.addEventListener('click',e=>{e.stopPropagation();wrap.classList.remove('open');action?.()});menu.appendChild(b);
    });
    trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();$$('.vms-phase2-menu-wrap.open').forEach(x=>{if(x!==wrap)x.classList.remove('open')});wrap.classList.toggle('open')});
    wrap.append(trigger,menu);document.addEventListener('click',()=>wrap.classList.remove('open'));return wrap;
  }

  function enhanceNotificationActivity(){
    if(!/(activity|notification)/.test(current))return;
    const select=$('#desktopSelectBtn');
    const filter=$('#filterBtn');
    if(select&&filter&&select.dataset.vmsPhase2!=='1'){
      select.dataset.vmsPhase2='1';select.textContent='Select All';
      filter.insertAdjacentElement('afterend',select);
      const original=select.onclick;
      select.onclick=e=>{
        original?.call(select,e);
        requestAnimationFrame(()=>{
          const bulk=$('#bulkSelectAllBtn');
          if(bulk&&/select all/i.test(clean(bulk.textContent)))bulk.click();
        });
      };
    }

    const bar=$('#bulkBar'),actions=bar?.querySelector('.bulk-actions');
    if(actions&&!$('#vmsPhase2BulkActions',actions)){
      const read=$('#bulkReadBtn'),unread=$('#bulkUnreadBtn'),del=$('#bulkDeleteBtn'),cancel=$('#bulkCancelBtn'),selectAll=$('#bulkSelectAllBtn');
      [read,unread,del,cancel,selectAll].forEach(x=>{if(x)x.classList.add('vms-phase2-original-action')});
      const trigger=document.createElement('button');trigger.id='vmsPhase2BulkActions';trigger.type='button';trigger.className='btn vms-phase2-bulk-trigger';trigger.textContent='⋯ Bulk Actions';
      const items=[];
      if(read)items.push({label:'Mark Read',action:()=>read.click()});
      if(unread)items.push({label:'Mark Unread',action:()=>unread.click()});
      if(del)items.push({label:'Delete',danger:true,action:()=>del.click()});
      if(cancel)items.push({label:'Clear Selection',action:()=>cancel.click()});
      actions.appendChild(dropdown(trigger,items));
    }
  }

  function replaceShortText(from,to){
    $$('h1,h2,h3,h4,strong,.panel-head-left strong,.topbar-left strong').forEach(el=>{if(lower(el.textContent)===lower(from))el.textContent=to});
  }

  function enhanceScheduling(){
    const pageText=lower(document.title+' '+($('.topbar-left strong')?.textContent||'')+' '+($('h1')?.textContent||''));
    if(!/(scheduling|schedule|appointments)/.test(pageText)&&!/(schedule|scheduling)/.test(current))return;
    replaceShortText('Jobs','Appointments & Scheduled Work');
    replaceShortText('Scheduled Jobs','Appointments & Scheduled Work');

    const actionLabels=/^(edit|reschedule|cancel|delete|delete permanently)$/i;
    $$('.row-actions,.action-cell,td:last-child,[class*="row"] .actions').forEach(group=>{
      if(group.dataset.vmsPhase2Menu==='1')return;
      const originals=$$('button',group).filter(b=>actionLabels.test(clean(b.textContent)));
      if(originals.length<2)return;
      group.dataset.vmsPhase2Menu='1';
      const trigger=document.createElement('button');trigger.type='button';trigger.className='vms-kebab';trigger.setAttribute('aria-label','Appointment actions');trigger.textContent='⋯';
      const items=originals.map(old=>({label:clean(old.textContent),danger:/cancel|delete/i.test(old.textContent),action:()=>old.click()}));
      originals.forEach(b=>b.classList.add('vms-phase2-original-action'));
      group.appendChild(dropdown(trigger,items));
    });
  }

  function enhanceGenericRowActions(){
    // Keep dense data-table rows clean without changing page-level action bars.
    $$('.row-actions,.action-cell').forEach(group=>{
      if(group.dataset.vmsPhase2Menu==='1')return;
      const originals=$$('button',group).filter(b=>!b.classList.contains('action-dots')&&!b.classList.contains('vms-kebab')&&!b.hidden);
      if(originals.length<3)return;
      const labels=originals.map(b=>clean(b.textContent));
      if(labels.some(x=>/^(save|add|new|filter|search)$/i.test(x)))return;
      group.dataset.vmsPhase2Menu='1';
      const trigger=document.createElement('button');trigger.type='button';trigger.className='vms-kebab';trigger.setAttribute('aria-label','Actions');trigger.textContent='⋯';
      const items=originals.map(old=>({label:clean(old.textContent)||'Action',danger:/delete|archive|cancel|remove/i.test(old.textContent),action:()=>old.click()}));
      originals.forEach(b=>b.classList.add('vms-phase2-original-action'));
      group.appendChild(dropdown(trigger,items));
    });
  }

  function alignPageActions(){
    // Small, targeted polish requested during Admin QA.
    $$('a,button').forEach(el=>{
      const t=lower(el.textContent);
      if(t==='view public services')el.classList.add('vms-view-public-services');
      if(t.includes('new promotion'))el.classList.add('vms-new-promotion-action');
    });
  }

  function boot(){
    document.documentElement.classList.add('vms-phase2-admin');
    const pageSlug=current.replace(/\.html?$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'index';
    document.documentElement.classList.add(`vms-page-${pageSlug}`);
    ensureSharedAdminFoundation();
    enhanceNotificationActivity();
    enhanceScheduling();
    enhanceGenericRowActions();
    alignPageActions();

    let timer;
    const mo=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        enhanceNotificationActivity();
        enhanceScheduling();
        enhanceGenericRowActions();
        alignPageActions();
      },120);
    });
    mo.observe(document.body,{subtree:true,childList:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
