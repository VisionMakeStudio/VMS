(()=>{
  if(!/\/get-started(?:\.html)?$/i.test(location.pathname))return;
  const normalize=value=>{
    const raw=String(value??'').trim();
    if(!raw)return '';
    if(/^https?:\/\//i.test(raw))return raw;
    if(/^\/\//.test(raw))return `https:${raw}`;
    return `https://${raw.replace(/^\/+/, '')}`;
  };
  function boot(){
    const input=document.getElementById('website');
    const form=document.getElementById('leadForm');
    if(!input||!form)return;
    input.type='text';
    input.inputMode='url';
    input.autocomplete='url';
    input.autocapitalize='none';
    input.spellcheck=false;
    input.placeholder='example.com';
    input.setAttribute('aria-description','You can enter example.com without https://');
    input.addEventListener('blur',()=>{if(input.value.trim())input.value=normalize(input.value)});
    form.addEventListener('submit',()=>{if(input.value.trim())input.value=normalize(input.value)},{capture:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
