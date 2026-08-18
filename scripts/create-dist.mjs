import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
for(const item of ['index.html','assets','admin','portal']){
  const src=path.join(root,item),dst=path.join(dist,item);
  fs.cpSync(src,dst,{recursive:true});
}
console.log(`VMS publish directory created: ${dist}`);
