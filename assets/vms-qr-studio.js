/* VMS QR Studio (v2) — real QR codes saved in Supabase through /api/qr.
   Static codes hold their destination. Tracked codes print /q/<code>, count every scan
   (qr_scan_events) and can change destination without reprinting.
   Engine: assets/vms-qrcode.js (VMSQRMatrix). Exports: PNG, SVG, PDF and a client scan report. */
(()=>{
'use strict';
const V=window.VMSv2,root=document.getElementById('qsRoot');
if(!V||!root)return;
const {ic,esc,toast,sheet,closeSheet,api}=V;
const $=(s,r=root)=>r.querySelector(s),$$=(s,r=root)=>[...r.querySelectorAll(s)];

const TYPES=[['menu','Menu','menu'],['review','Reviews','star'],['booking','Booking','cal'],['wifi','Wi-Fi','wifi'],['website','Website','globe'],['social','Follow us','ig'],['custom','Custom link','link']];
const TNAME=Object.fromEntries(TYPES.map(t=>[t[0],t[1]]));
const CTA={website:'Visit our website',review:'Leave us a review',booking:'Book now',menu:'See our menu',social:'Follow us',wifi:'Free Wi-Fi',custom:'Scan to open'};
const HINT={website:'https://yourbusiness.com',review:'Paste the Google review link',booking:'https://yourbusiness.com/book',menu:'https://yourbusiness.com/menu',social:'https://instagram.com/yourbusiness',custom:'https://'};
const STYLES=[['classic','Classic'],['soft','Soft'],['dots','Dots'],['grad','Gradient']];
const COLORS=['#003049','#0B2233','#C1121F','#2F6F96','#1C6E4F','#6B3E26'];
const SIZES=[['s','Small','2 in · 600 px',2],['m','Medium','3 in · 900 px',3],['l','Large','5 in · 1500 px',5],['xl','Poster','8 in · 2400 px',8]];
const VMS_NAME='Vision Make Studio';
const S={qrs:[],scans:[],clients:[],filter:new URLSearchParams(location.search).get('client')||'all',show:'active',q:'',sel:null,ed:null,base:'',layout:'card',size:'m',loading:true,error:'',busy:false,legacy:[]};

/* ---------- helpers ---------- */
const clientName=id=>{const c=S.clients.find(c=>String(c.id)===String(id));return c?c.business_name:''};
const ini=n=>String(n||'').replace(/[^A-Za-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'QR';
const normUrl=u=>{u=String(u||'').trim();if(!u)return'';if(!/^https?:\/\//i.test(u))u='https://'+u;try{const x=new URL(u);return /^https?:$/.test(x.protocol)&&x.hostname.includes('.')?x.toString():''}catch{return''}};
const escWifi=s=>String(s||'').replace(/([\\;,:"])/g,'\\$1');
function wifiString(w){const t=w.sec==='nopass'?'nopass':w.sec||'WPA';return w.ssid?`WIFI:T:${t};S:${escWifi(w.ssid)};P:${t==='nopass'?'':escWifi(w.pass)};;`:''}
function parseWifi(p){const o={ssid:'',sec:'WPA',pass:''};p=String(p||'');if(!p.startsWith('WIFI:'))return o;let cur='',esc2=false;const parts=[];for(const ch of p.slice(5).replace(/;;$/,'')){if(esc2){cur+=ch;esc2=false}else if(ch==='\\')esc2=true;else if(ch===';'){parts.push(cur);cur=''}else cur+=ch}if(cur)parts.push(cur);
  for(const x of parts){const k=x.slice(0,2);if(k==='T:')o.sec=x.slice(2)||'WPA';if(k==='S:')o.ssid=x.slice(2);if(k==='P:')o.pass=x.slice(2)}return o}
const ago=d=>{if(!d)return'No scans yet';const t=new Date(d).getTime();if(!t)return'No scans yet';const s=(Date.now()-t)/1000;if(s<60)return'Just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';if(s<86400*7)return Math.round(s/86400)+' days ago';return new Date(t).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})};
const slug=s=>(String(s||'vms-qr').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'vms-qr');
const isTracked=e=>e&&e.mode==='dynamic';
const statusOf=r=>String(r&&r.status||'active');

function fromRow(r){const m=r.metadata||{};const t=r.qr_type||'website';
  return {id:r.id,code:r.code||'',client_id:r.client_id||'',name:r.name||'',qr_type:t,destination:t==='wifi'?'':(r.destination||''),wifi:t==='wifi'?parseWifi(r.destination):{ssid:'',sec:'WPA',pass:''},
    mode:r.mode==='dynamic'?'dynamic':'static',status:statusOf(r),cta:r.cta||CTA[t]||'',qr_color:r.qr_color||'#003049',bg_color:r.bg_color||'#FFFFFF',style:m.style||'classic',
    logo:m.logo||(r.logo_data?'image':'none'),logo_data:r.logo_data||'',show_business:m.show_business!==false,business_name:r.business_name||clientName(r.client_id)||VMS_NAME,frame_style:r.frame_style||'rounded',
    scan_count:Number(r.scan_count||0),last_scanned_at:r.last_scanned_at||null,created_at:r.created_at}}
function blank(t){const cid=S.filter!=='all'&&S.filter!=='none'?S.filter:'';
  return {id:null,code:'',client_id:cid,name:(clientName(cid)?clientName(cid)+' · ':'')+TNAME[t],qr_type:t,destination:'',wifi:{ssid:'',sec:'WPA',pass:''},mode:t==='wifi'?'static':'dynamic',status:'active',cta:CTA[t],
    qr_color:'#003049',bg_color:'#FFFFFF',style:'soft',logo:'none',logo_data:'',show_business:true,business_name:clientName(cid)||VMS_NAME,frame_style:'rounded',scan_count:0,last_scanned_at:null}}
const snap=e=>JSON.stringify(e,['client_id','name','qr_type','destination','wifi','ssid','sec','pass','mode','cta','qr_color','bg_color','style','logo','logo_data','show_business','business_name']);
const dirty=()=>S.ed&&snap(S.ed)!==S.base;
function encoded(e){if(!e)return'';if(e.qr_type==='wifi')return wifiString(e.wifi);if(isTracked(e)&&e.code)return location.origin+'/q/'+e.code;return normUrl(e.destination)}
function shown(e){if(e.qr_type==='wifi')return e.wifi.ssid?'Wi-Fi · '+e.wifi.ssid:'Add the network name';if(isTracked(e)&&e.code)return location.host+'/q/'+e.code;return normUrl(e.destination).replace(/^https?:\/\//,'').replace(/\/$/,'')||'Add a destination'}

/* ---------- styled QR renderer (Classic / Soft / Dots / Gradient) ---------- */
let logoImg=null,logoSrc='';
function getLogo(src){if(!src)return null;if(src===logoSrc)return logoImg;logoSrc=src;logoImg=new Image();logoImg.onload=()=>paintPreview();logoImg.src=src;return logoImg}
function matrix(text,withLogo){return window.VMSQRMatrix(text||' ',withLogo?'H':'M')}
function drawQR(cv,text,o){o=o||{};const style=o.style||'classic',fg=o.fg||'#003049',bg=o.bg||'#FFFFFF',size=o.size||240,quiet=o.quiet==null?2:o.quiet,dpr=o.dpr||Math.min(2,window.devicePixelRatio||1);
  const logo=o.logo&&o.logo!=='none';const m=matrix(text,logo);const n=m.n,cell=size/(n+quiet*2);
  cv.width=Math.round(size*dpr);cv.height=Math.round(size*dpr);const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);paint(x,m,{style,fg,bg,size,quiet,cell,logo:o.logo,initials:o.initials,img:o.img,ox:0,oy:0});return cv}
function paint(x,m,o){const {style,fg,bg,size,quiet,cell}=o,n=m.n,ox=o.ox||0,oy=o.oy||0;
  x.fillStyle=bg;x.fillRect(ox,oy,size,size);
  let fill=fg;if(style==='grad'){const g=x.createLinearGradient(ox,oy,ox+size,oy+size);g.addColorStop(0,fg);g.addColorStop(1,'#C1121F');fill=g}
  x.fillStyle=fill;
  const eye=(r,c)=>(r<7&&c<7)||(r<7&&c>=n-7)||(r>=n-7&&c<7);
  const rr=(px,py,w,h,r)=>{r=Math.max(0,Math.min(r,w/2,h/2));x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath()};
  const hasLogo=o.logo&&o.logo!=='none',lc=Math.floor(n/2),lr=hasLogo?Math.ceil(n*.12):-1;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){if(!m.dark(r,c)||eye(r,c))continue;if(hasLogo&&Math.abs(r-lc)<=lr&&Math.abs(c-lc)<=lr)continue;
    const px=ox+(c+quiet)*cell,py=oy+(r+quiet)*cell;
    if(style==='dots'){x.beginPath();x.arc(px+cell/2,py+cell/2,cell*.42,0,Math.PI*2);x.fill()}
    else if(style==='soft'){rr(px+cell*.06,py+cell*.06,cell*.88,cell*.88,cell*.32);x.fill()}
    else x.fillRect(px,py,cell+.35,cell+.35)}
  for(const [er,ec] of [[0,0],[0,n-7],[n-7,0]]){const px=ox+(ec+quiet)*cell,py=oy+(er+quiet)*cell,s=7*cell,rad=style==='classic'?0:cell*1.6;
    rr(px,py,s,s,rad);x.fill();x.fillStyle=bg;rr(px+cell,py+cell,s-2*cell,s-2*cell,Math.max(0,rad-cell*.6));x.fill();x.fillStyle=fill;rr(px+2*cell,py+2*cell,3*cell,3*cell,style==='classic'?0:cell*.9);x.fill()}
  if(hasLogo){const s=(lr*2+1)*cell,px=ox+(lc+quiet-lr)*cell,py=oy+(lc+quiet-lr)*cell;x.fillStyle=bg;rr(px,py,s,s,cell*1.5);x.fill();
    if(o.logo==='image'&&o.img&&o.img.complete&&o.img.naturalWidth){const pad=s*.12,w=s-pad*2,k=Math.min(w/o.img.naturalWidth,w/o.img.naturalHeight),iw=o.img.naturalWidth*k,ih=o.img.naturalHeight*k;x.drawImage(o.img,px+(s-iw)/2,py+(s-ih)/2,iw,ih)}
    else{x.fillStyle=typeof fill==='string'?fill:fg;x.font=`800 ${s*.4}px Unbounded,"Arial Black",sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(o.initials||'QR',px+s/2,py+s/2+1)}}
}
const qrOpts=e=>({style:e.style,fg:e.qr_color,bg:e.bg_color,logo:e.logo,initials:ini(e.business_name),img:e.logo==='image'?getLogo(e.logo_data):null});

/* ---------- export canvases ---------- */
function loadImg(src){return new Promise(res=>{if(!src)return res(null);const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src})}
async function exportCanvas(e,layout,px){const text=encoded(e);const img=e.logo==='image'?await loadImg(e.logo_data):null;const o=Object.assign(qrOpts(e),{img});
  if(layout==='only'){const c=document.createElement('canvas');drawQR(c,text,Object.assign(o,{size:px,dpr:1,quiet:4}));return c}
  const W=px,H=Math.round(px*1.25),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),u=W/320;
  x.fillStyle='#FFFFFF';x.fillRect(0,0,W,H);
  const qs=Math.round(220*u),m=matrix(text,o.logo&&o.logo!=='none'),cell=qs/(m.n+4);
  let y=Math.round(26*u);
  if(e.bg_color.toLowerCase()!=='#ffffff'){x.fillStyle=e.bg_color;x.fillRect(0,0,W,H)}
  paint(x,m,Object.assign(o,{size:qs,quiet:2,cell:qs/(m.n+4),ox:(W-qs)/2,oy:y}));y+=qs+Math.round(30*u);
  const ink='#003049',mut='#586A74';x.textAlign='center';x.textBaseline='alphabetic';
  x.fillStyle=ink;x.font=`700 ${Math.round(19*u)}px Unbounded,"Arial Black",sans-serif`;fitText(x,e.cta||'Scan me',W/2,y,W-40*u);y+=Math.round(24*u);
  x.fillStyle=mut;x.font=`500 ${Math.round(12.5*u)}px Inter,Arial,sans-serif`;x.fillText('Scan with your phone camera',W/2,y);y+=Math.round(26*u);
  const url=shown(e);x.font=`500 ${Math.round(12*u)}px Inter,Arial,sans-serif`;const tw=Math.min(x.measureText(url).width+24*u,W-48*u);
  x.fillStyle='#F4F0E6';rrect(x,(W-tw)/2,y-16*u,tw,24*u,12*u);x.fill();x.fillStyle='#26404F';fitText(x,url,W/2,y,tw-20*u);y+=Math.round(28*u);
  if(e.show_business){x.fillStyle=mut;x.font=`600 ${Math.round(12.5*u)}px Inter,Arial,sans-serif`;fitText(x,e.business_name||VMS_NAME,W/2,y,W-40*u)}
  x.fillStyle='#8A9AA3';x.font=`500 ${Math.round(10.5*u)}px Inter,Arial,sans-serif`;x.fillText('Made with Vision Make Studio',W/2,H-Math.round(16*u));
  return c}
function rrect(x,px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath()}
function fitText(x,t,cx,y,max){t=String(t);let s=t;while(x.measureText(s).width>max&&s.length>4)s=s.slice(0,-2);if(s!==t)s=s.slice(0,-1)+'…';x.fillText(s,cx,y)}

function svgFor(e,layout,px){const text=encoded(e),logo=e.logo&&e.logo!=='none',m=matrix(text,logo),n=m.n;
  const only=layout==='only',W=px,H=only?px:Math.round(px*1.25),u=W/320,qs=only?px:Math.round(220*u),quiet=only?4:2,cell=qs/(n+quiet*2),ox=only?0:(W-qs)/2,oy=only?0:Math.round(26*u);
  const fill=e.style==='grad'?'url(#g)':e.qr_color,eye=(r,c)=>(r<7&&c<7)||(r<7&&c>=n-7)||(r>=n-7&&c<7),lc=Math.floor(n/2),lr=logo?Math.ceil(n*.12):-1,f=v=>+v.toFixed(2);
  let d='';const out=[];
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){if(!m.dark(r,c)||eye(r,c))continue;if(logo&&Math.abs(r-lc)<=lr&&Math.abs(c-lc)<=lr)continue;const px2=ox+(c+quiet)*cell,py=oy+(r+quiet)*cell;
    if(e.style==='dots')out.push(`<circle cx="${f(px2+cell/2)}" cy="${f(py+cell/2)}" r="${f(cell*.42)}"/>`);
    else if(e.style==='soft')out.push(`<rect x="${f(px2+cell*.06)}" y="${f(py+cell*.06)}" width="${f(cell*.88)}" height="${f(cell*.88)}" rx="${f(cell*.32)}"/>`);
    else d+=`M${f(px2)} ${f(py)}h${f(cell+.2)}v${f(cell+.2)}h-${f(cell+.2)}z`}
  const eyes=[[0,0],[0,n-7],[n-7,0]].map(([er,ec])=>{const px2=ox+(ec+quiet)*cell,py=oy+(er+quiet)*cell,s=7*cell,rad=e.style==='classic'?0:cell*1.6;
    return `<rect x="${f(px2)}" y="${f(py)}" width="${f(s)}" height="${f(s)}" rx="${f(rad)}"/><rect x="${f(px2+cell)}" y="${f(py+cell)}" width="${f(s-2*cell)}" height="${f(s-2*cell)}" rx="${f(Math.max(0,rad-cell*.6))}" fill="${e.bg_color}"/><rect x="${f(px2+2*cell)}" y="${f(py+2*cell)}" width="${f(3*cell)}" height="${f(3*cell)}" rx="${f(e.style==='classic'?0:cell*.9)}"/>`}).join('');
  let lg='';if(logo){const s=(lr*2+1)*cell,px2=ox+(lc+quiet-lr)*cell,py=oy+(lc+quiet-lr)*cell;lg=`<rect x="${f(px2)}" y="${f(py)}" width="${f(s)}" height="${f(s)}" rx="${f(cell*1.5)}" fill="${e.bg_color}"/>`+
    (e.logo==='image'&&e.logo_data?`<image href="${esc(e.logo_data)}" x="${f(px2+s*.12)}" y="${f(py+s*.12)}" width="${f(s*.76)}" height="${f(s*.76)}" preserveAspectRatio="xMidYMid meet"/>`:`<text x="${f(px2+s/2)}" y="${f(py+s/2)}" font-family="Unbounded,Arial Black,sans-serif" font-weight="800" font-size="${f(s*.4)}" text-anchor="middle" dominant-baseline="central" fill="${e.qr_color}">${esc(ini(e.business_name))}</text>`)}
  let txt='';if(!only){let y=oy+qs+30*u;const T=(t,size,w,col,fam)=>{const s=`<text x="${f(W/2)}" y="${f(y)}" font-family="${fam||'Inter,Arial,sans-serif'}" font-weight="${w}" font-size="${f(size*u)}" text-anchor="middle" fill="${col}">${esc(t)}</text>`;return s};
    txt+=T(e.cta||'Scan me',19,700,'#003049','Unbounded,Arial Black,sans-serif');y+=24*u;txt+=T('Scan with your phone camera',12.5,500,'#586A74');y+=26*u;txt+=T(shown(e),12,500,'#26404F');y+=28*u;
    if(e.show_business)txt+=T(e.business_name||VMS_NAME,12.5,600,'#586A74');y=H-16*u;txt+=T('Made with Vision Make Studio',10.5,500,'#8A9AA3')}
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`+
    `<defs><linearGradient id="g" x1="${ox}" y1="${oy}" x2="${ox+qs}" y2="${oy+qs}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${e.qr_color}"/><stop offset="1" stop-color="#C1121F"/></linearGradient></defs>`+
    `<rect width="${W}" height="${H}" fill="${only?e.bg_color:(e.bg_color.toLowerCase()!=='#ffffff'?e.bg_color:'#FFFFFF')}"/>${only?'':`<rect x="${f(ox)}" y="${f(oy)}" width="${f(qs)}" height="${f(qs)}" fill="${e.bg_color}"/>`}<g fill="${fill}">${d?`<path d="${d}"/>`:''}${out.join('')}${eyes}</g>${lg}${txt}</svg>`}

/* one-page PDF writer (JPEG image, page size in inches) */
function pdfBlob(canvas,wIn,hIn){const b64=canvas.toDataURL('image/jpeg',.95).split(',')[1],bin=atob(b64),jpg=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)jpg[i]=bin.charCodeAt(i)&255;
  const W=Math.round(wIn*72),H=Math.round(hIn*72),parts=[],off=[0];let len=0;const push=p=>{parts.push(p);len+=typeof p==='string'?p.length:p.byteLength},obj=n=>{off[n]=len;push(n+' 0 obj\n')};
  push('%PDF-1.4\n%VMS\n');obj(1);push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');obj(2);push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  obj(3);push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  obj(4);push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.byteLength} >>\nstream\n`);push(jpg);push('\nendstream\nendobj\n');
  const content=`q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ\n`;obj(5);push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
  const xref=len;push('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)push(String(off[i]).padStart(10,'0')+' 00000 n \n');push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:'application/pdf'})}
const isIOS=()=>/iPad|iPhone|iPod/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
async function download(blob,name){const url=URL.createObjectURL(blob);
  if(isIOS()){try{const file=new File([blob],name,{type:blob.type});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});setTimeout(()=>URL.revokeObjectURL(url),2000);return}}catch(e){if(e&&e.name==='AbortError')return}
    window.open(url,'_blank')||(location.href=url);setTimeout(()=>URL.revokeObjectURL(url),60000);return}
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function doExport(fmt){const e=S.ed;if(!e)return;if(!encoded(e))return toast(e.qr_type==='wifi'?'Add the Wi-Fi network name first.':'Add a valid destination first.','error');
  if(isTracked(e)&&!e.code)return toast('Save this tracked code first. Its printed link is created when you save.','error');
  if(dirty())toast('Exporting your current edits. Remember to save them.');
  const sz=SIZES.find(s=>s[0]===S.size)||SIZES[1],inch=sz[3],px=inch*300,base=slug((e.business_name||'')+'-'+e.name)+(S.layout==='only'?'-qr':'-qr-card');
  try{if(fmt==='SVG')return download(new Blob([svgFor(e,S.layout,px)],{type:'image/svg+xml'}),base+'.svg');
    const c=await exportCanvas(e,S.layout,px);
    if(fmt==='PNG')return c.toBlob(b=>b&&download(b,base+'.png'),'image/png');
    return download(pdfBlob(c,inch,S.layout==='only'?inch:inch*1.25),base+'.pdf')}catch(err){toast('Could not export: '+(err.message||err),'error')}}

/* ---------- scan stats (from qr_scan_events) ---------- */
function stats(e){const ev=S.scans.filter(s=>String(s.qr_id)===String(e.id)).map(s=>({t:new Date(s.scanned_at).getTime(),d:s.device_type||'Other'})).filter(s=>s.t);
  const now=Date.now(),day=864e5,mStart=new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime();
  const weeks=[];for(let i=7;i>=0;i--){const end=now-i*7*day,start=end-7*day;weeks.push({n:ev.filter(s=>s.t>start&&s.t<=end).length,label:i===0?'This wk':new Date(start+day).toLocaleDateString([],{month:'short',day:'numeric'})})}
  const dev={};ev.forEach(s=>dev[s.d]=(dev[s.d]||0)+1);const topD=Object.entries(dev).sort((a,b)=>b[1]-a[1])[0];
  const slot={};ev.forEach(s=>{const d=new Date(s.t),k=d.getDay()+'-'+Math.floor(d.getHours()/2);slot[k]=(slot[k]||0)+1});const topS=Object.entries(slot).sort((a,b)=>b[1]-a[1])[0];
  const fmtH=h=>{const ap=h<12?'am':'pm',x=h%12||12;return x+ap};let busy='—';if(topS&&topS[1]>1){const [wd,b]=topS[0].split('-').map(Number);busy=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd]+' '+fmtH(b*2)+'–'+fmtH((b*2+2)%24)}
  return {total:Math.max(e.scan_count||0,ev.length),month:ev.filter(s=>s.t>=mStart).length,week:ev.filter(s=>s.t>now-7*day).length,weeks,top:topD?`${topD[0]} · ${Math.round(topD[1]/ev.length*100)}%`:'—',busy,last:e.last_scanned_at||(ev[0]?new Date(ev[0].t).toISOString():null),devices:dev,count:ev.length}}

async function reportPdf(){const e=S.ed;if(!e||!e.id)return;const st=stats(e),W=1275,H=1650,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#FFFFFF';x.fillRect(0,0,W,H);x.fillStyle='#003049';x.fillRect(0,0,W,230);
  const logo=await loadImg('/assets/vms-logo-cream.png');if(logo){const k=70/logo.naturalHeight;x.drawImage(logo,80,52,logo.naturalWidth*k,70)}
  x.fillStyle='#FDF0D5';x.font='700 44px Unbounded,"Arial Black",sans-serif';x.textAlign='left';x.fillText('QR scan report',80,180);
  x.font='500 24px Inter,Arial,sans-serif';x.textAlign='right';x.fillText(new Date().toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'}),W-80,180);
  x.textAlign='left';x.fillStyle='#0B2233';x.font='700 38px Inter,Arial,sans-serif';fitL(x,e.business_name||VMS_NAME,80,310,700);
  x.fillStyle='#586A74';x.font='500 26px Inter,Arial,sans-serif';fitL(x,e.name+' · '+TNAME[e.qr_type]+' · '+(isTracked(e)?'Tracked':'Static'),80,356,700);fitL(x,'Goes to: '+(e.qr_type==='wifi'?'Wi-Fi '+e.wifi.ssid:normUrl(e.destination)),80,398,700);
  const qc=document.createElement('canvas');drawQR(qc,encoded(e),Object.assign(qrOpts(e),{img:e.logo==='image'?await loadImg(e.logo_data):null,size:300,dpr:1,quiet:2}));x.drawImage(qc,W-80-300,262);
  const box=(bx,by,label,val)=>{x.fillStyle='#F4F0E6';rrect(x,bx,by,255,150,22);x.fill();x.fillStyle='#586A74';x.font='600 22px Inter,Arial,sans-serif';x.fillText(label,bx+24,by+46);x.fillStyle='#003049';x.font='700 50px Unbounded,"Arial Black",sans-serif';x.fillText(String(val),bx+24,by+114)};
  [['Total scans',st.total],['This month',st.month],['This week',st.week],['Last scan',ago(st.last).replace(' ago','')]].forEach((b,i)=>box(80+i*285,600,b[0],b[1]));
  x.fillStyle='#0B2233';x.font='700 30px Inter,Arial,sans-serif';x.fillText('Scans per week',80,850);
  const mx=Math.max(1,...st.weeks.map(w=>w.n)),bw=110,gap=28,by=1180;st.weeks.forEach((w,i)=>{const h=Math.max(6,w.n/mx*260),bx=80+i*(bw+gap);x.fillStyle='#669BBC';rrect(x,bx,by-h,bw,h,12);x.fill();x.fillStyle='#0B2233';x.font='700 24px Inter,Arial,sans-serif';x.textAlign='center';x.fillText(w.n,bx+bw/2,by-h-12);x.fillStyle='#586A74';x.font='500 20px Inter,Arial,sans-serif';x.fillText(w.label,bx+bw/2,by+34);x.textAlign='left'});
  x.fillStyle='#0B2233';x.font='700 30px Inter,Arial,sans-serif';x.fillText('Devices',80,1300);let dy=1350;const tot=Object.values(st.devices).reduce((a,b)=>a+b,0)||1;
  (Object.entries(st.devices).length?Object.entries(st.devices).sort((a,b)=>b[1]-a[1]):[['No scans yet',0]]).forEach(([k,v])=>{x.fillStyle='#26404F';x.font='500 24px Inter,Arial,sans-serif';x.fillText(k,80,dy);x.fillStyle='#EAE4D6';rrect(x,330,dy-20,600,22,11);x.fill();x.fillStyle='#003049';if(v){rrect(x,330,dy-20,Math.max(22,600*v/tot),22,11);x.fill()}x.fillStyle='#26404F';x.fillText(Math.round(v/tot*100)+'%',960,dy);dy+=48});
  x.fillStyle='#586A74';x.font='500 22px Inter,Arial,sans-serif';x.fillText('Busiest time: '+st.busy,80,dy+20);
  x.fillStyle='#8A9AA3';x.font='500 20px Inter,Arial,sans-serif';x.textAlign='center';x.fillText('Made with Vision Make Studio · visionmakestudio.com',W/2,H-50);
  download(pdfBlob(c,8.5,11),slug((e.business_name||'')+'-'+e.name)+'-scan-report.pdf')}
function fitL(x,t,px,py,max){t=String(t);let s=t;while(x.measureText(s).width>max&&s.length>4)s=s.slice(0,-2);if(s!==t)s=s.slice(0,-1)+'…';x.fillText(s,px,py)}

/* ---------- data ---------- */
async function load(){S.loading=true;render();try{const d=await api('/api/qr');S.qrs=d.qrs||[];S.scans=d.scans||[];S.clients=(d.clients||[]).filter(c=>c&&c.id);S.error=''}catch(err){S.error=err.message||'Could not load QR codes.'}
  S.loading=false;S.legacy=readLegacy();if(!S.ed&&S.sel){const r=S.qrs.find(q=>q.id===S.sel);if(r)edit(fromRow(r))}if(!S.ed){const first=visible()[0];if(first)select(first.id,true)}render()}
function readLegacy(){try{const rows=JSON.parse(localStorage.getItem('vms_qr_saved_library_v3')||'[]');return Array.isArray(rows)?rows.filter(r=>r&&!r.serverId&&!r.code&&!/^preview-/.test(String(r.id||''))&&(r.payload||r.destination)):[]}catch{return[]}}
function visible(){const q=S.q.trim().toLowerCase();return S.qrs.filter(r=>{if(S.filter==='none'&&r.client_id)return false;if(S.filter!=='all'&&S.filter!=='none'&&String(r.client_id)!==String(S.filter))return false;
  const st=statusOf(r);if(S.show==='active'&&st==='archived')return false;if(S.show==='archived'&&st!=='archived')return false;
  return!q||[r.name,r.business_name,r.destination,r.qr_type,clientName(r.client_id)].join(' ').toLowerCase().includes(q)})}
function edit(e){S.ed=e;S.base=snap(e);S.sel=e.id||null}
function select(id,quiet){const r=S.qrs.find(q=>q.id===id);if(!r)return;edit(fromRow(r));if(!quiet)render()}
function guard(next){if(!dirty())return next();sheet('Save your changes?','<p class="muted" style="margin-bottom:14px">“'+esc(S.ed.name||'This QR')+'” has changes that are not saved yet.</p><div class="row"><button class="btn pri" type="button" data-g="save">'+ic('check')+'Save</button><button class="btn gh" type="button" data-g="drop">Discard changes</button></div>',
  b=>b.onclick=async ev=>{const t=ev.target.closest('[data-g]');if(!t)return;closeSheet();if(t.dataset.g==='save'){if(await save())next()}else{S.base=snap(S.ed);next()}})}

function payload(e){const dest=e.qr_type==='wifi'?wifiString(e.wifi):normUrl(e.destination);const cl=S.clients.find(c=>String(c.id)===String(e.client_id));
  return {name:(e.name||'').trim()||TNAME[e.qr_type]+' QR',client_id:e.client_id||null,business_name:(e.business_name||'').trim()||(cl?cl.business_name:VMS_NAME),qr_type:e.qr_type,destination:dest,mode:e.qr_type==='wifi'?'static':e.mode,cta:(e.cta||'').trim(),
    qr_color:e.qr_color,bg_color:e.bg_color,frame_style:e.frame_style||'rounded',logo_data:e.logo==='image'?e.logo_data:null,show_vms:true,metadata:{style:e.style,logo:e.logo,show_business:e.show_business,layout:S.layout,studio:'v2'}}}
async function save(){const e=S.ed;if(!e||S.busy)return false;const p=payload(e);
  if(!p.destination){toast(e.qr_type==='wifi'?'Add the Wi-Fi network name.':'Add a valid web address (https://…).','error');$('#qUrl')?.focus();$('#qSsid')?.focus();return false}
  S.busy=true;paintSave();try{const d=await api('/api/qr',{method:'POST',body:Object.assign({action:e.id?'update':'create'},e.id?{id:e.id}:{},p)});const row=d.qr;if(!row)throw new Error('The QR was not saved.');
    const i=S.qrs.findIndex(q=>q.id===row.id);if(i>=0)S.qrs[i]=Object.assign({},S.qrs[i],row);else S.qrs.unshift(row);edit(fromRow(Object.assign({},S.qrs.find(q=>q.id===row.id))));
    toast(isTracked(S.ed)&&!e.id?'Tracked QR saved. Download it now — this printed code counts every scan.':'Saved to the QR library');return true}
  catch(err){toast(err.message||'Could not save the QR.','error');return false}finally{S.busy=false;render()}}
async function act(action,okMsg){const e=S.ed;if(!e||!e.id)return;try{await api('/api/qr',{method:'POST',body:{action,id:e.id}});
  if(action==='delete'){S.qrs=S.qrs.filter(q=>q.id!==e.id);S.scans=S.scans.filter(s=>s.qr_id!==e.id);S.ed=null;S.sel=null;const f=visible()[0];if(f)select(f.id,true)}
  else{const st={archive:'archived',restore:'active',suspend:'suspended',resume:'active'}[action];const r=S.qrs.find(q=>q.id===e.id);if(r)r.status=st;S.ed.status=st;S.base=snap(S.ed)}
  toast(okMsg);render()}catch(err){toast(err.message||'That did not work.','error')}}
function askDelete(){const e=S.ed;if(!e)return;if(!e.id){S.ed=null;S.sel=null;const f=visible()[0];if(f)select(f.id,true);render();return}
  const need=e.scan_count>0;sheet('Delete this QR?',`<p class="muted">“${esc(e.name)}” will be removed${isTracked(e)?' and printed copies will stop working':''}${need?`, along with <b>${e.scan_count}</b> recorded scans`:''}. This cannot be undone.</p>${need?`<div class="fld" style="margin-top:14px"><label for="qDelName">Type the QR name to confirm</label><input id="qDelName" class="inp" autocomplete="off" placeholder="${esc(e.name)}"></div>`:''}<div class="row" style="margin-top:16px"><button class="btn acc" type="button" data-d="yes"${need?' disabled':''}>${ic('trash')}Delete QR</button><button class="btn gh" type="button" data-d="no">Keep it</button>${isTracked(e)&&e.status!=='archived'?'<span class="sp"></span><button class="btn ghost sm" type="button" data-d="arch">'+ic('archive')+'Archive instead</button>':''}</div>`,
  b=>{const inp=b.querySelector('#qDelName'),yes=b.querySelector('[data-d=yes]');if(inp)inp.oninput=()=>{yes.disabled=inp.value.trim()!==e.name.trim()};
    b.onclick=ev=>{const t=ev.target.closest('[data-d]');if(!t||t.disabled)return;closeSheet();if(t.dataset.d==='yes')act('delete','QR deleted');if(t.dataset.d==='arch')act('archive','QR archived. Printed copies stop working until you restore it.')}})}
async function migrate(){const rows=S.legacy;if(!rows.length)return;let ok=0;const left=[];
  for(const r of rows){const t=['website','review','booking','menu','wifi','custom','social'].includes(r.type)?r.type:'custom';const dest=t==='wifi'?String(r.payload||''):normUrl(r.payload||r.destination);
    if(!dest){left.push(r);continue}const cl=S.clients.find(c=>String(c.business_name||'').toLowerCase()===String(r.client||'').toLowerCase());
    try{const d=await api('/api/qr',{method:'POST',body:{action:'create',name:r.name||r.client||'Saved QR',client_id:cl?cl.id:null,business_name:r.client||VMS_NAME,qr_type:t,destination:dest,mode:'static',cta:r.cta||CTA[t],qr_color:r.qrColor||'#003049',bg_color:r.bgColor||'#FFFFFF',frame_style:r.frame||'rounded',logo_data:r.logoData||null,show_vms:true,metadata:{style:'classic',logo:r.logoData?'image':'none',show_business:r.showBusinessName!==false,studio:'v2',moved_from:'device'}}});if(d.qr){S.qrs.unshift(d.qr);ok++}else left.push(r)}catch{left.push(r)}}
  try{const all=JSON.parse(localStorage.getItem('vms_qr_saved_library_v3')||'[]');const moved=new Set(rows.filter(r=>!left.includes(r)).map(r=>r.id));localStorage.setItem('vms_qr_saved_library_v3',JSON.stringify(all.filter(r=>!moved.has(r.id))))}catch{}
  S.legacy=left;toast(ok?`${ok} saved code${ok>1?'s':''} moved to the cloud library`:'Nothing could be moved. Check the saved addresses.',ok?'':'error');render()}

/* ---------- render ---------- */
function render(){
  if(S.loading&&!S.qrs.length){root.innerHTML='<div class="studio"><div class="stack"><div class="skel" style="height:96px"></div><div class="skel" style="height:52px"></div><div class="skel" style="height:260px"></div></div><div class="stack pvcol"><div class="skel" style="height:460px"></div></div></div>';return}
  const list=visible(),e=S.ed,cnt=S.qrs.filter(r=>statusOf(r)!=='archived').length;
  const clientOpts='<option value="all"'+(S.filter==='all'?' selected':'')+'>All clients</option>'+S.clients.map(c=>`<option value="${esc(c.id)}"${String(c.id)===String(S.filter)?' selected':''}>${esc(c.business_name||c.owner_email||'Client')}</option>`).join('')+`<option value="none"${S.filter==='none'?' selected':''}>Vision Make Studio (no client)</option>`;
  root.innerHTML=`${S.error?`<div class="note bad" style="margin-bottom:14px"><b>Could not reach the QR library.</b> ${esc(S.error)} <button class="btn gh sm" type="button" data-reload style="margin-left:8px">Try again</button></div>`:''}
  <div class="studio"><div class="stack">
   <div class="card flat"><div class="qs-top"><div class="fld"><label for="qsClient">Client</label><select id="qsClient" class="sel">${clientOpts}</select></div><span class="chip ok" style="margin-bottom:12px">${ic('check')}Tracked codes on</span></div></div>
   <div><div class="card-h" style="margin-bottom:10px"><h3>Start from a template</h3></div><div class="tpls">${TYPES.map(t=>`<button type="button" class="tpl" data-tpl="${t[0]}">${ic(t[2])}${t[1]}</button>`).join('')}</div></div>
   ${S.legacy.length?`<div class="card flat legacy"><div class="row"><div style="flex:1;min-width:200px"><b>${S.legacy.length} code${S.legacy.length>1?'s':''} saved only on this device</b><div class="muted" style="font-size:13.5px">Made in the old QR Tools. Move them into the cloud library so every device and client report can use them.</div></div><button class="btn pri sm" type="button" data-migrate>${ic('upload')}Move to cloud</button></div></div>`:''}
   <div class="card"><div class="card-h"><h3>${S.filter==='all'?'All codes':'Their codes'} <span class="muted" style="font-weight:500">${list.length}</span></h3><button class="btn pri sm" type="button" data-tpl="website">${ic('plus')}Create QR</button></div>
    <div class="qs-filter"><input class="inp" id="qsSearch" type="search" placeholder="Search codes" value="${esc(S.q)}" aria-label="Search codes"><div class="seg2" role="group" aria-label="Show"><button type="button" data-show="active" aria-pressed="${S.show==='active'}">Active</button><button type="button" data-show="archived" aria-pressed="${S.show==='archived'}">Archived</button><button type="button" data-show="all" aria-pressed="${S.show==='all'}">All</button></div></div>
    <div class="qrlist">${e&&!e.id?`<button type="button" class="qri draft" aria-current="true"><span class="th"><canvas data-qdraft></canvas></span><span style="min-width:0"><b>${esc(e.name||'New QR')}</b><span class="s">${esc(TNAME[e.qr_type])} · not saved yet</span></span><span class="end"><span class="chip warn">Draft</span></span></button>`:''}
     ${list.length?list.map(r=>{const st=statusOf(r),tr=r.mode==='dynamic';return `<button type="button" class="qri" data-qsel="${esc(r.id)}" aria-current="${e&&e.id===r.id}"><span class="th"><canvas data-qth="${esc(r.id)}"></canvas></span><span style="min-width:0"><b>${esc(r.name)}</b><span class="s">${esc(TNAME[r.qr_type]||r.qr_type)} · ${esc(S.filter==='all'?(r.business_name||clientName(r.client_id)||VMS_NAME):(r.qr_type==='wifi'?'Wi-Fi '+parseWifi(r.destination).ssid:r.destination))}</span></span><span class="end">${st==='archived'?'<span class="chip">Archived</span>':st==='suspended'?'<span class="chip warn">Paused</span>':tr?`<span class="chip info">${Number(r.scan_count||0)} scans</span>`:'<span class="chip">Static</span>'}</span></button>`}).join(''):(e&&!e.id?'':`<div class="empty">${S.q?'No codes match your search.':S.show==='archived'?'No archived codes.':'No codes yet. Pick a template above to make the first one.'}</div>`)}</div></div>
   ${e?editor(e):''}
  </div>
  <div class="stack pvcol">${e?previewCard(e)+activityCard(e):`<div class="card"><div class="empty">${ic('qr')}<p style="margin-top:8px">Pick a code or a template to start.</p></div></div>`}</div></div>`;
  paintThumbs();paintPreview();bindInputs();
}
function editor(e){const tr=isTracked(e),wifi=e.qr_type==='wifi',saved=!!e.id,st=e.status;
  return `<div class="card stack" id="qEd"><div class="card-h" style="margin:0"><h3>${saved?'Edit “'+esc(e.name)+'”':'New '+esc(TNAME[e.qr_type])+' QR'}</h3><span class="dirty" id="qDirty"></span><button class="btn dg sm" type="button" data-qdel>${ic('trash')}${saved?'Delete':'Discard'}</button></div>
   ${st==='suspended'?'<div class="note warn"><b>Paused.</b> Printed copies of this code do not open anything until you resume it.</div>':st==='archived'?'<div class="note warn"><b>Archived.</b> Printed copies of this code do not work until you restore it.</div>':''}
   <div class="row" style="gap:12px;align-items:flex-start"><div class="fld" style="flex:1;min-width:180px"><label for="qName">Name</label><input id="qName" class="inp" value="${esc(e.name)}" maxlength="120"></div><div class="fld" style="flex:1;min-width:180px"><label for="qType">Type</label><select id="qType" class="sel">${TYPES.map(t=>`<option value="${t[0]}"${t[0]===e.qr_type?' selected':''}>${t[1]}</option>`).join('')}</select></div></div>
   <div class="row" style="gap:12px;align-items:flex-start"><div class="fld" style="flex:1;min-width:180px"><label for="qClient">Client</label><select id="qClient" class="sel"><option value="">Vision Make Studio (no client)</option>${S.clients.map(c=>`<option value="${esc(c.id)}"${String(c.id)===String(e.client_id)?' selected':''}>${esc(c.business_name||c.owner_email)}</option>`).join('')}</select></div><div class="fld" style="flex:1;min-width:180px"><label for="qBiz">Name on the card</label><input id="qBiz" class="inp" value="${esc(e.business_name)}" maxlength="160"></div></div>
   ${wifi?`<div class="wifi-row"><div class="fld"><label for="qSsid">Network name</label><input id="qSsid" class="inp" value="${esc(e.wifi.ssid)}" autocomplete="off"></div><div class="fld"><label for="qSec">Security</label><select id="qSec" class="sel"><option value="WPA"${e.wifi.sec==='WPA'?' selected':''}>WPA / WPA2</option><option value="WEP"${e.wifi.sec==='WEP'?' selected':''}>WEP</option><option value="nopass"${e.wifi.sec==='nopass'?' selected':''}>No password</option></select></div></div>
     ${e.wifi.sec==='nopass'?'':`<div class="fld"><label for="qPass">Password</label><div class="pass"><input id="qPass" class="inp" type="password" value="${esc(e.wifi.pass)}" autocomplete="off"><button class="btn gh sm" type="button" data-showpass style="min-height:46px">Show</button></div></div>`}`
    :`<div class="fld"><label for="qUrl">Destination</label><input id="qUrl" class="inp" value="${esc(e.destination)}" inputmode="url" placeholder="${esc(HINT[e.qr_type]||'https://')}" autocomplete="off">${saved&&!tr?'<span class="muted" style="font-size:12.5px">Static code: reprint it after changing the destination.</span>':''}</div>`}
   <div class="trow"><div><b>Tracked code</b><span>${wifi?'Wi-Fi codes connect directly, so they cannot be tracked.':'Counts scans. Change the destination later without reprinting.'}</span></div><button type="button" class="tog" role="switch" aria-checked="${tr}" aria-label="Tracked code" data-qtrack${wifi?' aria-disabled="true"':''}></button></div>
   ${saved&&e.mode==='dynamic'&&!e.code?'':''}
   <div class="fld"><span class="l">Style</span><div class="styl">${STYLES.map(s=>`<button type="button" data-qstyle="${s[0]}" aria-pressed="${e.style===s[0]}"><canvas data-sty="${s[0]}"></canvas>${s[1]}</button>`).join('')}</div></div>
   <div class="fld"><span class="l">Color</span><div class="colrow"><div class="swatches">${COLORS.map(c=>`<button type="button" class="sw2" style="background:${c}" data-qcol="${c}" aria-pressed="${e.qr_color.toLowerCase()===c.toLowerCase()}" aria-label="Color ${c}"></button>`).join('')}</div><label class="colpick"><input type="color" id="qFg" value="${esc(e.qr_color)}" aria-label="Custom code color">Custom</label><label class="colpick"><input type="color" id="qBg" value="${esc(e.bg_color)}" aria-label="Background color">Background</label></div></div>
   <div class="row" style="gap:12px;align-items:flex-start"><div class="fld" style="flex:1;min-width:180px"><label for="qFrame">Text under the code</label><input id="qFrame" class="inp" value="${esc(e.cta)}" maxlength="60"></div>
    <div class="fld" style="flex:1;min-width:180px"><span class="l">Logo in center</span><div class="seg2"><button type="button" data-qlogo="none" aria-pressed="${e.logo==='none'}">None</button><button type="button" data-qlogo="initials" aria-pressed="${e.logo==='initials'}">Initials</button><button type="button" data-qlogo="image" aria-pressed="${e.logo==='image'}">${ic('img')}Image</button></div>
     ${e.logo==='image'?`<div class="logo-up">${e.logo_data?`<img src="${esc(e.logo_data)}" alt="Logo">`:''}<label class="btn gh sm" style="cursor:pointer">${ic('upload')}${e.logo_data?'Replace':'Upload logo'}<input type="file" id="qLogo" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label></div>`:''}</div></div>
   <div class="trow"><div><b>Show the name on the card</b><span>Prints “${esc(e.business_name||VMS_NAME)}” under the code.</span></div><button type="button" class="tog" role="switch" aria-checked="${e.show_business}" aria-label="Show the name on the card" data-qbiz></button></div>
   <div class="fld"><span class="l">Download size</span><div class="sizes">${SIZES.map(s=>`<button type="button" data-qsize="${s[0]}" aria-pressed="${S.size===s[0]}"><b>${s[1]}</b><span>${s[2]}</span></button>`).join('')}</div></div>
   <div class="row"><button class="btn pri" type="button" data-qsave>${ic('check')}${saved?'Save changes':'Save QR'}</button>${saved?'':`<span class="muted" style="font-size:13px">${tr?'Saving creates the tracked link that gets printed.':'Static codes open the destination directly.'}</span>`}</div>
  </div>`}
function previewCard(e){const saved=!!e.id,st=e.status;
  return `<div class="card"><div class="card-h"><h3>Preview</h3><div class="seg2"><button type="button" data-qlay="only" aria-pressed="${S.layout==='only'}">QR only</button><button type="button" data-qlay="card" aria-pressed="${S.layout==='card'}">QR card</button></div></div>
   <div class="qrcard ${S.layout==='only'?'only':''}" id="qCard"><canvas id="qMain" role="img" aria-label="QR code preview"></canvas><b id="pvCta"></b><small>Scan with your phone camera</small><span class="url" id="pvUrl"></span><small class="bn" id="pvBiz"></small><small class="foot">Made with Vision Make Studio</small></div>
   <div class="qs-acts"><button class="btn gh sm" type="button" data-exp="PNG">${ic('dl')}PNG</button><button class="btn gh sm" type="button" data-exp="PDF">${ic('dl')}PDF</button><button class="btn gh sm" type="button" data-exp="SVG">${ic('dl')}SVG</button><button class="btn pri sm" type="button" data-qsave>${ic('check')}Save</button></div>
   ${saved?`<div class="qs-more">${isTracked(e)&&e.code?`<button class="btn ghost sm" type="button" data-copy>${ic('copy')}Copy link</button>`:''}<button class="btn ghost sm" type="button" data-open>${ic('ext')}Open</button>
     ${isTracked(e)?(st==='suspended'?`<button class="btn ghost sm" type="button" data-qact="resume">${ic('play')}Resume</button>`:st==='active'?`<button class="btn ghost sm" type="button" data-qact="suspend">${ic('pause')}Pause</button>`:''):''}
     ${st==='archived'?`<button class="btn ghost sm" type="button" data-qact="restore">${ic('refresh')}Restore</button>`:`<button class="btn ghost sm" type="button" data-qact="archive">${ic('archive')}Archive</button>`}</div>`:''}</div>`}
function activityCard(e){if(!e.id)return `<div class="card"><div class="card-h"><h3>Scan activity</h3><span class="chip">${isTracked(e)?'Starts after saving':'Static code'}</span></div><p class="muted" style="font-size:14px">${isTracked(e)?'Save and print this code. Every scan shows up here.':'Turn on tracking to count scans and change where this code goes without reprinting.'}</p></div>`;
  if(!isTracked(e))return `<div class="card"><div class="card-h"><h3>Scan activity</h3><span class="chip">Static code</span></div><p class="muted" style="font-size:14px">Turn on tracking to count scans and change where this code goes without reprinting.</p></div>`;
  const s=stats(e),mx=Math.max(1,...s.weeks.map(w=>w.n));
  return `<div class="card"><div class="card-h"><h3>Scan activity</h3><span class="chip info">${s.month} this month</span></div>
   <div class="bars" role="img" aria-label="Scans per week, last 8 weeks">${s.weeks.map(w=>`<i style="height:${Math.max(3,w.n/mx*100)}%" title="${w.n} scans · week of ${esc(w.label)}"></i>`).join('')}</div><div class="bars-l"><span>${esc(s.weeks[0].label)}</span><span></span><span></span><span>${esc(s.weeks[4].label)}</span><span></span><span></span><span></span><span>This wk</span></div>
   <div class="kv qs-kv" style="margin-top:10px"><div class="r"><span>Total scans</span><b>${s.total}</b></div><div class="r"><span>Top device</span><b>${esc(s.top)}</b></div><div class="r"><span>Busiest time</span><b>${esc(s.busy)}</b></div><div class="r"><span>Last scan</span><b>${esc(ago(s.last))}</b></div></div>
   <button class="btn gh sm block" type="button" data-report style="margin-top:12px">${ic('report')}Client report (PDF)</button></div>`}
function paintThumbs(){$$('[data-qth]').forEach(c=>{const r=S.qrs.find(q=>q.id===c.dataset.qth);if(!r)return;const e=fromRow(r);drawQR(c,encoded(e)||' ',Object.assign(qrOpts(e),{size:52,img:null,logo:e.logo==='image'?'initials':e.logo}))});
  const d=$('[data-qdraft]');if(d&&S.ed)drawQR(d,encoded(S.ed)||'https://visionmakestudio.com',Object.assign(qrOpts(S.ed),{size:52}))}
function paintPreview(){const e=S.ed;if(!e)return;const cv=$('#qMain');if(cv){const t=encoded(e)||(e.qr_type==='wifi'?'WIFI:T:WPA;S:;P:;;':'https://visionmakestudio.com');drawQR(cv,t,Object.assign(qrOpts(e),{size:220}));cv.style.opacity=encoded(e)?'1':'.35'}
  const card=$('#qCard');if(card)card.style.background=S.layout==='only'?e.bg_color:'';
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=v};set('#pvCta',e.cta||'Scan me');set('#pvUrl',isTracked(e)&&!e.code&&e.qr_type!=='wifi'?'Tracked link is created when you save':shown(e));set('#pvBiz',e.show_business?(e.business_name||VMS_NAME):'');
  $$('[data-sty]').forEach(c=>drawQR(c,'VMS',{style:c.dataset.sty,fg:e.qr_color,bg:'#FFFFFF',size:44}));
  const dl=$('#qDirty');if(dl)dl.textContent=dirty()?'Unsaved changes':'';paintSave()}
function paintSave(){$$('[data-qsave]').forEach(b=>{b.disabled=S.busy;b.style.opacity=S.busy?'.6':''})}
function bindInputs(){const e=S.ed;const on=(id,fn,ev)=>{const el=$(id);if(el)el.addEventListener(ev||'input',()=>{fn(el.value);paintPreview();if(id==='#qName'){const b=$('.qri[aria-current="true"] b');if(b)b.textContent=el.value||'New QR'}})};
  const cs=$('#qsClient');if(cs)cs.onchange=()=>{S.filter=cs.value;render()};
  const sr=$('#qsSearch');if(sr)sr.oninput=()=>{S.q=sr.value;const pos=sr.selectionStart;render();const n=$('#qsSearch');n.focus();n.setSelectionRange(pos,pos)};
  if(!e)return;
  on('#qName',v=>e.name=v);on('#qUrl',v=>e.destination=v);on('#qFrame',v=>e.cta=v);on('#qBiz',v=>e.business_name=v);
  on('#qSsid',v=>e.wifi.ssid=v);on('#qPass',v=>e.wifi.pass=v);on('#qFg',v=>{e.qr_color=v;$$('[data-qcol]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.qcol.toLowerCase()===v.toLowerCase())))});on('#qBg',v=>e.bg_color=v);
  const sec=$('#qSec');if(sec)sec.onchange=()=>{e.wifi.sec=sec.value;render()};
  const ty=$('#qType');if(ty)ty.onchange=()=>{const old=e.qr_type,t=ty.value;if(old==='wifi'||t==='wifi'){e.destination='';e.wifi={ssid:'',sec:'WPA',pass:''}}if(!e.cta||e.cta===CTA[old])e.cta=CTA[t];e.qr_type=t;if(t==='wifi')e.mode='static';render()};
  const qc=$('#qClient');if(qc)qc.onchange=()=>{const prevName=clientName(e.client_id)||VMS_NAME;e.client_id=qc.value;if(!e.business_name||e.business_name===prevName)e.business_name=clientName(qc.value)||VMS_NAME;render()};
  const lf=$('#qLogo');if(lf)lf.onchange=()=>{const f=lf.files&&lf.files[0];if(!f)return;if(f.size>2e6)return toast('Pick a logo under 2 MB.','error');const rd=new FileReader();rd.onload=()=>shrink(rd.result).then(d=>{e.logo_data=d;e.logo='image';render()});rd.readAsDataURL(f)}}
function shrink(src){return new Promise(res=>{const i=new Image();i.onload=()=>{const k=Math.min(1,320/Math.max(i.naturalWidth,i.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(i.naturalWidth*k);c.height=Math.round(i.naturalHeight*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/png'))};i.onerror=()=>res(src);i.src=src})}

root.addEventListener('click',ev=>{const t=ev.target.closest('button');if(!t||!root.contains(t))return;const d=t.dataset,e=S.ed;
  if(d.qsel){if(e&&e.id===d.qsel)return;return guard(()=>{select(d.qsel);document.getElementById('qEd')?.scrollIntoView({behavior:'smooth',block:'start'})})}
  if(d.tpl)return guard(()=>{edit(blank(d.tpl));S.base='';render();const n=$('#qName');n&&n.scrollIntoView({behavior:'smooth',block:'center'})});
  if('reload' in d)return load();
  if('migrate' in d)return migrate();
  if(d.show){S.show=d.show;return render()}
  if(!e)return;
  if(d.qstyle){e.style=d.qstyle;return render()}
  if(d.qcol){e.qr_color=d.qcol;return render()}
  if(d.qlogo){e.logo=d.qlogo;return render()}
  if(d.qlay){S.layout=d.qlay;return render()}
  if(d.qsize){S.size=d.qsize;return render()}
  if('qtrack' in d){if(t.getAttribute('aria-disabled')==='true')return toast('Wi-Fi codes connect directly, so they cannot be tracked.');
    if(e.id&&e.mode==='dynamic')toast('Printed copies keep working but stop counting scans. Download the new static code after saving.');e.mode=e.mode==='dynamic'?'static':'dynamic';return render()}
  if('qbiz' in d){e.show_business=!e.show_business;return render()}
  if('showpass' in d){const p=$('#qPass');if(p){p.type=p.type==='password'?'text':'password';t.textContent=p.type==='password'?'Show':'Hide'}return}
  if('qsave' in d)return save();
  if('qdel' in d)return askDelete();
  if(d.exp)return doExport(d.exp);
  if('report' in d)return reportPdf();
  if('copy' in d){const u=encoded(e);return (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>toast('Link copied'),()=>toast(u))}
  if('open' in d){const u=e.qr_type==='wifi'?'':(isTracked(e)&&e.code?location.origin+'/q/'+e.code:normUrl(e.destination));if(!u)return toast('Wi-Fi codes join a network, there is no page to open.');return window.open(u,'_blank','noopener')}
  if(d.qact){const m={archive:'QR archived. Printed copies stop working until you restore it.',restore:'QR restored',suspend:'Paused. Printed copies stop opening until you resume.',resume:'QR resumed'};return act(d.qact,m[d.qact])}
});
window.addEventListener('beforeunload',ev=>{if(dirty()){ev.preventDefault();ev.returnValue=''}});
render();
V.ready().then(load);
})();
