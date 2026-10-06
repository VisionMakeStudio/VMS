/* VMS Admin v2 · Security & Access — Admin password, authenticator 2-step verification and session status.
   Everything goes straight to Supabase Auth (updateUser, mfa.enroll / challenge / verify, listFactors). */
(()=>{
'use strict';
const V=window.VMSv2,root=document.getElementById('pgRoot');if(!V||!root)return;
const {ic,esc,toast}=V;
const S={sb:null,email:'',aal:'',factors:0,totp:null,enroll:null,err:'',loading:true};
root.innerHTML='<div class="kpis kpis3">'+'<div class="skel" style="height:96px"></div>'.repeat(3)+'</div><div class="split" style="margin-top:14px"><div class="skel" style="height:360px"></div><div class="skel" style="height:260px"></div></div>';
async function refresh(){const {data:{session}}=await S.sb.auth.getSession();if(!session)return;S.email=session.user.email||'';
  const aal=window.VMSAuth&&VMSAuth.getMfaState?await VMSAuth.getMfaState(S.sb):null;S.aal=aal&&aal.currentLevel||'aal1';
  const {data,error}=await S.sb.auth.mfa.listFactors();if(error)throw error;const all=[...(data&&data.totp||[]),...(data&&data.phone||[])];const ver=all.filter(f=>f.status==='verified');S.factors=ver.length;S.totp=ver.find(f=>f.factor_type==='totp')||null;S.stale=all.filter(f=>f.factor_type==='totp'&&f.status!=='verified')}
const st=(id,msg,tone)=>{const el=root.querySelector('#'+id);if(el){el.className='note'+(tone?' '+tone:'');el.textContent=msg;el.hidden=!msg}};
function render(){const on=!!S.totp,a2=S.aal==='aal2';
  root.innerHTML=`<div class="kpis kpis3"><div class="kpi"><div class="l">Sign in</div><div class="v sm">Email + password</div><div class="d"><span class="chip ok">On</span></div></div>
   <div class="kpi"><div class="l">2-step verification</div><div class="v sm">Authenticator code</div><div class="d"><span class="chip ${on?'ok':'warn'}">${on?'On':'Not set up'}</span></div></div>
   <div class="kpi"><div class="l">Backup access</div><div class="v sm">Email link recovery</div><div class="d"><span class="chip">Available</span></div></div></div>
  ${S.err?`<div class="note bad" style="margin-top:14px">${esc(S.err)}</div>`:''}
  <div class="split" style="margin-top:14px"><div class="stack">
   <section class="card"><div class="card-h"><div><h3>Admin password</h3><p class="muted cs">Your normal VMS Admin sign-in password. It goes straight to Supabase and is never shown back.</p></div><span class="lic">${ic('lock')}</span></div>
    <form id="pwF" class="fgrid"><div class="fld"><label for="p1">New password</label><input id="p1" class="inp" type="password" autocomplete="new-password" minlength="12" required placeholder="At least 12 characters"></div>
     <div class="fld"><label for="p2">Type it again</label><input id="p2" class="inp" type="password" autocomplete="new-password" minlength="12" required placeholder="Confirm password"></div>
     <label class="ck full" style="cursor:pointer"><input type="checkbox" id="pShow"><span><b>Show passwords</b></span></label>
     <div class="full"><button class="btn pri" type="submit" id="pwB">${ic('check')}Save password</button></div></form>
    <div class="pwm" id="pwM" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="note" id="pwS" style="margin-top:12px">Use at least 12 characters and a password you do not use anywhere else.</div></section>
   <section class="card"><div class="card-h"><div><h3>Authenticator app</h3><p class="muted cs">Add a 6-digit code from Apple Passwords, Google Authenticator, 1Password, Microsoft Authenticator or another code app.</p></div><span class="lic ${on?'ok':'warn'}">${ic('shield')}</span></div>
    ${on?`<div class="note" style="background:var(--okbg);color:var(--ok)"><b>2-step verification is on.</b> You sign in with your password, then a code from your authenticator app.</div>`
     :S.enroll?`<div class="mfa"><ol class="steps"><li>Open your authenticator app and scan this code.</li><li>Or type the setup key by hand.</li><li>Enter the 6-digit code it shows.</li></ol>
       <div class="mfa-qr"><img src="${esc(S.enroll.totp.qr_code)}" alt="Authenticator setup code"></div>
       <div class="fld"><label>Setup key</label><div class="secret"><code id="sec">${esc(S.enroll.totp.secret)}</code><button class="btn gh sm" type="button" data-copy>${ic('copy')}Copy</button></div></div>
       <div class="fld"><label for="code">6-digit code</label><input id="code" class="inp otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></div>
       <div class="row" style="flex-wrap:wrap"><button class="btn pri" type="button" data-verify>${ic('check')}Verify and turn on</button><button class="btn ghost" type="button" data-cancel>Cancel</button></div></div>`
     :`<button class="btn pri" type="button" data-start>${ic('shield')}Set up authenticator</button>`}
    <div class="note" id="mS" style="margin-top:12px" hidden></div>
    ${on?'':'<div class="note warn" style="margin-top:12px"><b>Before you turn it on:</b> save the authenticator in your password manager or app. The backup email link does not skip 2-step verification once it is on.</div>'}</section></div>
   <div class="stack sticky"><section class="card"><div class="card-h"><h3>This session</h3></div><div class="kv"><div class="r"><span>Admin email</span><b>${esc(S.email||'—')}</b></div><div class="r"><span>Session security</span><b>${a2?'Password + authenticator':'Password only'}</b></div><div class="r"><span>Verified factors</span><b>${S.factors}</b></div></div>
    ${on&&!a2?'<div class="note warn" style="margin-top:12px">This session was opened before 2-step was checked. Sign out and back in to use the full protection.</div>':''}</section>
    <section class="card"><div class="card-h"><h3>Recommended setup</h3></div><div class="list">
     <div class="li"><span class="lic ok">${ic('mail')}</span><span><b>Email + password</b><span class="s">Your everyday sign in</span></span><span></span></div>
     <div class="li"><span class="lic ${on?'ok':'warn'}">${ic('device')}</span><span><b>Authenticator app</b><span class="s">The second step, right on your phone</span></span><span class="chip ${on?'ok':'warn'}">${on?'Done':'To do'}</span></div>
     <div class="li"><span class="lic">${ic('key')}</span><span><b>Email link recovery</b><span class="s">Backup if you forget your password</span></span><span></span></div></div>
     <p class="muted cs" style="margin:10px 0 0">The smoothest phone experience, without waiting for an email every time.</p></section></div></div>`}
function strength(v){let s=0;if(v.length>=12)s++;if(v.length>=16)s++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))s++;if(/\d/.test(v)&&/[^A-Za-z0-9]/.test(v))s++;return v?Math.max(1,s):0}
root.addEventListener('input',e=>{if(e.target.id==='p1'){const s=strength(e.target.value),m=root.querySelector('#pwM');m.dataset.s=s}if(e.target.id==='code')e.target.value=e.target.value.replace(/\D/g,'').slice(0,6)});
root.addEventListener('change',e=>{if(e.target.id==='pShow')root.querySelectorAll('#p1,#p2').forEach(i=>i.type=e.target.checked?'text':'password')});
root.addEventListener('submit',async e=>{if(e.target.id!=='pwF')return;e.preventDefault();const a=root.querySelector('#p1').value,b=root.querySelector('#p2').value,btn=root.querySelector('#pwB');
  if(a.length<12)return st('pwS','Use at least 12 characters.','bad');if(a!==b)return st('pwS','The two passwords do not match.','bad');
  btn.disabled=true;st('pwS','Saving password…');try{const {error}=await S.sb.auth.updateUser({password:a});if(error)throw error;e.target.reset();root.querySelector('#pwM').dataset.s=0;st('pwS','Password saved. Use it with your email next time you sign in.','ok');toast('Password saved')}
  catch(err){st('pwS',err.message||'Could not update the password. Supabase may ask you to sign in again before a password change.','bad')}finally{btn.disabled=false}});
