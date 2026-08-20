import { jsonError, requireAdmin, supabaseEnv } from './_shared/auth.mts';

type Row=Record<string,any>;
const clean=(v:any,n=5000)=>String(v??'').trim().slice(0,n);
const ids=(v:any)=>[...new Set((Array.isArray(v)?v:[]).map(x=>clean(x,120)).filter(Boolean))].slice(0,50);
function headers(json=false,prefer=''){
  const {serviceKey}=supabaseEnv();if(!serviceKey)throw Object.assign(new Error('VMS marketing storage is not configured.'),{status:503});
  const h:Record<string,string>={apikey:serviceKey};if(!serviceKey.startsWith('sb_secret_'))h.Authorization=`Bearer ${serviceKey}`;
  if(json)h['Content-Type']='application/json';if(prefer)h.Prefer=prefer;return h;
}
async function db(path:string,init:RequestInit={}){
  const {url}=supabaseEnv();if(!url)throw Object.assign(new Error('VMS marketing storage is not configured.'),{status:503});
  const h=new Headers(init.headers||{});Object.entries(headers(!!init.body)).forEach(([k,v])=>{if(!h.has(k))h.set(k,v)});
  const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/${path}`,{...init,headers:h});const text=await r.text();
  if(!r.ok)throw Object.assign(new Error(`Marketing request failed (${r.status})${text?`: ${text.slice(0,240)}`:''}`),{status:r.status===409?409:r.status>=500?502:r.status});
  return text?JSON.parse(text):null;
}
function promotionPayload(b:Row){
  const name=clean(b.name,180);if(!name)throw Object.assign(new Error('Promotion name is required.'),{status:400});
  const type=['percent','amount','custom'].includes(clean(b.discountType,30))?clean(b.discountType,30):'percent';
  const value=b.discountValue===''||b.discountValue==null?null:Number(b.discountValue);
  if(type!=='custom'&&(value==null||!Number.isFinite(value)||value<0))throw Object.assign(new Error('Enter a valid discount value.'),{status:400});
  if(type==='percent'&&Number(value)>100)throw Object.assign(new Error('Percent discount cannot exceed 100.'),{status:400});
  return {name,code:clean(b.code,80).toUpperCase()||null,description:clean(b.description,1200)||null,discount_type:type,discount_value:value,service_ids:ids(b.serviceIds),public_visible:b.publicVisible===true,featured:b.featured===true,status:['draft','active','paused','archived'].includes(clean(b.status,30))?clean(b.status,30):'draft',starts_at:clean(b.startsAt,80)||null,ends_at:clean(b.endsAt,80)||null,terms:clean(b.terms,1600)||null,metadata:{source:'phase9-admin'},updated_at:new Date().toISOString()};
}
function contentPayload(b:Row){
  const type=['portfolio','testimonial'].includes(clean(b.contentType,30))?clean(b.contentType,30):'';if(!type)throw Object.assign(new Error('Choose Portfolio or Testimonial.'),{status:400});
  const title=clean(b.title,240);if(!title)throw Object.assign(new Error('Content title is required.'),{status:400});
  const status=['draft','published','archived'].includes(clean(b.status,30))?clean(b.status,30):'draft';
  return {content_type:type,title,body:clean(b.body,3000)||null,attribution_name:clean(b.attributionName,180)||null,attribution_company:clean(b.attributionCompany,180)||null,image_url:clean(b.imageUrl,1200)||null,link_url:clean(b.linkUrl,1200)||null,service_ids:ids(b.serviceIds),featured:b.featured===true,display_order:Number.isFinite(Number(b.displayOrder))?Number(b.displayOrder):100,status,published_at:status==='published'?(clean(b.publishedAt,80)||new Date().toISOString()):null,metadata:{source:'phase9-admin'},updated_at:new Date().toISOString()};
}
export default async(req:Request)=>{
  try{
    await requireAdmin(req);
    if(req.method==='GET'){
      const [promotions,content,services]=await Promise.all([
        db('public_promotions?select=*&order=featured.desc,created_at.desc'),
        db('marketing_content?select=*&order=content_type.asc,featured.desc,display_order.asc,created_at.desc'),
        db('service_catalog?status=eq.Published&select=id,name,kind,category,website_visible,promo_eligible&order=display_order.asc.nullslast,name.asc')
      ]);
      return Response.json({promotions:promotions||[],content:content||[],services:services||[]});
    }
    if(req.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405});
    const b:Row=await req.json().catch(()=>({})),action=clean(b.action,60);
    if(action==='save-promotion'){
      const payload=promotionPayload(b);let rows;
      if(clean(b.id,80))rows=await db(`public_promotions?id=eq.${encodeURIComponent(clean(b.id,80))}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      else rows=await db('public_promotions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      return Response.json({ok:true,promotion:rows?.[0]||null});
    }
    if(action==='archive-promotion'){
      const id=clean(b.id,80);if(!id)throw Object.assign(new Error('Promotion id is required.'),{status:400});
      await db(`public_promotions?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'archived',public_visible:false,updated_at:new Date().toISOString()})});
      return Response.json({ok:true});
    }
    if(action==='save-content'){
      const payload=contentPayload(b);let rows;
      if(clean(b.id,80))rows=await db(`marketing_content?id=eq.${encodeURIComponent(clean(b.id,80))}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      else rows=await db('marketing_content',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
      return Response.json({ok:true,content:rows?.[0]||null});
    }
    if(action==='archive-content'){
      const id=clean(b.id,80);if(!id)throw Object.assign(new Error('Content id is required.'),{status:400});
      await db(`marketing_content?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'archived',updated_at:new Date().toISOString()})});
      return Response.json({ok:true});
    }
    return Response.json({error:'Unknown marketing action.'},{status:400});
  }catch(e){return jsonError(e)}
};
export const config={path:'/api/marketing-content'};
