import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');

fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});

for(const item of ['index.html','services.html','get-started.html','assets','admin','portal']){
  const src=path.join(root,item),dst=path.join(dist,item);
  fs.cpSync(src,dst,{recursive:true});
}

/* Phase 9: connect the existing homepage to the public sales flow without
   changing the source homepage layout or visual design. */
const homepage=path.join(dist,'index.html');
if(fs.existsSync(homepage)){
  let html=fs.readFileSync(homepage,'utf8');

  html=html.replaceAll('href="#services"','href="services.html"');

  const oldServiceHook="const btn=document.getElementById('serviceRequestBtn');btn.textContent=s.salesMode==='Buy Now'?'Get Started':'Request This Service';serviceModal.classList.add('show')";
  const newServiceHook="const btn=document.getElementById('serviceRequestBtn');btn.textContent=s.salesMode==='Buy Now'?'Get Started':'Request This Service';btn.href='get-started.html?service='+encodeURIComponent(s.id);serviceModal.classList.add('show')";

  if(!html.includes(oldServiceHook)){
    throw new Error('Phase 9 homepage service CTA hook was not found.');
  }

  html=html.replace(oldServiceHook,newServiceHook);
  fs.writeFileSync(homepage,html);
}

console.log(`VMS publish directory created: ${dist}`);