root.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t||!root.contains(t))return;const d=t.dataset;
  if('start' in d){t.disabled=true;st('mS','Creating your setup code…');try{for(const f of S.stale||[]){try{await S.sb.auth.mfa.unenroll({factorId:f.id})}catch{}}
    const {data,error}=await S.sb.auth.mfa.enroll({factorType:'totp',friendlyName:'VMS Admin Authenticator'});if(error)throw error;S.enroll=data;render();st('mS','Scan the code, then enter the 6-digit code from your app.');setTimeout(()=>{const c=root.querySelector('#code');c&&c.focus({preventScroll:true})},50)}
    catch(err){t.disabled=false;st('mS',err.message||'Could not start authenticator setup.','bad')}return}
  if('cancel' in d){const f=S.enroll;S.enroll=null;render();if(f){try{await S.sb.auth.mfa.unenroll({factorId:f.id})}catch{}}return}
  if('copy' in d){const v=root.querySelector('#sec').textContent.trim();try{await navigator.clipboard.writeText(v);st('mS','Setup key copied.','ok')}catch{st('mS','Press and hold the setup key to copy it.','bad')}return}
  if('verify' in d){const code=root.querySelector('#code').value.replace(/\D/g,'').slice(0,6);if(!S.enroll||!S.enroll.id)return st('mS','Start authenticator setup first.','bad');if(code.length!==6)return st('mS','Enter the full 6-digit code.','bad');
    t.disabled=true;st('mS','Checking your code…');try{const {data:ch,error:ce}=await S.sb.auth.mfa.challenge({factorId:S.enroll.id});if(ce)throw ce;const {error:ve}=await S.sb.auth.mfa.verify({factorId:S.enroll.id,challengeId:ch.id,code});if(ve)throw ve;
     S.enroll=null;await refresh();render();toast('2-step verification is on')}
    catch(err){t.disabled=false;st('mS',err.message||'That code was not accepted. Try the newest code.','bad');const c=root.querySelector('#code');c&&c.select()}}});
V.ready().then(async()=>{try{S.sb=await VMSAuth.client();if(!S.sb)throw new Error('Supabase is unavailable.');await refresh()}catch(err){S.err=err.message||'Could not load security settings.'}S.loading=false;render()});
})();
