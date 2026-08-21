/* VMS Final Polish Phase 5 — Admin-controlled client audit report links. */

const json=(body:any,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
const clean=(value:any,max=2000)=>String(value??'').trim().slice(0,max);
function env(name:string){
  const netlifyEnv=(globalThis as any)?.Netlify?.env;
  const processEnv=((globalThis as any)?.process?.env||{}) as Record<string,string|undefined>;
  return clean(netlifyEnv?.get?.(name)??processEnv[name],8000);
}
function adminHeaders(secret:string,extra:HeadersInit={}){
  const h=new Headers(extra);h.set('apikey',secret);
  if(!secret.startsWith('sb_secret_'))h.set('Authorization',`Bearer ${secret}`);
  return h;
}
function serverConfig(){
  const supabaseUrl=env('SUPABASE_URL');
  const publicKey=env('SUPABASE_PUBLISHABLE_KEY')||env('SUPABASE_ANON_KEY');
  const secret=env('SUPABASE_SECRET_KEY')||env('SUPABASE_SERVICE_ROLE_KEY');
  if(!supabaseUrl||!publicKey||!secret)throw Object.assign(new Error('VMS report-link service is not configured.'),{status:503});
  return {supabaseUrl,publicKey,secret};
}
async function requireAdmin(req:Request){
  const cfg=serverConfig();
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.toLowerCase().startsWith('bearer '))throw Object.assign(new Error('Admin sign-in required.'),{status:401});
  const userRes=await fetch(`${cfg.supabaseUrl}/auth/v1/user`,{headers:{apikey:cfg.publicKey,Authorization:authorization}});
  if(!userRes.ok)throw Object.assign(new Error('Admin session is invalid or expired.'),{status:401});
  const user=await userRes.json();
  const profileUrl=new URL('/rest/v1/profiles',cfg.supabaseUrl);
  profileUrl.searchParams.set('select','role');profileUrl.searchParams.set('id',`eq.${user.id}`);profileUrl.searchParams.set('limit','1');
  const profileRes=await fetch(profileUrl,{headers:adminHeaders(cfg.secret)});
  const rows=profileRes.ok?await profileRes.json():[];
  if(!Array.isArray(rows)||rows[0]?.role!=='admin')throw Object.assign(new Error('VMS Admin access required.'),{status:403});
  return {cfg,user};
}
function b64url(bytes:Uint8Array){
  let s='';for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function newToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return b64url(bytes)}
async function hashToken(token:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function updateByToken(cfg:any,token:string,patch:any){
  if(!token)return;
  const hash=await hashToken(token);
  const url=new URL('/rest/v1/audit_report_links',cfg.supabaseUrl);url.searchParams.set('token_hash',`eq.${hash}`);
  await fetch(url,{method:'PATCH',headers:adminHeaders(cfg.secret,{'content-type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify(patch)}).catch(()=>null);
}
async function logActivity(cfg:any,title:string,detail:string,metadata:any){
  await fetch(new URL('/rest/v1/activity_events',cfg.supabaseUrl),{method:'POST',headers:adminHeaders(cfg.secret,{'content-type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify({event_type:'Audit',title,detail,needs_action:false,resolved:false,metadata})}).catch(()=>null);
}

export default async(req:Request)=>{
  if(req.method!=='POST')return json({error:'Method not allowed.'},405);
  try{
    const {cfg}=await requireAdmin(req);
    const body=await req.json().catch(()=>({}));
    const action=clean(body?.action||'create',40).toLowerCase();
    if(action==='revoke'){
      const token=clean(body?.token,300);
      if(!token)return json({error:'Report token is required.'},400);
      await updateByToken(cfg,token,{status:'revoked',revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      await logActivity(cfg,'Client audit report link disabled','A client-facing audit report link was revoked.',{source:'audit_report_link'});
      return json({ok:true,status:'revoked'});
    }
    if(action!=='create')return json({error:'Unsupported report-link action.'},400);

    const reportData=body?.report_data;
    if(!reportData||typeof reportData!=='object'||Array.isArray(reportData))return json({error:'Client report data is required.'},400);
    const serialized=JSON.stringify(reportData);
    if(serialized.length>120000)return json({error:'This report is too large to share. Save the audit and try again.'},413);

    const previousToken=clean(body?.previous_token,300);
    if(previousToken)await updateByToken(cfg,previousToken,{status:'revoked',revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()});

    const allowedDays=new Set([0,7,30,90,365]);
    const requestedDays=Number(body?.expires_in_days);
    const days=allowedDays.has(requestedDays)?requestedDays:30;
    const expiresAt=days?new Date(Date.now()+days*86400000).toISOString():null;
    const token=newToken(),tokenHash=await hashToken(token);
    const businessName=clean(reportData?.business_name||'Business Checkup',180);
    const insert={token_hash:tokenHash,business_name:businessName,report_data:reportData,status:'active',expires_at:expiresAt,metadata:{version:Number(reportData?.v)||2}};
    const insertRes=await fetch(new URL('/rest/v1/audit_report_links',cfg.supabaseUrl),{method:'POST',headers:adminHeaders(cfg.secret,{'content-type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(insert)});
    const inserted=await insertRes.json().catch(()=>null);
    if(!insertRes.ok)throw Object.assign(new Error(`Report link could not be saved (${insertRes.status}).`),{status:502});

    const origin=new URL(req.url).origin;
    const publicUrl=`${origin}/audit-report.html#token=${encodeURIComponent(token)}`;
    await logActivity(cfg,'Client audit report link created',`${businessName} report link created${expiresAt?` · expires ${expiresAt.slice(0,10)}`:' · no expiration'}.`,{source:'audit_report_link',report_link_id:Array.isArray(inserted)?inserted[0]?.id:null});
    return json({ok:true,token,public_url:publicUrl,expires_at:expiresAt});
  }catch(error:any){
    console.error('VMS audit report link error',clean(error?.message||error,800));
    return json({error:clean(error?.message||'Report-link request failed.',500),code:clean(error?.code,80)},Number(error?.status)||500);
  }
};

export const config={path:'/api/audit-report-links'};
