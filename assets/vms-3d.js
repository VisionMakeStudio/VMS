/* VMS 3D stage — real-time WebGL house + food table for the homepage Photo & Video section. No libraries. */
(function(){
const V=(x,y,z)=>[x,y,z];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};
const hex=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]};
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

function box(F,x,y,z,w,h,d,c,o){o=o||{};const x2=x+w,y2=y+h,z2=z+d,a=o.alpha;const q=p=>F.push({p,c,alpha:a});
  q([V(x,y2,z),V(x,y2,z2),V(x2,y2,z2),V(x2,y2,z)]);if(!o.noBottom)q([V(x,y,z),V(x2,y,z),V(x2,y,z2),V(x,y,z2)]);
  q([V(x,y,z2),V(x2,y,z2),V(x2,y2,z2),V(x,y2,z2)]);q([V(x2,y,z),V(x,y,z),V(x,y2,z),V(x2,y2,z)]);
  q([V(x,y,z),V(x,y,z2),V(x,y2,z2),V(x,y2,z)]);q([V(x2,y,z2),V(x2,y,z),V(x2,y2,z),V(x2,y2,z2)])}
function cyl(F,cx,y,cz,r,h,seg,c,top){const P=[];for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2;P.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r])}
  for(let i=0;i<seg;i++){const a=P[i],b=P[(i+1)%seg];F.push({p:[V(a[0],y,a[1]),V(a[0],y+h,a[1]),V(b[0],y+h,b[1]),V(b[0],y,b[1])],c})}
  F.push({p:P.slice().reverse().map(p=>V(p[0],y+h,p[1])),c:top||c})}
function cone(F,cx,y,cz,r1,r2,h,seg,c,top){const A=[],B=[];for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2;A.push(V(cx+Math.cos(a)*r1,y,cz+Math.sin(a)*r1));B.push(V(cx+Math.cos(a)*r2,y+h,cz+Math.sin(a)*r2))}
  for(let i=0;i<seg;i++){const j=(i+1)%seg;F.push({p:[A[i],B[i],B[j],A[j]],c})}if(top)F.push({p:B.slice().reverse(),c:top})}
function ball(F,cx,cy,cz,rx,c,seg,ry,rz){seg=seg||10;ry=ry||rx;rz=rz||rx;const R=Math.max(4,Math.round(seg*.6));
  const P=(a,b)=>V(cx+Math.cos(a)*Math.cos(b)*rx,cy+Math.sin(a)*ry,cz+Math.cos(a)*Math.sin(b)*rz);
  for(let k=0;k<R;k++){const a1=-Math.PI/2+k/R*Math.PI,a2=-Math.PI/2+(k+1)/R*Math.PI;for(let i=0;i<seg;i++){const b1=i/seg*Math.PI*2,b2=(i+1)/seg*Math.PI*2;F.push({p:[P(a1,b1),P(a2,b1),P(a2,b2),P(a1,b2)],c})}}}
function dome(F,cx,y,cz,r,hy,seg,c){const R=5;for(let k=0;k<R;k++){const a1=k/R*Math.PI/2,a2=(k+1)/R*Math.PI/2,r1=Math.cos(a1)*r,r2=Math.cos(a2)*r,y1=y+Math.sin(a1)*hy,y2=y+Math.sin(a2)*hy;
  for(let i=0;i<seg;i++){const b1=i/seg*Math.PI*2,b2=(i+1)/seg*Math.PI*2;F.push({p:[V(cx+Math.cos(b1)*r1,y1,cz+Math.sin(b1)*r1),V(cx+Math.cos(b1)*r2,y2,cz+Math.sin(b1)*r2),V(cx+Math.cos(b2)*r2,y2,cz+Math.sin(b2)*r2),V(cx+Math.cos(b2)*r1,y1,cz+Math.sin(b2)*r1)],c})}}}

