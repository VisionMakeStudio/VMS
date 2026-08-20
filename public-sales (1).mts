import { supabaseEnv } from './auth.mts';

type Row=Record<string,any>;
const clean=(v:any,n=5000)=>String(v??'').trim().slice(0,n);
const lower=(v:any)=>clean(v,240).toLowerCase();

function headers(){
  const {serviceKey}=supabaseEnv();
  if(!serviceKey)throw Object.assign(new Error('VMS sales data is temporarily unavailable.'),{status:503});
  const h:Record<string,string>={apikey:serviceKey};
  if(!serviceKey.startsWith('sb_secret_'))h.Authorization=`Bearer ${serviceKey}`;
  return h;
}
async function read(path:string){
  const {url}=supabaseEnv();
  if(!url)throw Object.assign(new Error('VMS sales data is temporarily unavailable.'),{status:503});
  const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/${path}`,{headers:headers()});
  const text=await r.text();
  if(!r.ok)throw Object.assign(new Error(`Sales data request failed (${r.status}).`),{status:r.status>=500?502:r.status});
  return text?JSON.parse(text):[];
}
function validPublicPromotion(p:Row,now=new Date()){
  if(lower(p.status)!=='active'||p.public_visible!==true)return false;
  const start=p.starts_at?new Date(p.starts_at):null,end=p.ends_at?new Date(p.ends_at):null;
  if(start&&!Number.isNaN(start.getTime())&&start>now)return false;
  if(end&&!Number.isNaN(end.getTime())&&end<now)return false;
  return true;
}
function publicService(s:Row){
  return {
    id:clean(s.id,120),name:clean(s.name,180),kind:clean(s.kind,60),category:clean(s.category,100),
    featured:!!s.featured,displayOrder:Number(s.display_order)||0,description:clean(s.description,1500),
    pricingModel:clean(s.pricing_model,80),oneTimePrice:s.one_time_price==null?null:Number(s.one_time_price),
    recurringPrice:s.recurring_price==null?null:Number(s.recurring_price),cadence:clean(s.cadence,50)||null,
    startingAt:!!s.starting_at,salesMode:clean(s.sales_mode,80),promoEligible:!!s.promo_eligible,
    features:Array.isArray(s.features)?s.features.map((x:any)=>clean(x,300)).filter(Boolean).slice(0,20):[],
    included:Array.isArray(s.included)?s.included.map((x:any)=>clean(x,300)).filter(Boolean).slice(0,20):[],
    family:clean(s.metadata?.family,80)||null,
    recommended:s.metadata?.recommended===true,
  };
}
function publicPromotion(p:Row){
  return {
    id:p.id,name:clean(p.name,180),code:clean(p.code,80)||null,description:clean(p.description,1200),
    discountType:clean(p.discount_type,40),discountValue:p.discount_value==null?null:Number(p.discount_value),
    serviceIds:Array.isArray(p.service_ids)?p.service_ids.map((x:any)=>clean(x,120)).filter(Boolean):[],
    featured:!!p.featured,startsAt:p.starts_at||null,endsAt:p.ends_at||null,terms:clean(p.terms,1500)||null,
  };
}
function safeHttp(v:any){
  const value=clean(v,1200);if(!value)return null;
  try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}
}
function publicContent(x:Row){
  return {
    id:x.id,type:clean(x.content_type,30),title:clean(x.title,240),body:clean(x.body,3000),
    attributionName:clean(x.attribution_name,180)||null,attributionCompany:clean(x.attribution_company,180)||null,
    imageUrl:safeHttp(x.image_url),linkUrl:safeHttp(x.link_url),
    serviceIds:Array.isArray(x.service_ids)?x.service_ids.map((v:any)=>clean(v,120)).filter(Boolean):[],
    featured:!!x.featured,displayOrder:Number(x.display_order)||100,publishedAt:x.published_at||null,
  };
}
export async function getPublicSalesData(){
  const [services,promos,content]=await Promise.all([
    read('service_catalog?status=eq.Published&website_visible=eq.true&select=id,name,kind,category,featured,display_order,description,pricing_model,one_time_price,recurring_price,cadence,starting_at,sales_mode,promo_eligible,features,included,metadata&order=display_order.asc.nullslast,name.asc'),
    read('public_promotions?select=*&order=featured.desc,starts_at.desc.nullslast,created_at.desc'),
    read('marketing_content?status=eq.published&select=*&order=featured.desc,display_order.asc,published_at.desc.nullslast')
  ]);
  return {
    services:(Array.isArray(services)?services:[]).map(publicService),
    promotions:(Array.isArray(promos)?promos:[]).filter((p:Row)=>validPublicPromotion(p)).map(publicPromotion),
    portfolio:(Array.isArray(content)?content:[]).filter((x:Row)=>lower(x.content_type)==='portfolio').map(publicContent),
    testimonials:(Array.isArray(content)?content:[]).filter((x:Row)=>lower(x.content_type)==='testimonial').map(publicContent),
    serviceArea:['New Jersey','New York City','NYC / NJ Tri-State'],
    generatedAt:new Date().toISOString()
  };
}
export function servicePriceLabel(s:any){
  if(lower(s.pricingModel)==='free')return 'Free';
  const amount=s.recurringPrice??s.oneTimePrice;
  if(amount==null)return 'Contact VMS';
  const formatted=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:Number(amount)%1?2:0,maximumFractionDigits:2}).format(Number(amount));
  const prefix=s.startingAt?'Starting at ':'';
  return `${prefix}${formatted}${s.recurringPrice!=null?`/${lower(s.cadence).includes('year')?'yr':'mo'}`:''}`;
}
export function promotionApplies(p:any,serviceId:string){return !Array.isArray(p.serviceIds)||!p.serviceIds.length||p.serviceIds.includes(serviceId)}
