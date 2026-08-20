/* VMS QR Export — Phase 5 */
(()=>{'use strict';
  const PRESETS={
    'qr-only':{label:'QR Only',w:900,h:900,inches:'3 × 3 in',copy:'High-resolution QR with a print-safe quiet zone.'},
    sticker:{label:'Sticker',w:900,h:900,inches:'3 × 3 in',copy:'Square branded sticker with business name and CTA.'},
    counter:{label:'Countertop Sign',w:1200,h:1800,inches:'4 × 6 in',copy:'Portrait countertop sign for reviews, menus, booking, or websites.'},
    flyer:{label:'Flyer',w:2550,h:3300,inches:'8.5 × 11 in',copy:'Letter-size print-ready flyer with a large scan target.'}
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=s=>(String(s||'vms-qr').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'vms-qr');
  const canvasToSvgPath=(canvas,x,y,size)=>{
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,img=ctx.getImageData(0,0,w,h).data;
    // QR canvas is square. Convert dark pixel runs to vector rectangles.
    const cells=[]; let min=255,max=0;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const i=(yy*w+xx)*4;const v=(img[i]+img[i+1]+img[i+2])/3;min=Math.min(min,v);max=Math.max(max,v)}
    const threshold=(min+max)/2;
    for(let yy=0;yy<h;yy++){
      let run=-1;
      for(let xx=0;xx<=w;xx++){
        const dark=xx<w?(()=>{const i=(yy*w+xx)*4;return (img[i]+img[i+1]+img[i+2])/3<threshold})():false;
        if(dark&&run<0)run=xx;
        if(!dark&&run>=0){cells.push([run,yy,xx-run,1]);run=-1}
      }
    }
    const sx=size/w,sy=size/h;
    return cells.map(r=>`M${(x+r[0]*sx).toFixed(2)} ${(y+r[1]*sy).toFixed(2)}h${(r[2]*sx).toFixed(2)}v${sy.toFixed(2)}h-${(r[2]*sx).toFixed(2)}z`).join('');
  };
  function roundRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
  function drawFitText(ctx,text,cx,y,maxW,fontPx,weight='800'){let size=fontPx;do{ctx.font=`${weight} ${size}px Arial`;if(ctx.measureText(text).width<=maxW)break;size-=2}while(size>24);ctx.fillText(text,cx,y)}
  function loadImage(src){return new Promise(res=>{if(!src)return res(null);const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src})}
  async function renderCanvas(data,presetKey){
    const p=PRESETS[presetKey]||PRESETS['qr-only'];const c=document.createElement('canvas');c.width=p.w;c.height=p.h;const ctx=c.getContext('2d');
    const bg=data.bgColor||'#FFFFFF',ink=data.qrColor||'#003049';ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
    const qr=data.qrCanvas;if(!qr)throw new Error('QR preview is not ready.');
    const business=(data.businessName||'Client Business').trim(),cta=(data.cta||'Scan to Open').trim(),showVms=data.showVms!==false;
    if(presetKey==='qr-only'){
      const pad=54;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(qr,pad,pad,c.width-pad*2,c.height-pad*2);return c;
    }
    let radius=data.frameStyle==='square'?0:data.frameStyle==='soft'?70:40;
    ctx.fillStyle=bg;roundRect(ctx,30,30,c.width-60,c.height-60,radius);ctx.fill();
    ctx.fillStyle=ink;ctx.textAlign='center';
    const logo=await loadImage(data.logoData);
    if(presetKey==='sticker'){
      if(logo){const s=100;ctx.drawImage(logo,(c.width-s)/2,64,s,s)}
      drawFitText(ctx,business,c.width/2,logo?200:130,c.width-120,50,'700');
      const qs=540,qy=230;ctx.fillStyle='#fff';ctx.fillRect((c.width-qs)/2-28,qy-28,qs+56,qs+56);ctx.drawImage(qr,(c.width-qs)/2,qy,qs,qs);
      ctx.fillStyle=ink;drawFitText(ctx,cta,c.width/2,830,c.width-120,46,'800');
      if(showVms){ctx.font='500 20px Arial';ctx.fillText('Made with Vision Make Studio',c.width/2,875)}
    }else if(presetKey==='counter'){
      if(logo){const s=150;ctx.drawImage(logo,(c.width-s)/2,90,s,s)}
      drawFitText(ctx,business,c.width/2,logo?300:180,c.width-130,58,'700');
      drawFitText(ctx,cta,c.width/2,420,c.width-120,72,'800');
      const qs=720,qy=520;ctx.fillStyle='#fff';ctx.fillRect((c.width-qs)/2-34,qy-34,qs+68,qs+68);ctx.drawImage(qr,(c.width-qs)/2,qy,qs,qs);
      ctx.fillStyle=ink;ctx.font='500 30px Arial';ctx.fillText('Scan with your phone camera',c.width/2,1370);
      if(showVms){ctx.font='500 24px Arial';ctx.fillText('Made with Vision Make Studio',c.width/2,1680)}
    }else{
      if(logo){const s=190;ctx.drawImage(logo,(c.width-s)/2,180,s,s)}
      drawFitText(ctx,business,c.width/2,logo?470:300,c.width-260,92,'700');
      drawFitText(ctx,cta,c.width/2,700,c.width-220,118,'800');
      const qs=1450,qy=920;ctx.fillStyle='#fff';ctx.fillRect((c.width-qs)/2-60,qy-60,qs+120,qs+120);ctx.drawImage(qr,(c.width-qs)/2,qy,qs,qs);
      ctx.fillStyle=ink;ctx.font='500 54px Arial';ctx.fillText('Open your camera and scan to continue',c.width/2,2580);
      if(showVms){ctx.font='500 38px Arial';ctx.fillText('Made with Vision Make Studio',c.width/2,3120)}
    }
    return c;
  }
  function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),800)}
  async function png(data,preset){const c=await renderCanvas(data,preset);await new Promise((resolve,reject)=>c.toBlob(b=>{if(!b)return reject(new Error('PNG export failed.'));downloadBlob(b,`${safe(data.businessName)}-${preset}.png`);resolve()},'image/png'))}
  async function svg(data,preset){const c=await renderCanvas(data,preset);const p=PRESETS[preset]||PRESETS['qr-only'];
    if(preset==='qr-only'){
      const path=canvasToSvgPath(data.qrCanvas,54,54,p.w-108);const out=`<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="${esc(data.qrColor||'#003049')}"/></svg>`;downloadBlob(new Blob([out],{type:'image/svg+xml'}),`${safe(data.businessName)}-${preset}.svg`);return;
    }
    const img=c.toDataURL('image/png');const out=`<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}"><image href="${img}" width="${p.w}" height="${p.h}"/></svg>`;downloadBlob(new Blob([out],{type:'image/svg+xml'}),`${safe(data.businessName)}-${preset}.svg`)
  }
  async function ensureJsPdf(){if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});return window.jspdf?.jsPDF}
  async function pdf(data,preset){const c=await renderCanvas(data,preset),p=PRESETS[preset]||PRESETS['qr-only'];try{const jsPDF=await ensureJsPdf();if(!jsPDF)throw 0;const orientation=p.w>p.h?'landscape':'portrait';const doc=new jsPDF({orientation,unit:'px',format:[p.w,p.h],compress:true});doc.addImage(c.toDataURL('image/png'),'PNG',0,0,p.w,p.h,undefined,'FAST');doc.save(`${safe(data.businessName)}-${preset}.pdf`)}catch{print(data,preset)}}
  async function print(data,preset){const c=await renderCanvas(data,preset),p=PRESETS[preset]||PRESETS['qr-only'],u=c.toDataURL('image/png');const w=window.open('','_blank');if(!w)throw new Error('Allow pop-ups to print.');w.document.write(`<!doctype html><html><head><title>${esc(data.businessName||'VMS QR')}</title><style>@page{size:${p.inches.replace('×','x')};margin:0}html,body{margin:0}img{width:100%;height:auto;display:block}</style></head><body><img src="${u}"><script>onload=()=>setTimeout(()=>print(),250)<\/script></body></html>`);w.document.close()}
  window.VMSQRExport={PRESETS,renderCanvas,png,svg,pdf,print};
})();