const VS=`attribute vec3 p;attribute vec3 n;attribute vec4 c;uniform mat4 m;varying vec3 vn;varying vec4 vc;varying float vd;void main(){vn=n;vc=c;vec4 q=m*vec4(p,1.);vd=q.w;gl_Position=q;}`;
const FS=`precision mediump float;varying vec3 vn;varying vec4 vc;varying float vd;uniform vec3 L;uniform vec3 tint;uniform float amb;uniform vec3 fogc;uniform float fogk;
void main(){vec3 n=normalize(gl_FrontFacing?vn:-vn);float d=max(dot(n,L),0.);float sky=.5+.5*n.y;vec3 col=vc.rgb*(amb*mix(.72,1.12,sky)+(1.-amb)*d*1.08)*tint;
float f=clamp((vd-fogk)/70.,0.,.5);gl_FragColor=vec4(mix(col,fogc,f),vc.a);}`;
const mat=()=>new Float32Array(16);
function persp(f,a,n,fa){const m=mat(),t=1/Math.tan(f/2);m[0]=t/a;m[5]=t;m[10]=(fa+n)/(n-fa);m[11]=-1;m[14]=2*fa*n/(n-fa);return m}
function look(e,t,u){const z=norm(sub(e,t)),x=norm(cross(u,z)),y=cross(z,x),m=mat();m[0]=x[0];m[4]=x[1];m[8]=x[2];m[1]=y[0];m[5]=y[1];m[9]=y[2];m[2]=z[0];m[6]=z[1];m[10]=z[2];m[12]=-dot(x,e);m[13]=-dot(y,e);m[14]=-dot(z,e);m[15]=1;return m}
function mul(a,b){const o=mat();for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}return o}

function Stage(canvas,opts){const S=this;S.cv=canvas;S.opts=opts;
  const gl=canvas.getContext('webgl',{antialias:true,alpha:true});S.gl=gl;
  S.ov=document.createElement('canvas');S.ov.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';canvas.parentNode.insertBefore(S.ov,canvas.nextSibling);
  if(!gl){S.fail=true;canvas.parentNode.insertAdjacentHTML('beforeend','<p style="position:absolute;inset:0;display:grid;place-items:center;color:#FDF0D5;padding:20px;text-align:center">3D needs WebGL, which is turned off in this browser.</p>');return}
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o};const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
  const U=n=>gl.getUniformLocation(pr,n);S.loc={p:gl.getAttribLocation(pr,'p'),n:gl.getAttribLocation(pr,'n'),c:gl.getAttribLocation(pr,'c'),m:U('m'),L:U('L'),tint:U('tint'),amb:U('amb'),fogc:U('fogc'),fogk:U('fogk')};
  const B=()=>[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()];S.bo=B();S.bt=B();
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  S.cam={yaw:0,pitch:.5,dist:20,tx:0,ty:0,tz:0};S.light=norm([-.5,.85,.42]);S.tint=[1,1,1];S.amb=.5;S.fog=[0,.19,.29];S.geoDirty=true;S.dirty=true;
  let drag=null,pinch=null;const pts=new Map();
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===1)drag={x:e.clientX,y:e.clientY,yaw:S.cam.yaw,pitch:S.cam.pitch,moved:0};
    if(pts.size===2){const a=[...pts.values()];pinch={d:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),dist:S.cam.dist};drag=null}S.anim=null});
  canvas.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pinch&&pts.size===2){const a=[...pts.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);S.cam.dist=Math.max(opts.min,Math.min(opts.max,pinch.dist*pinch.d/d));S.dirty=true;return}
    if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=Math.max(drag.moved,Math.abs(dx)+Math.abs(dy));S.cam.yaw=drag.yaw-dx*.008;S.cam.pitch=Math.max(.06,Math.min(1.54,drag.pitch+dy*.006));S.dirty=true;S.onUser&&S.onUser()});
  const up=e=>{const tap=drag&&drag.moved<6;pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(tap&&S.onTap){const r=canvas.getBoundingClientRect();S.onTap(e.clientX-r.left,e.clientY-r.top)}drag=null};
  canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',e=>{e.preventDefault();S.cam.dist=Math.max(opts.min,Math.min(opts.max,S.cam.dist*(1+e.deltaY*.0012)));S.dirty=true;S.anim=null},{passive:false});
  S.fly=(to,ms)=>{S.anim={from:{...S.cam},to,t0:performance.now(),ms:ms||1200}};
  const loop=t=>{if(!document.body.contains(canvas))return;
    if(S.anim){const k=Math.min(1,(t-S.anim.t0)/S.anim.ms),e=ease(k);for(const key in S.anim.to){let a=S.anim.from[key],b=S.anim.to[key];if(key==='yaw'){while(b-a>Math.PI)b-=Math.PI*2;while(a-b>Math.PI)b+=Math.PI*2}S.cam[key]=lerp(a,b,e)}if(k>=1)S.anim=null;S.dirty=true}
    if(S.tick&&S.tick(t))S.dirty=true;if(S.dirty&&S.visible!==false){S.draw();S.dirty=false}requestAnimationFrame(loop)};
  requestAnimationFrame(loop);new ResizeObserver(()=>{S.dirty=true}).observe(canvas)}
