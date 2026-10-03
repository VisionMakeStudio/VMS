/* VMS homepage — interactive media showcase (Real estate 3D house + floor plan, Restaurant table angles, Automotive hotspots).
   Follows the Photo/video tab that is selected in #mediaBody. No libraries; CSS 3D only. */
(()=>{
  'use strict';
  const host=document.getElementById('mShow');if(!host)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---------- Real estate: house and floor plan ---------- */
  const W=300,D=220,H=64;
  const ROOMS=[
    {id:'living',name:'Living room',x:0,y:0,w:180,h:120,shots:'6 wide photos, natural light, one twilight angle'},
    {id:'kitchen',name:'Kitchen',x:180,y:0,w:120,h:120,shots:'4 photos plus detail shots of finishes'},
    {id:'bed1',name:'Primary bedroom',x:0,y:120,w:120,h:100,shots:'3 photos, styled and straightened'},
    {id:'bath',name:'Bath',x:120,y:120,w:60,h:100,shots:'2 photos, mirror-safe angles'},
    {id:'bed2',name:'Bedroom 2',x:180,y:120,w:120,h:100,shots:'2 photos'}
  ];
  const WALLS=[[0,0,W,'x'],[0,D,W,'x'],[0,0,D,'y'],[W,0,D,'y'],[180,0,120,'y'],[0,120,W,'x'],[120,120,100,'y'],[180,120,100,'y']];
  const PATH=[[60,200],[60,60],[150,60],[240,60],[240,170],[150,170]];
  function houseHtml(){
    const rooms=ROOMS.map(r=>'<button class="ms-room" type="button" data-room="'+r.id+'" style="left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px" aria-label="'+esc(r.name)+'"><span class="ms-pin"><b>'+esc(r.name)+'</b></span></button>').join('');
    const walls=WALLS.map(([x,y,len,dir])=>'<i class="ms-wall '+dir+'" style="left:'+x+'px;top:'+y+'px;width:'+len+'px"></i>').join('');
    const door='<i class="ms-door" style="left:40px;top:'+D+'px"></i>';
    return '<div class="ms-world" id="msWorld" style="width:'+W+'px;height:'+D+'px">'+
      '<div class="ms-lawn"></div><div class="ms-floor"></div>'+rooms+walls+door+
      '<i class="ms-gable" style="left:0"></i><i class="ms-gable" style="left:'+W+'px"></i><div class="ms-roof a" style="width:'+W+'px"></div><div class="ms-roof b" style="width:'+W+'px"></div>'+
      '<i class="ms-cam" id="msCam" aria-hidden="true"></i></div>';
  }
  /* ---------- Restaurant: table ---------- */
  const DISHES=[
    {id:'pizza',name:'Margherita',x:70,y:70,c:'#d9472b',shot:'Hero shot, steam and basil detail'},
    {id:'salad',name:'Garden salad',x:200,y:60,c:'#5b9a43',shot:'Overhead with props, menu-ready crop'},
    {id:'pasta',name:'Rigatoni',x:140,y:170,c:'#e2a13b',shot:'45° plating shot with depth'}
  ];
  function tableHtml(){
    return '<div class="ms-table" id="msTable"><div class="ms-wood"></div>'+
      DISHES.map(d=>'<button class="ms-plate" type="button" data-dish="'+d.id+'" style="left:'+d.x+'px;top:'+d.y+'px;--food:'+d.c+'" aria-label="'+esc(d.name)+'"><i></i><span class="ms-pin"><b>'+esc(d.name)+'</b></span></button>').join('')+
      '<i class="ms-glass" style="left:250px;top:150px"></i><i class="ms-glass" style="left:40px;top:180px"></i><i class="ms-candle" style="left:150px;top:110px"></i><div class="ms-menu"><b>Menu</b><span></span><span></span><span></span></div></div>'+
      '<div class="ms-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
  }
  /* ---------- Automotive: car ---------- */
  const SPOTS=[
    {id:'ext',name:'Exterior 3/4',x:22,y:46,shot:'Front three-quarter, low angle, clean background'},
    {id:'wheel',name:'Wheels',x:30,y:72,shot:'Wheel and brake detail, every corner'},
    {id:'int',name:'Interior',x:52,y:40,shot:'Dash, seats and console, doors open'},
    {id:'rear',name:'Rear',x:82,y:52,shot:'Rear three-quarter with lights on'}
  ];
  function carHtml(){
    return '<div class="ms-car" id="msCar"><svg viewBox="0 0 400 170" aria-hidden="true"><defs><linearGradient id="msBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b5f80"/><stop offset="1" stop-color="#003049"/></linearGradient></defs>'+
      '<ellipse cx="200" cy="150" rx="170" ry="10" fill="rgba(0,0,0,.18)"/>'+
      '<path d="M40 118 C42 96 70 88 104 84 L150 52 C170 40 230 38 262 50 L312 82 C350 86 368 98 366 120 L362 130 L44 130 Z" fill="url(#msBody)"/>'+
      '<path d="M158 58 L190 50 L196 84 L132 86 Z M206 50 C230 50 250 54 262 62 L292 84 L210 84 Z" fill="#cfe3ef" opacity=".9"/>'+
      '<rect x="340" y="98" width="20" height="8" rx="3" class="ms-tail"/><path d="M44 104 L66 100 L64 110 L44 112 Z" class="ms-head"/>'+
      '<circle cx="110" cy="130" r="25" fill="#102f40"/><circle cx="110" cy="130" r="12" fill="#9fb4c0"/><circle cx="300" cy="130" r="25" fill="#102f40"/><circle cx="300" cy="130" r="12" fill="#9fb4c0"/>'+
      '<path class="ms-beam" d="M44 106 L-60 80 L-60 140 Z"/></svg>'+
      SPOTS.map(s=>'<button class="ms-spot" type="button" data-spot="'+s.id+'" style="left:'+s.x+'%;top:'+s.y+'%" aria-label="'+esc(s.name)+'"><i></i></button>').join('')+'</div>';
  }

  const SCENES={
    re:{title:'Explore a listing shoot',controls:[['ext','3D exterior'],['plan','Floor plan'],['walk','Walkthrough']],hint:'Drag to turn the house. Tap a room to see what we shoot there.',
        info:'<b>Listing media</b><span>Bright photos, a measured floor plan and a walkthrough video, delivered as one link.</span>'},
    rest:{title:'Pick a camera angle',controls:[['top','Overhead'],['tilt','45° plating'],['amb','Ambience']],hint:'Tap a dish to frame its hero shot.',
        info:'<b>Menu-ready photos</b><span>Overhead, 45° and ambience shots, cropped for your menu, Google and social.</span>'},
    auto:{title:'Plan the car shoot',controls:[['day','Daylight'],['lights','Lights on']],hint:'Tap a point on the car to see the shot.',
        info:'<b>Vehicle media</b><span>Consistent angles for every car, ready for listings and social.</span>'}
  };
  let scene='',mode='',rz=-34,dragging=false,auto=null,walkTimer=null;

  function render(id){
    if(!SCENES[id])id='re';
    if(id===scene)return;scene=id;stopAuto();stopWalk();
    const s=SCENES[id];
    host.innerHTML='<div class="ms-wrap"><div class="ms-stage" id="msStage" data-scene="'+id+'">'+(id==='re'?houseHtml():id==='rest'?tableHtml():carHtml())+'</div>'+
      '<div class="ms-side"><h3>'+s.title+'</h3><div class="ms-seg" role="group" aria-label="View">'+s.controls.map((c,i)=>'<button type="button" data-mode="'+c[0]+'" aria-pressed="'+(i===0)+'">'+c[1]+'</button>').join('')+'</div>'+
      '<p class="ms-hint">'+s.hint+'</p><div class="ms-info" id="msInfo" aria-live="polite">'+s.info+'</div></div></div>';
    setMode(s.controls[0][0]);
    if(id==='re'){applyRot();if(!reduce)startAuto();bindDrag()}
  }
  function setMode(m){
    mode=m;const st=document.getElementById('msStage');if(!st)return;
    st.dataset.mode=m;host.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
    if(scene==='re'){stopWalk();if(m==='walk')walk()}
  }
  function applyRot(){const w=document.getElementById('msWorld');if(w)w.style.setProperty('--rz',rz+'deg')}
  function startAuto(){stopAuto();let last=performance.now();const step=t=>{if(!dragging){rz+=(t-last)*0.006;applyRot()}last=t;auto=requestAnimationFrame(step)};auto=requestAnimationFrame(step)}
  function stopAuto(){if(auto)cancelAnimationFrame(auto);auto=null}
  function bindDrag(){
    const st=document.getElementById('msStage');let x0=0,r0=0,moved=false;
    st.addEventListener('pointerdown',e=>{dragging=true;moved=false;x0=e.clientX;r0=rz;stopAuto()});
    window.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-x0;if(Math.abs(dx)>4)moved=true;rz=r0+dx*0.5;applyRot()});
    window.addEventListener('pointerup',()=>{dragging=false});
    st.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault()}},true);
  }
  function walk(){
    const cam=document.getElementById('msCam');if(!cam)return;let i=0;cam.classList.add('on');
    const go=()=>{const p=PATH[i%PATH.length];cam.style.left=p[0]+'px';cam.style.top=p[1]+'px';i++;walkTimer=setTimeout(go,reduce?0:900)};
    go();info('<b>Walkthrough video</b><span>A smooth path through every room, front door first, ending on the best view.</span>');
  }
  function stopWalk(){clearTimeout(walkTimer);walkTimer=null;const cam=document.getElementById('msCam');if(cam)cam.classList.remove('on')}
  function info(html){const el=document.getElementById('msInfo');if(el)el.innerHTML=html}

  host.addEventListener('click',e=>{
    const m=e.target.closest('[data-mode]');if(m){setMode(m.dataset.mode);if(scene==='rest')info(SCENES.rest.info);return}
    const r=e.target.closest('[data-room]');if(r){if(mode==='ext')setMode('plan');host.querySelectorAll('.ms-room').forEach(x=>x.classList.toggle('on',x===r));const d=ROOMS.find(x=>x.id===r.dataset.room);info('<b>'+esc(d.name)+'</b><span>'+esc(d.shots)+'</span>');return}
    const p=e.target.closest('[data-dish]');if(p){host.querySelectorAll('.ms-plate').forEach(x=>x.classList.toggle('on',x===p));const d=DISHES.find(x=>x.id===p.dataset.dish);info('<b>'+esc(d.name)+'</b><span>'+esc(d.shot)+'</span>');return}
    const s=e.target.closest('[data-spot]');if(s){host.querySelectorAll('.ms-spot').forEach(x=>x.classList.toggle('on',x===s));const d=SPOTS.find(x=>x.id===s.dataset.spot);info('<b>'+esc(d.name)+'</b><span>'+esc(d.shot)+'</span>');return}
  });

  /* Follow the Photo/video tab the visitor selects */
  function current(){const t=document.querySelector('#mediaBody [role="tab"][aria-selected="true"]');return t?t.id.replace('mtab-',''):'re'}
  const mb=document.getElementById('mediaBody');
  if(mb)new MutationObserver(()=>render(current())).observe(mb,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-selected']});
  /* Pause the auto-turn while the section is off screen */
  if('IntersectionObserver' in window)new IntersectionObserver(es=>es.forEach(en=>{if(scene!=='re'||reduce)return;if(en.isIntersecting)startAuto();else stopAuto()})).observe(host);
  render(current());
})();
