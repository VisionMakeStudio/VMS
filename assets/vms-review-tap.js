/* VMS homepage — Review Stand / Review Card interactive viewer.
   Lives in its own homepage section (#review-stand). No external libraries. */
(()=>{
  'use strict';
  const stage=document.getElementById('rtStage');if(!stage)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let type='stand',color='white',tapTimer=0;

  const qr=()=>{
    const ink=color==='black'&&type==='stand'?'#fff':'#003049';
    const cells=[0,7,14,21,28,35,42,49].flatMap(y=>[0,7,14,21,28,35,42,49].map(x=>{
      const inFinder=(x<21&&y<21)||(x>=35&&y<21)||(x<21&&y>=35);
      return !inFinder&&(x*7+y*13+x*y)%3===0?'<rect x="'+x+'" y="'+y+'" width="7" height="7" fill="'+ink+'"/>':'';
    })).join('');
    const finder=(x,y)=>'<rect x="'+(x+1.5)+'" y="'+(y+1.5)+'" width="18" height="18" rx="3" fill="none" stroke="'+ink+'" stroke-width="3"/><rect x="'+(x+5)+'" y="'+(y+5)+'" width="11" height="11" rx="2" fill="'+ink+'"/>';
    return '<svg class="rt-qr-svg" viewBox="0 0 56 56" aria-hidden="true">'+cells+finder(0,0)+finder(35,0)+finder(0,35)+'</svg>';
  };
  const badge='<div class="rt-badge" aria-hidden="true"><div class="rt-badge-inner">G</div></div>';
  const stars='<div class="rt-stars" aria-hidden="true">★★★★★</div>';
  const phone='<div class="rt-phone" id="rtPhone" aria-hidden="true"><div class="rt-phone-screen"><div class="rt-phone-g">G</div><div class="rt-phone-stars">★★★★★</div><div class="rt-phone-cta">Write a review</div></div></div>';
  const tapRow=(ink,label)=>'<div class="rt-tap" style="color:'+ink+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12a7 7 0 0 1 7-7M8.5 12A3.5 3.5 0 0 1 12 8.5M2 12A10 10 0 0 1 12 2"/></svg><span>'+label+'</span></div>';

  function productHtml(){
    if(type==='card'){
      return '<div class="rt-card" id="rtProduct">'+phone+
        '<div class="rt-stand-title" style="color:#112D3D">Review us on Google</div>'+badge+stars+
        '<div class="rt-qr-box">'+qr()+'</div>'+tapRow('#526a77','Tap or scan')+'<div class="rt-stripe"></div></div>';
    }
    const dark=color==='black',ink=dark?'#FDF0D5':'#112D3D',muted=dark?'rgba(253,240,213,.7)':'#526a77';
    return '<div class="rt-stand" id="rtProduct">'+phone+
      '<div class="rt-stand-body'+(dark?' black':'')+'"><div class="rt-stand-title" style="color:'+ink+'">We\u2019d love your feedback</div>'+badge+stars+
      '<div class="rt-qr-box">'+qr()+'</div>'+tapRow(muted,'Tap or scan')+'<div class="rt-stripe"></div></div>'+
      '<div class="rt-stand-foot'+(dark?' black':'')+'"></div></div>';
  }

  const COPY={
    stand:{title:'VMS Review Stand',desc:'A counter stand your customers can tap with a phone or scan. Opens your Google review page instantly. VMS handles the link setup.',price:'$30',btn:'Order a stand',pick:'tap-scan-stand',feats:['Tap with NFC or scan the QR code','Opens your Google review page','White or black, your choice','VMS handles the link setup','Free U.S. shipping']},
    card:{title:'VMS Review Card',desc:'A slim card your customers tap to leave a review. NFC on the front, QR code on the back.',price:'$15',btn:'Order a card',pick:'tap-scan-card',feats:['Tap with NFC or scan the QR code','Opens your Google review page','White only','VMS handles the link setup','Free U.S. shipping']}
  };

  function render(){
    stage.innerHTML=productHtml()+'<span class="rt-hint">Tap to try it</span>';
    const c=COPY[type];
    if($('rtTitle'))$('rtTitle').textContent=type==='stand'?c.title+' \u00b7 '+(color==='black'?'Black':'White'):c.title;
    if($('rtDesc'))$('rtDesc').textContent=c.desc;
    if($('rtPrice'))$('rtPrice').textContent=c.price;
    const btn=$('rtOrderBtn');if(btn){btn.textContent=c.btn;btn.dataset.pick=c.pick}
    if($('rtFeatures'))$('rtFeatures').innerHTML=c.feats.map(f=>'<li><svg><use href="#i-check"/></svg>'+esc(f)+'</li>').join('');
    const row=$('rtColorRow');if(row)row.hidden=type!=='stand';
    document.querySelectorAll('[data-rt-type]').forEach(b=>{const on=b.dataset.rtType===type;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false')});
    document.querySelectorAll('[data-rt-color]').forEach(b=>{const on=b.dataset.rtColor===color;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false')});
  }

  function tap(){
    const ph=$('rtPhone');if(!ph)return;
    clearTimeout(tapTimer);ph.classList.add('tapping');
    tapTimer=setTimeout(()=>ph.classList.remove('tapping'),2200);
  }

  stage.addEventListener('click',tap);
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-rt-type]');
    if(t){type=t.dataset.rtType;if(type==='card')color='white';render();return}
    const c=e.target.closest('[data-rt-color]');
    if(c&&type==='stand'){color=c.dataset.rtColor;render()}
  });

  render();
  /* One demo tap the first time the section scrolls into view. */
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const io=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){io.disconnect();setTimeout(tap,600)}},{threshold:.5});
    io.observe(stage);
  }
})();