Stage.prototype.upload=function(){const S=this,gl=S.gl,F=S.build(),O={p:[],n:[],c:[]},T={p:[],n:[],c:[]};
  for(const f of F){const P=f.p;if(P.length<3)continue;const a=f.alpha==null?1:f.alpha;if(a<=.01)continue;const n=norm(cross(sub(P[1],P[0]),sub(P[2],P[0]))),col=hex(f.c),D=a<1?T:O;
    for(let i=1;i<P.length-1;i++)for(const v of [P[0],P[i],P[i+1]]){D.p.push(v[0],v[1],v[2]);D.n.push(n[0],n[1],n[2]);D.c.push(col[0],col[1],col[2],a)}}
  const put=(Bf,D)=>{[D.p,D.n,D.c].forEach((arr,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,Bf[i]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW)});return D.p.length/3};
  S.cntO=put(S.bo,O);S.cntT=put(S.bt,T);S.geoDirty=false};
Stage.prototype.draw=function(){const S=this,gl=S.gl,cv=S.cv;if(S.fail)return;const dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
  for(const c of [cv,S.ov]){const w=Math.round(W*dpr),h=Math.round(H*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h}}
  if(S.geoDirty)S.upload();gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const c=S.cam,cp=Math.cos(c.pitch),eye=[c.tx+c.dist*cp*Math.sin(c.yaw),c.ty+c.dist*Math.sin(c.pitch),c.tz+c.dist*cp*Math.cos(c.yaw)];
  const M=mul(persp(.62,W/H,.3,220),look(eye,[c.tx,c.ty,c.tz],[0,1,0])),L=S.loc;
  gl.uniformMatrix4fv(L.m,false,M);gl.uniform3fv(L.L,S.light);gl.uniform3fv(L.tint,S.tint);gl.uniform1f(L.amb,S.amb);gl.uniform3fv(L.fogc,S.fog);gl.uniform1f(L.fogk,S.opts.fogk||30);
  const bind=Bf=>{[[L.p,3],[L.n,3],[L.c,4]].forEach((a,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,Bf[i]);gl.enableVertexAttribArray(a[0]);gl.vertexAttribPointer(a[0],a[1],gl.FLOAT,false,0,0)})};
  gl.depthMask(true);bind(S.bo);gl.drawArrays(gl.TRIANGLES,0,S.cntO);if(S.cntT){gl.depthMask(false);bind(S.bt);gl.drawArrays(gl.TRIANGLES,0,S.cntT);gl.depthMask(true)}
  const x=S.ov.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  const proj=p=>{const m=M,X=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],Y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];if(w<=.1)return null;return[(X/w*.5+.5)*W,(1-(Y/w*.5+.5))*H]};
  S.after&&S.after(x,proj,W,H)};

