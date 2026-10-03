/* VMS homepage — Interactive Review Tap stand and card product viewer.
   Renders when the Add-ons tab is active. No external libraries. */
(()=>{
  'use strict';
  const stage=document.getElementById('rtStage');if(!stage)return;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let type='stand',color='white',tapping=false,tapTimer=null;
  const qr=()=>'<svg class="rt-qr-svg" viewBox="0 0 56 56" aria-hidden="true">'+
    '<rect width="56" height="56" fill="'+([...Array(6)].map(()=>'').join('')||'white')+'"/>' +
    [0,7,14,21,28,35,42,49].flatMap(y=>[0,7,14,21,28,35,42,49].map(x=>{const on=(x*7+y*13+x*y)%3===0;return on?`<rect x="${x}" y="${y}" width="7" height="7" fill="${color==='black'?'#fff':'#003049'}"/>`:'';})).join('')+
    `<rect x="0" y="0" width="21" height="21" rx="3" fill="none" stroke="${color==='black'?'#fff':'#003049'}" stroke-width="3"/>
    <rect x="35" y="0" width="21" height="21" rx="3" fill="none" stroke="${color==='black'?'#fff':'#003049'}" stroke-width="3"/>
    <rect x="0" y="35" width="21" height="21" rx="3" fill="none" stroke="${color==='black'?'#fff':'#003049'}" stroke-width="3"/>
    <rect x="5" y="5" width="11" height="11" rx="2" fill="${color==='black'?'#fff':'#003049'}"/>
    <rect x="40" y="5" width="11" height="11" rx="2" fill="${color==='black'?'#fff':'#003049'}"/>
    <rect x="5" y="40" width="11" height="11" rx="2" fill="${color==='black'?'#fff':'#003049'}"/></svg>';
  const badge=()=>`<div class="rt-badge" aria-hidden="true"><div class="rt-badge-inner" style="${color==='black'?'background:#111;color:#FDF0D5':''}">★</div></div>`;
  const stars=()=>'<div class="rt-stars" aria-hidden="true">⭐⭐⭐⭐⭐</div>';
  const tapIcon=()=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color==='black'?'rgba(255,255,255,.7)':'#526a77'}" stroke-width="1.6" aria-hidden="true"><path d="M12 3C6.5 3 2 7.5 2 13s4.5 10 10 10 10-4.5 10-10M22 3l-4 4M22 7V3h-4"/></svg>`;
  const phone=()=>`<div class="rt-phone" id="rtPhone"><div class="rt-phone-screen"><div class="rt-phone-url">g.co/l/review/★★★★★</div><div class="rt-phone-stars">⭐⭐⭐⭐⭐</div><div class="rt-phone-cta">Leave a review</div></div></div>`;

  function standHtml(){
    const dark=color==='black';
    const ink=dark?'rgba(255,255,255,.9)':'#112D3D';
    const muted=dark?'rgba(255,255,255,.6)':'#526a77';
    return `<div class="rt-stand" id="rtProduct">
      ${phone()}
      <div class="rt-stand-body${dark?' black':''}" id="rtBody">
        <div class="rt-stand-title" style="color:${ink}">We'd love your feedback</div>
        ${badge()}
        ${stars()}
        <div class="rt-qr-box" style="${dark?'background:#111':''}">
          ${qr()}
        </div>
        <div class="rt-tap" style="color:${muted}">
          ${tapIcon()}<span>Tap</span><span style="margin:0 2px">or</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${muted}" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z"/></svg>
          <span>Scan</span>
        </div>
        <div class="rt-stripe"></div>
      </div>
      <div class="rt-stand-foot" style="${dark?'background:#1a1a1a':''}"></div>
    </div>`;
  }

  function cardHtml(){
    return `<div class="rt-card" id="rtProduct">
      ${phone()}
      <div class="rt-stand-title" style="color:#112D3D;font-size:9px">Review us on Google</div>
      ${badge()}
      ${stars()}
      <div class="rt-qr-box">
        ${qr()}
      </div>
      <div class="rt-tap" style="color:#526a77">
        ${tapIcon()}<span>Tap your phone</span>
      </div>
      <div class="rt-stripe"></div>
    </div>`;
  }

  function render(){
    stage.innerHTML=type==='stand'?standHtml():cardHtml();
    stage.onclick=handleTap;
    if(tapping)setTimeout(()=>{const ph=document.getElementById('rtPhone');if(ph)ph.classList.add('tapping')},50);
    /* Update side panel */
    const titleEl=document.getElementById('rtTitle');
    const descEl=document.getElementById('rtDesc');
    const priceEl=document.getElementById('rtPrice');
    const btnEl=document.getElementById('rtOrderBtn');
    const featsEl=document.getElementById('rtFeatures');
    const colorRow=document.getElementById('rtColorRow');
    if(type==='stand'){
      if(titleEl)titleEl.textContent='VMS Review Stand — '+color.charAt(0).toUpperCase()+color.slice(1);
      if(descEl)descEl.textContent='A counter stand your customers can tap with a phone or scan. Opens your Google review page instantly. VMS handles the link setup.';
      if(priceEl)priceEl.textContent='$30';
      if(btnEl){btnEl.textContent='Order a stand';btnEl.dataset.pick='tap-scan-stand'}
      if(featsEl)featsEl.innerHTML=['Tap with NFC or scan the QR code','Opens your Google review page','White or black, your choice','VMS handles the link setup','Free U.S. shipping'].map(f=>`<li><svg><use href="#i-check"/></svg>${esc(f)}</li>`).join('');
      if(colorRow)colorRow.style.display='';
    } else {
      if(titleEl)titleEl.textContent='VMS Review Card';
      if(descEl)descEl.textContent='A slim card your customers tap to leave a review. NFC on the front, QR code on the back. White only.';
      if(priceEl)priceEl.textContent='$15';
      if(btnEl){btnEl.textContent='Order a card';btnEl.dataset.pick='tap-scan-card'}
      if(featsEl)featsEl.innerHTML=['Tap NFC or scan QR on the back','Opens your Google review page','White only','VMS handles the link setup','Free U.S. shipping'].map(f=>`<li><svg><use href="#i-check"/></svg>${esc(f)}</li>`).join('');
      if(colorRow)colorRow.style.display='none';
    }
  }

  function handleTap(){
    if(tapping)return;
    tapping=true;
    const ph=document.getElementById('rtPhone');
    if(ph){ph.classList.add('tapping');clearTimeout(tapTimer);tapTimer=setTimeout(()=>{ph.classList.remove('tapping');tapping=false},2200)}
  }

  /* Controls */
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-rt-type]');
    if(btn){
      type=btn.dataset.rtType;color='white';
      document.querySelectorAll('[data-rt-type]').forEach(b=>b.classList.toggle('active',b===btn));
      document.querySelectorAll('[data-rt-color]').forEach(b=>b.classList.toggle('active',b.dataset.rtColor==='white'));
      tapping=false;render();return;
    }
    const cbtn=e.target.closest('[data-rt-color]');
    if(cbtn&&type==='stand'){
      color=cbtn.dataset.rtColor;
      document.querySelectorAll('[data-rt-color]').forEach(b=>b.classList.toggle('active',b===cbtn));
      tapping=false;render();return;
    }
  });

  /* Show when tab becomes visible */
  const panel=document.getElementById('pn-ad');
  if(panel){
    const obs=new MutationObserver(()=>{if(!panel.hidden&&!stage.children.length)render()});
    obs.observe(panel,{attributes:true,attributeFilter:['hidden']});
    if(!panel.hidden)render();
  }
})();
