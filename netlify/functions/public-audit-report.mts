/* VMS Final Polish Phase 5 — public client audit report resolver. */
const clean=(value:any,max=2000)=>String(value??'').trim().slice(0,max);
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'}});
function env(name:string){
  const netlifyEnv=(globalThis as any)?.Netlify?.env;
  const processEnv=((globalThis as any)?.process?.env||{}) as Record<string,string|undefined>;
  return clean(netlifyEnv?.get?.(name)??processEnv[name],8000);
}
function adminHeaders(secret:string,extra:HeadersInit={}){const h=new Headers(extra);h.set('apikey',secret);if(!secret.startsWith('sb_secret_'))h.set('Authorization',`Bearer ${secret}`);return h}
async function hashToken(token:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
export default async(req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);
  try{
    const supabaseUrl=env('SUPABASE_URL'),secret=env('SUPABASE_SECRET_KEY')||env('SUPABASE_SERVICE_ROLE_KEY');
    if(!supabaseUrl||!secret)return json({error:'Report service is unavailable.'},503);
    const body=await req.json().catch(()=>({}));const token=clean(body?.token,300);
    if(!/^[A-Za-z0-9_-]{32,120}$/.test(token))return json({error:'Report unavailable.'},404);
    const hash=await hashToken(token);
    const url=new URL('/rest/v1/audit_report_links',supabaseUrl);url.searchParams.set('select','id,business_name,report_data,status,expires_at');url.searchParams.set('token_hash',`eq.${hash}`);url.searchParams.set('limit','1');
    const res=await fetch(url,{headers:adminHeaders(secret)});const rows=res.ok?await res.json():[];const row=Array.isArray(rows)?rows[0]:null;
    if(!row||row.status!=='active')return json({error:'Report unavailable.'},404);
    if(row.expires_at&&Date.parse(row.expires_at)<=Date.now())return json({error:'This report link has expired.'},410);
    const patchUrl=new URL('/rest/v1/audit_report_links',supabaseUrl);patchUrl.searchParams.set('id',`eq.${row.id}`);
    fetch(patchUrl,{method:'PATCH',headers:adminHeaders(secret,{'content-type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify({last_viewed_at:new Date().toISOString(),updated_at:new Date().toISOString()})}).catch(()=>null);
    return json({ok:true,report:row.report_data});
  }catch(error:any){console.error('VMS public audit report error',clean(error?.message||error,800));return json({error:'Report unavailable.'},500)}
};
export const config={path:'/api/public-audit-report'};