const ROOMS=[
 {id:'living',name:'Living room',x:-6,z:0,w:7,d:4.5,floor:'#B98B5E',shots:'Wide hero shot, golden-hour light, twilight version'},
 {id:'kitchen',name:'Kitchen',x:1,z:0,w:5,d:4.5,floor:'#D9D3C6',shots:'Island detail, appliances, natural-light wide'},
 {id:'bed',name:'Primary bedroom',x:-6,z:-4.5,w:5.5,d:4.5,floor:'#A97E55',shots:'Corner wide, styled bed detail'},
 {id:'bath',name:'Bathroom',x:-.5,z:-4.5,w:3,d:4.5,floor:'#E9E5DC',shots:'Vanity + shower, bright and clean'},
 {id:'office',name:'Office',x:2.5,z:-4.5,w:3.5,d:4.5,floor:'#B98B5E',shots:'Work-from-home angle, window light'}];
function House(canvas,hooks){const S=new Stage(canvas,{min:10,max:50,fogk:36});hooks=hooks||{};if(S.fail)return Object.assign(S,{mode(){},stop(){}});
  const st={wall:1,roof:1,mode:'ext',sel:null,auto:true};
  const FL=.4,WH=3,T=.2,X0=-6,X1=6,Z0=-4.5,Z1=4.5,SID='#EFE6D6',TRIM='#FFFFFF',ROOF='#3B4148',ROOF2='#30353B',GLASS='#8DB8D3',SHUT='#003049',IW='#E4DCCB';
  const winZ=(F,x,y,w,h,s,sh)=>{const z=s>0?Z1:Z0,o=s>0?1:-1,f=.1;
    box(F,x-w/2-f,y-f,s>0?z:z-.16,w+f*2,h+f*2,.16,TRIM);box(F,x-w/2,y,s>0?z+.14:z-.2,w,h,.06,GLASS);
    box(F,x-.025,y,s>0?z+.19:z-.24,.05,h,.05,TRIM);box(F,x-w/2,y+h/2-.025,s>0?z+.19:z-.24,w,.05,.05,TRIM);box(F,x-w/2-.2,y-.24,s>0?z:z-.32,w+.4,.12,.32,TRIM);
    if(sh){box(F,x-w/2-f-.52,y-f,s>0?z:z-.1,.44,h+f*2,.1,SHUT);box(F,x+w/2+f+.08,y-f,s>0?z:z-.1,.44,h+f*2,.1,SHUT)}};
  const winX=(F,zc,y,w,h,s)=>{const x=s>0?X1:X0,f=.1;box(F,s>0?x:x-.16,y-f,zc-w/2-f,.16,h+f*2,w+f*2,TRIM);box(F,s>0?x+.14:x-.2,y,zc-w/2,.06,h,w,GLASS);
    box(F,s>0?x+.19:x-.24,y,zc-.025,.05,h,.05,TRIM);box(F,s>0?x+.19:x-.24,y+h/2-.025,zc-w/2,.05,.05,w,TRIM)};
  const tree=(F,x,z,s)=>{cyl(F,x,0,z,.18*s,1.6*s,8,'#6B4A2E');ball(F,x,2.2*s,z,1.15*s,'#3E7A4A',10,1.05*s);ball(F,x+.55*s,2.7*s,z-.3*s,.85*s,'#4E8F55',9);ball(F,x-.45*s,2.85*s,z+.35*s,.8*s,'#5E9E5E',9)};
  const bush=(F,x,z,r,c)=>ball(F,x,r*.5,z,r,c||'#4E8F55',9,r*.72);
  S.build=()=>{const F=[],h=WH*st.wall,ext=st.wall>.97,y=FL+.04;
    box(F,-18,-.3,-14,36,.3,30,'#6FA05F',{noBottom:true});box(F,-18,-.28,11,36,.3,2.2,'#CBC6BC',{noBottom:true});box(F,-18,-.29,13.2,36,.3,2.8,'#4A4F55',{noBottom:true});
    box(F,-1.5,-.27,6.4,1.7,.3,4.6,'#D8D1C3',{noBottom:true});box(F,6.3,-.27,4.6,4.4,.3,6.4,'#9AA2A7',{noBottom:true});
    box(F,X0-.12,0,Z0-.12,12.24,FL,9.24,'#A19E97');box(F,6,0,-1.6,4.2,FL*.6,6.1,'#A19E97');
    for(const r of ROOMS)box(F,r.x,FL,r.z,r.w,.04,r.d,st.sel===r.id?'#F2C14E':r.floor);
    if(h>.05){box(F,X0,y,Z1-T,12,h,T,SID);box(F,X0,y,Z0,12,h,T,SID);box(F,X0,y,Z0,T,h,9,SID);box(F,X1-T,y,Z0,T,h,9,SID);
      for(const c of [[X0-.06,Z1-.14],[X1-.14,Z1-.14],[X0-.06,Z0-.06],[X1-.14,Z0-.06]])box(F,c[0],y,c[1],.2,h,.2,TRIM);
      box(F,X0,y,-.1,7,h,T,IW);box(F,1,y,-.1,5,h,T,IW);box(F,1,y,.1,T,h,4.2,IW);box(F,-.5,y,Z0,T,h,4.4,IW);box(F,2.5,y,Z0,T,h,4.4,IW);
      if(ext){winZ(F,-4.3,1.5,1.5,1.4,1,true);winZ(F,3.6,1.5,1.7,1.4,1,true);winZ(F,-3,1.6,1.4,1.2,-1);winZ(F,3.8,1.6,1.4,1.2,-1);winX(F,-2.4,1.6,1.4,1.2,-1);winX(F,2.2,1.6,1.4,1.2,-1);
        box(F,-1.25,y,Z1-.02,1.6,2.5,.14,TRIM);box(F,-1.1,y,Z1+.1,1.3,2.3,.06,'#8E0D17');box(F,-.8,y+1.5,Z1+.15,.7,.5,.03,GLASS);cyl(F,0,y+1.05,Z1+.2,.06,.05,8,'#C9A227');
        box(F,6,FL*.6,-1.5,4.1,2.7,6,SID);box(F,6.3,FL*.6,4.5,3.5,2.45,.06,TRIM);box(F,6.45,FL*.6,4.54,3.2,2.25,.06,'#E6DFD1');for(let i=1;i<5;i++)box(F,6.45,FL*.6+i*.45,4.6,3.2,.04,.04,'#CFC7B6')}
      box(F,-3.4,0,Z1,4.2,FL,2,'#B5AFA3');for(let i=0;i<2;i++)box(F,-1.6,0,Z1+2+i*.34,2,FL-(i+1)*.13,.34,'#B5AFA3');
      if(ext){for(const px of [-3.2,.55])box(F,px,FL,Z1+1.7,.22,2.6,.22,TRIM);box(F,-3.5,FL+2.6,Z1,4.4,.2,2.05,TRIM);
        F.push({p:[V(-3.6,FL+2.8,Z1+2.2),V(1,FL+2.8,Z1+2.2),V(1,FL+3.35,Z1),V(-3.6,FL+3.35,Z1)],c:ROOF});
        for(const fx of [-5.3,-4.3,2.7,3.7,4.7])bush(F,fx,Z1+.8,.55);for(const fx of [-5.7,-4.8,-3.9,2.3,3.2,4.2,5.1])ball(F,fx,.5,Z1+1.25,.12,fx>0?'#E25B45':'#F2C14E',7)}}
    box(F,-5.6,y,3.1,3.4,.45,1.1,'#2F6F96');box(F,-5.6,y,3.9,3.4,1,.32,'#244F6B');box(F,-5.75,y,3.1,.3,.75,1.1,'#244F6B');box(F,-2.5,y,3.1,.3,.75,1.1,'#244F6B');
    box(F,-4.6,y,1.6,1.5,.4,.8,'#7A5236');box(F,-5.7,y,.4,3.2,.02,2.2,'#D8C3A5');box(F,-1.5,y,.6,.25,1.5,2.3,'#1E1E1E');
    box(F,2.1,y,1.6,2.6,.95,1.1,'#EDE6D6');box(F,2.05,y+.95,1.55,2.7,.06,1.2,'#5A5F66');box(F,1.25,y,.15,4.6,.95,.65,'#B9B2A3');box(F,4.9,y,2.9,.9,2,.8,'#D8D8D8');for(const sx of [2.4,3.2,4])cyl(F,sx,y,3.05,.2,.75,12,'#2F2F2F');
    box(F,-5.7,y,-4.2,2.6,.6,3.2,'#F4EEE1');box(F,-5.7,y,-4.35,2.6,1.25,.3,'#7A5236');box(F,-5.5,y+.6,-4,2.2,.14,1,'#669BBC');box(F,-2.8,y,-4.2,.6,.6,.5,'#7A5236');
    box(F,-.1,y,-4.2,1.1,.55,2,'#FFFFFF');box(F,1.4,y,-1.1,.9,.9,.6,'#CFC6B4');box(F,3.1,y,-4.1,2.2,.78,1,'#7A5236');box(F,3.6,y+.78,-4,1,.6,.06,'#1A1A1A');cyl(F,4.1,y,-2.5,.3,.9,12,'#2F2F2F');
    tree(F,-11,6,1.1);tree(F,12,7.5,.9);tree(F,-12,-7,1.3);tree(F,9.5,-8.5,1.15);tree(F,-3,-10.5,1);for(const bz of [-3,-1,1,3])bush(F,X0-1.15,bz,.6,'#4E8F55');
    for(let i=0;i<13;i++)box(F,-13+i*2.2,0,-12.5,.12,1.1,.12,'#FFFFFF');box(F,-13,.75,-12.5,26.5,.1,.08,'#FFFFFF');box(F,-13,.35,-12.5,26.5,.1,.08,'#FFFFFF');
    box(F,-3,0,10.3,.1,1.1,.1,'#5A5A5A');box(F,-3.2,1.1,10.1,.5,.4,.55,'#003049');
    box(F,6.85,.3,6.6,2.7,.75,4.3,'#C1121F');F.push({p:[V(7.05,1.05,7.5),V(9.35,1.05,7.5),V(9.15,1.7,8.2),V(7.25,1.7,8.2)],c:GLASS});box(F,7.2,1.05,8.2,2,.65,2,'#A50F1B');F.push({p:[V(7.25,1.7,10.2),V(9.15,1.7,10.2),V(9.35,1.05,10.7),V(7.05,1.05,10.7)],c:GLASS});
    for(const w of [[6.85,7.5],[6.85,9.9],[9.5,7.5],[9.5,9.9]])box(F,w[0]-.05,0,w[1]-.4,.15,.62,.8,'#151515');
    if(st.roof>.01){const ry=y+WH+(1-st.roof)*7,al=st.roof<.99?st.roof:undefined,o=.65,pk=2.6,A=V(X0-o,ry,Z0-o),Bv=V(X1+o,ry,Z0-o),C=V(X1+o,ry,Z1+o),D=V(X0-o,ry,Z1+o),R1=V(X0-o,ry+pk,0),R2=V(X1+o,ry+pk,0);
      F.push({p:[D,C,R2,R1],c:ROOF,alpha:al},{p:[Bv,A,R1,R2],c:ROOF2,alpha:al},{p:[V(X0,ry,Z1),V(X0,ry,Z0),V(X0,ry+pk*.95,0)],c:SID,alpha:al},{p:[V(X1,ry,Z0),V(X1,ry,Z1),V(X1,ry+pk*.95,0)],c:SID,alpha:al});
      box(F,X0-o,ry-.22,Z1+o-.12,12+o*2,.22,.14,TRIM,{alpha:al});box(F,X0-o,ry-.22,Z0-o-.02,12+o*2,.22,.14,TRIM,{alpha:al});
      box(F,3,ry+.4,-2,.8,2.4,.8,'#8B4A35',{alpha:al});box(F,2.9,ry+2.8,-2.1,1,.15,1,'#5A5A5A',{alpha:al});
      const gy=FL*.6+2.7+(1-st.roof)*7,go=.4;F.push({p:[V(6-go,gy,4.5+go),V(10.1+go,gy,4.5+go),V(8.05,gy+1.4,4.5+go)],c:SID,alpha:al},
        {p:[V(10.1+go,gy,4.5+go),V(10.1+go,gy,-1.5-go),V(8.05,gy+1.4,-1.5-go),V(8.05,gy+1.4,4.5+go)],c:ROOF2,alpha:al},{p:[V(6-go,gy,-1.5-go),V(6-go,gy,4.5+go),V(8.05,gy+1.4,4.5+go),V(8.05,gy+1.4,-1.5-go)],c:ROOF,alpha:al})}
    return F};
  S.after=(x,proj)=>{S.hits=[];if(st.mode==='ext')return;for(const r of ROOMS){const p=proj(V(r.x+r.w/2,FL+.2,r.z+r.d/2));if(!p)continue;x.font='600 12px Inter,system-ui,sans-serif';const tw=x.measureText(r.name).width+20,sel=st.sel===r.id;
    x.fillStyle=sel?'#C1121F':'rgba(0,27,41,.86)';const X=p[0]-tw/2,Y=p[1]-14;x.beginPath();x.roundRect?x.roundRect(X,Y,tw,28,14):x.rect(X,Y,tw,28);x.fill();x.fillStyle='#FDF0D5';x.textAlign='center';x.textBaseline='middle';x.fillText(r.name,p[0],p[1]+.5);S.hits.push({id:r.id,x:X,y:Y,w:tw,h:28})}};
  S.onTap=(x,y)=>{const h=(S.hits||[]).find(h=>x>=h.x-8&&x<=h.x+h.w+8&&y>=h.y-10&&y<=h.y+h.h+10);if(h)S.pick(h.id)};
  S.pick=id=>{st.sel=id;S.geoDirty=true;S.dirty=true;hooks.onRoom&&hooks.onRoom(ROOMS.find(r=>r.id===id))};
  const tw=[],tween=(k,to,ms)=>tw.push({k,from:st[k],to,t0:performance.now(),ms});
  S.tick=t=>{let any=false;for(let i=tw.length-1;i>=0;i--){const w=tw[i],k=Math.min(1,(t-w.t0)/w.ms);st[w.k]=lerp(w.from,w.to,ease(k));any=true;S.geoDirty=true;if(k>=1)tw.splice(i,1)}if(st.mode==='ext'&&st.auto&&!S.anim){S.cam.yaw+=.002;any=true}return any};
  S.onUser=()=>{st.auto=false};let timer=null,wi=0;
  S.mode=m=>{st.mode=m;clearInterval(timer);st.sel=null;hooks.onRoom&&hooks.onRoom(null);S.geoDirty=true;
    if(m==='ext'){tween('wall',1,700);tween('roof',1,900);st.auto=true;S.fly({yaw:-.62,pitch:.34,dist:canvas.clientWidth<canvas.clientHeight?44:32,tx:1,ty:1.6,tz:.5},1300)}
    if(m==='plan'){tween('roof',0,700);tween('wall',.35,900);S.fly({yaw:0,pitch:1.5,dist:canvas.clientWidth<canvas.clientHeight?38:26,tx:0,ty:0,tz:0},1300)}
    if(m==='walk'){tween('roof',0,700);tween('wall',.5,900);wi=0;const go=()=>{const r=ROOMS[wi%ROOMS.length];wi++;S.pick(r.id);const k=canvas.clientWidth<canvas.clientHeight?1.75:1;S.fly({tx:r.x+r.w/2,tz:r.z+r.d/2,ty:FL+.6,dist:8.5*k,pitch:.72,yaw:-.6+wi*.9},1600)};go();timer=setInterval(go,3400)}S.dirty=true};
  S.stop=()=>clearInterval(timer);S.cam={yaw:-.62,pitch:.34,dist:canvas.clientWidth<canvas.clientHeight?44:32,tx:1,ty:1.6,tz:.5};return S}

