export function env(name:string){return Netlify.env.get(name)||''}
export function cfg(){
  const supabaseUrl=env('SUPABASE_URL');
  const publishableKey=env('SUPABASE_PUBLISHABLE_KEY');
  const secretKey=env('SUPABASE_SECRET_KEY')||env('SUPABASE_SERVICE_ROLE_KEY');
  if(!supabaseUrl||!publishableKey||!secretKey) throw Object.assign(new Error('QR server configuration is incomplete.'),{status:503});
  return {supabaseUrl,publishableKey,secretKey};
}
function adminHeaders(secret:string,extra:HeadersInit={}){const h=new Headers(extra);h.set('apikey',secret);if(!secret.startsWith('sb_secret_'))h.set('Authorization',`Bearer ${secret}`);return h}
export async function db(path:string,init:RequestInit={}){const c=cfg();const h=adminHeaders(c.secretKey,init.headers||{});if(init.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');return fetch(`${c.supabaseUrl}/rest/v1/${path}`,{...init,headers:h})}
export async function json(path:string){const r=await db(path);if(!r.ok)throw Object.assign(new Error(`QR database request failed (${r.status}).`),{status:502});return r.json()}
export async function write(path:string,method:'POST'|'PATCH'|'DELETE',body?:any,prefer='return=representation'){const h:any={};if(prefer)h.Prefer=prefer;const r=await db(path,{method,headers:h,body:body==null?undefined:JSON.stringify(body)});if(!r.ok){const t=await r.text().catch(()=> '');throw Object.assign(new Error(`QR database update failed (${r.status})${t?`: ${t.slice(0,180)}`:''}`),{status:502})}const t=await r.text();return t?JSON.parse(t):null}
export async function requireIdentity(req:Request){
  const c=cfg(),auth=req.headers.get('authorization')||'';if(!auth.toLowerCase().startsWith('bearer '))throw Object.assign(new Error('Sign-in required.'),{status:401});
  const ur=await fetch(`${c.supabaseUrl}/auth/v1/user`,{headers:{apikey:c.publishableKey,Authorization:auth}});if(!ur.ok)throw Object.assign(new Error('Session expired.'),{status:401});const user=await ur.json();
  const pr=await db(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role,email&limit=1`);const profiles=pr.ok?await pr.json():[];const role=profiles?.[0]?.role||'client';
  let client:any=null;const email=String(user.email||'').trim();if(email){const cr=await db(`clients?owner_email=ilike.${encodeURIComponent(email)}&select=id,business_name,owner_email&limit=1`);const cs=cr.ok?await cr.json():[];client=cs?.[0]||null}
  return {user,role,client};
}
export function cleanUrl(value:any){const s=String(value||'').trim();if(!s)return'';try{const u=new URL(/^https?:\/\//i.test(s)?s:`https://${s}`);if(!['http:','https:'].includes(u.protocol))return'';return u.toString()}catch{return''}}
export function code(){const chars='abcdefghjkmnpqrstuvwxyz23456789';let s='';const a=new Uint32Array(12);crypto.getRandomValues(a);for(const n of a)s+=chars[n%chars.length];return s}
export function err(e:any){return Response.json({error:e?.message||'QR request failed.'},{status:Number(e?.status)||500})}
export function device(ua:string){const s=ua.toLowerCase();if(/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegrambot|discordbot|linkedinbot/.test(s))return 'bot';if(/ipad|tablet|android(?!.*mobile)/.test(s))return 'Tablet';if(/iphone|ipod|android.*mobile|mobile/.test(s))return 'Mobile';return 'Desktop'}
