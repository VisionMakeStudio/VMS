/* VMS private Supabase Storage helper. Local file previews still work without configuration. */
(()=>{
  const BUCKET='vms-client-files';
  const ready=()=>!!window.VMSAuth?.configReady?.()&&location.protocol!=='file:';
  const safe=s=>String(s||'file').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'file';
  const safeOwner=s=>String(s||'vms').toLowerCase().trim().replace(/[^a-z0-9@._+-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,180)||'vms';
  async function client(){return ready()?await VMSAuth.client():null}
  async function currentEmail(){const sb=await client();if(!sb)return '';const {data:{session}}=await sb.auth.getSession();return String(session?.user?.email||'').toLowerCase()}
  async function upload(file,opts={}){
    if(!file)throw new Error('Choose a file first.');
    const sb=await client();if(!sb)return {local:true,path:'',mime:file.type||''};
    const owner=safeOwner(opts.ownerEmail||await currentEmail());
    const folder=safe(opts.folder||'uploads');
    const path=`${owner}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safe(file.name)}`;
    const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||undefined,cacheControl:'3600'});
    if(error)throw error;
    return {local:false,path,mime:file.type||'',size:file.size||0};
  }
  async function signedUrl(path,expires=900){
    if(!path)return '';
    const sb=await client();if(!sb)return '';
    const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(path,expires);if(error)throw error;return data?.signedUrl||'';
  }
  async function remove(path){if(!path)return;const sb=await client();if(!sb)return;const {error}=await sb.storage.from(BUCKET).remove([path]);if(error)throw error}
  window.VMSFiles={BUCKET,ready,upload,signedUrl,remove,currentEmail,safeOwner};

  // Master Phase 6 — expose the real Scheduling workspace from the main Client Portal.
  function installPhase6SchedulingNav(){
    const portalHome=location.pathname.endsWith('/portal/')||location.pathname.endsWith('/portal/index.html');
    if(!portalHome)return;

    const install=()=>{
      const nav=document.getElementById('nav');
      if(!nav||document.getElementById('vmsSchedulingNavBtn'))return;

      const button=document.createElement('button');
      button.id='vmsSchedulingNavBtn';
      button.type='button';
      button.textContent='Scheduling';
      button.setAttribute('aria-label','Open Scheduling');

      const projects=nav.querySelector('button[data-section="projects"]');
      if(projects)projects.insertAdjacentElement('afterend',button);
      else nav.appendChild(button);

      button.addEventListener('click',()=>{location.href='schedule.html';});
    };

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else install();
  }

  installPhase6SchedulingNav();
})();