function Food(canvas){const S=new Stage(canvas,{min:5,max:16,fogk:60});if(S.fail)return Object.assign(S,{angle(){},lighting(){}});
  S.build=()=>{const F=[];cyl(F,0,-.7,0,4.3,.55,48,'#6B4A2E','#8A5E3A');cyl(F,0,-.15,0,4.05,.05,48,'#EFE3CE','#F4EBDB');
    const plate=(x,z,r)=>{cyl(F,x,-.1,z,r,.05,40,'#EDEDED','#FFFFFF');cone(F,x,-.05,z,r*.72,r,.08,40,'#F7F7F7')};
    plate(-1.55,.6,1.2);cyl(F,-1.55,-.05,.6,.74,.18,28,'#C9883E','#D99A4E');cyl(F,-1.55,.13,.6,.8,.17,28,'#5A3320','#6B3E26');cyl(F,-1.55,.3,.6,.84,.04,28,'#F2C14E','#F7CF63');
    cone(F,-1.55,.34,.6,.86,.8,.06,28,'#4F9A4A','#5DB257');cyl(F,-1.55,.4,.6,.72,.06,28,'#C1121F','#D42A35');dome(F,-1.55,.46,.6,.78,.55,28,'#D99A4E');
    for(let i=0;i<14;i++){const a=i*2.4,r=.15+(i%4)*.13;ball(F,-1.55+Math.cos(a)*r,.46+.55*Math.sqrt(Math.max(0,1-(r/.78)**2))-.01,.6+Math.sin(a)*r,.03,'#F4EBDB',5)}
    for(let i=0;i<7;i++)box(F,-.65+i*.08,-.04,1.05+i*.04,.09,.09,.62,'#E9B949');
    plate(1.45,.9,1.1);cone(F,1.45,-.04,.9,.5,.82,.42,36,'#F4F0E8','#E8C77E');for(let i=0;i<9;i++){const a=i*.7;ball(F,1.45+Math.cos(a)*.42,.4,.9+Math.sin(a)*.42,.06,'#E8C77E',6,.04)}
    for(const b of [[1.28,.78],[1.6,1.05],[1.52,.66],[1.24,1.1],[1.42,.92]])ball(F,b[0],.43,b[1],.13,'#B81D24',10);ball(F,1.5,.47,.85,.1,'#4F9A4A',8,.03);
    plate(.1,-1.6,1.05);for(const b of [[-.25,-1.5,'#5DB257'],[.35,-1.75,'#4F9A4A'],[.05,-1.25,'#6CC064'],[.4,-1.35,'#E25B45'],[-.2,-1.9,'#F2C14E'],[.1,-1.6,'#3E7A4A'],[-.35,-1.25,'#4F9A4A']])ball(F,b[0],.08,b[1],.27,b[2],10,.18);
    cyl(F,2.65,-.1,-1,.32,1.15,28,'#B8452E','#D9643F');cyl(F,2.65,1.05,-1,.34,.06,28,'#F4EEE1');cone(F,-2.75,-.1,-.85,.22,.34,1.05,28,'#E9D9A6','#F2E3B3');
    box(F,-3.1,-.1,1.05,.13,.03,1.5,'#BDBDBD');box(F,3.25,-.1,.5,.13,.03,1.5,'#BDBDBD');cyl(F,-.2,-.1,2.45,.2,.65,20,'#FDF0D5');cone(F,-.2,.55,2.45,.08,0,.22,10,'#F7B33C');return F};
  S.cam={yaw:-.4,pitch:.75,dist:9.5,tx:0,ty:0,tz:0};
  S.angle=a=>{const P={over:{pitch:1.52,dist:9.2,yaw:0},q45:{pitch:.78,dist:9.5,yaw:-.4},eye:{pitch:.13,dist:8.3,yaw:-.25}};S.fly(Object.assign({tx:0,ty:a==='eye'?.35:0,tz:0},P[a]),1200)};
  S.lighting=w=>{S.tint=w?[1.08,.9,.74]:[1,1,1];S.amb=w?.46:.56;S.fog=w?[.17,.09,.05]:[.66,.77,.84];S.dirty=true};return S}
window.VMS3D={House,Food,ROOMS};
})();
