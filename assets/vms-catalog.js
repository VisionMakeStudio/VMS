/* Vision Make Studio — shared service catalog bridge.
   Public/portal pages read from Supabase when configured.
   Admin writes to Supabase; local file previews use localStorage only. */
(()=>{
  const LOCAL_KEY='vms_catalog_preview_v3';
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:Number(n)%1?2:0,maximumFractionDigits:2}).format(Number(n)||0);
  const DEFAULTS=[
    {
      id:'free-business-checkup',name:'Free Business Checkup',kind:'service',category:'Business Review',icon:'CHK',status:'Published',featured:true,displayOrder:1,
      description:'A no-pressure starting point to identify the biggest website, visibility, review, and customer-experience opportunities.',pricingModel:'Free',oneTimePrice:0,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:['Website and customer-path review','Local visibility opportunities','Review and trust-signal check','Clear next-step recommendations'],included:[],metadata:{family:'audit'}
    },
    {
      id:'vms-audit',name:'VMS Business & Website Audit',kind:'service',category:'Business Review',icon:'AUD',status:'Published',featured:false,displayOrder:2,
      description:'A deeper VMS audit with category scores, findings, evidence, and prioritized recommendations.',pricingModel:'One-Time',oneTimePrice:99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Website, local presence, reviews, and systems','AI-assisted preliminary findings for VMS review','Prioritized recommendations','Client-ready audit report'],included:[],metadata:{family:'audit'}
    },
    {
      id:'website-revamp',name:'Website Refresh / Revamp',kind:'service',category:'Websites',icon:'WEB',status:'Published',featured:true,displayOrder:10,
      description:'Modernize an existing website with clearer messaging, stronger calls-to-action, and a cleaner mobile experience.',pricingModel:'One-Time',oneTimePrice:599,recurringPrice:null,cadence:null,startingAt:true,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Responsive desktop + mobile redesign','Customer journey and CTA cleanup','Content and visual refinement','Launch support and revisions'],included:[],metadata:{family:'website'}
    },
    {
      id:'new-business-website',name:'New Business Website',kind:'service',category:'Websites',icon:'SITE',status:'Published',featured:false,displayOrder:11,
      description:'A polished new website for a business that needs a professional home online from the ground up.',pricingModel:'One-Time',oneTimePrice:899,recurringPrice:null,cadence:null,startingAt:true,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Responsive website build','Core business pages and calls-to-action','Contact / lead pathway','Launch support'],included:[],metadata:{family:'website'}
    },
    {
      id:'website-care',name:'Monthly Website Care',kind:'subscription',category:'Websites',icon:'CARE',status:'Published',featured:true,displayOrder:12,
      description:'Ongoing content changes, small updates, and support for a VMS-managed website.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:49,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Content and image changes','Small page/section updates','Routine maintenance','VMS support requests'],included:[],metadata:{family:'website'}
    },
    {
      id:'local-presence-setup',name:'Local Presence Setup',kind:'service',category:'Local Growth',icon:'LOCAL',status:'Published',featured:true,displayOrder:20,
      description:'Clean up and strengthen how your business information appears across important local platforms.',pricingModel:'One-Time',oneTimePrice:149,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Business information consistency','Google-focused visibility review','Hours, links, and category cleanup','Local presence recommendations'],included:[],metadata:{family:'local'}
    },
    {
      id:'local-presence-care',name:'Local Presence Care',kind:'subscription',category:'Local Growth',icon:'LOCAL+',status:'Published',featured:false,displayOrder:21,
      description:'Ongoing monitoring and updates for core business information and local visibility signals.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:29,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Listing monitoring','Business info corrections','Hours/link updates','Visibility recommendations'],included:[],metadata:{family:'local'}
    },
    {
      id:'review-growth',name:'Review Growth',kind:'subscription',category:'Reputation',icon:'REV',status:'Published',featured:true,displayOrder:30,
      description:'A practical system for consistently making it easier for happy customers to leave reviews.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:39,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Review pathways and calls-to-action','QR / LinkHub review routes','Review-growth workflow','Ongoing recommendations'],included:[],metadata:{family:'reviews'}
    },
    {
      id:'smart-qr',name:'VMS Smart QR',kind:'service',category:'QR & Growth',icon:'QR',status:'Published',featured:true,displayOrder:40,
      description:'A branded QR for the destination your business needs. The standard one-time version is ideal when ongoing scan analytics are not required.',pricingModel:'One-Time',oneTimePrice:14.99,recurringPrice:null,cadence:null,startingAt:true,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Branded QR artwork','Website, reviews, booking, social, and custom destinations','Print-ready export','No monthly fee for the standard version'],included:[],metadata:{family:'qr',analyticsIncluded:false}
    },
    {
      id:'linkhub-core',name:'VMS LinkHub Core',kind:'service',category:'LinkHub',icon:'LH',status:'Published',featured:true,displayOrder:50,
      description:'A polished digital business card with your profile, contact actions, links, social icons, colors, and Visit Us page.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:5.99,cadence:'Monthly',startingAt:false,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Business profile and contact actions','Custom links and social icons','Theme and brand colors','Visit Us / Directions page','QR code to your LinkHub'],included:[],metadata:{family:'linkhub',plan:'core'}
    },
    {
      id:'linkhub-wifi',name:'LinkHub Wi‑Fi Feature',kind:'addon',category:'LinkHub',icon:'WIFI',status:'Published',featured:false,displayOrder:51,
      description:'Add the LinkHub Wi‑Fi screen with network name, security, password controls, copy action, and connection instructions.',pricingModel:'One-Time',oneTimePrice:6.99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['SSID and security type','Masked password with show/hide','Copy Password','Connection instructions'],included:[],metadata:{family:'linkhub',requires:'linkhub-core'}
    },
    {
      id:'linkhub-menu',name:'LinkHub Restaurant Menu',kind:'addon',category:'LinkHub',icon:'MENU',status:'Published',featured:false,displayOrder:52,
      description:'Add a branded restaurant profile and digital menu directly inside the LinkHub experience.',pricingModel:'One-Time',oneTimePrice:49.99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Restaurant information header','Menu categories and items','Hours, phone, website, maps','Order / reservation / contact actions'],included:[],metadata:{family:'linkhub',requires:'linkhub-core'}
    },
    {
      id:'linkhub-pro',name:'VMS LinkHub Pro',kind:'subscription',category:'LinkHub',icon:'LH+',status:'Published',featured:true,displayOrder:53,
      description:'The complete managed LinkHub membership with premium features, analytics, and ongoing control from the Client Portal.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:14.99,cadence:'Monthly',startingAt:false,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Everything in LinkHub Core','Restaurant Menu included','Wi‑Fi feature included','Smart Scan Activity','LinkHub views and click analytics','Dynamic management and ongoing updates','Client Portal management'],included:['VMS LinkHub Core','LinkHub Wi‑Fi Feature','LinkHub Restaurant Menu','Smart Scan Activity'],metadata:{family:'linkhub',plan:'pro',analyticsIncluded:true}
    },
    {
      id:'linkhub-done-for-you',name:'LinkHub Done-for-You Build',kind:'addon',category:'LinkHub',icon:'DFY',status:'Published',featured:false,displayOrder:54,
      description:'Optional hands-on VMS buildout for a client who wants VMS to configure and polish the LinkHub for them.',pricingModel:'One-Time',oneTimePrice:49,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:false,portalVisible:true,promoEligible:true,
      features:['Profile setup','Link organization','Theme/brand styling','VMS-managed initial build'],included:[],metadata:{family:'linkhub',optionalLabor:true}
    },
    {
      id:'vision-starter',name:'Vision Starter',kind:'package',category:'Packages',icon:'START',status:'Published',featured:true,displayOrder:70,
      description:'An affordable digital-foundation package for an existing local business that wants a cleaner, more professional presence.',pricingModel:'One-Time',oneTimePrice:249,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['VMS Business & Website Audit','Local Presence Setup','VMS Smart QR','VMS LinkHub Core','First 3 months of LinkHub Pro'],included:['VMS Business & Website Audit','Local Presence Setup','VMS Smart QR','VMS LinkHub Core','3 months VMS LinkHub Pro'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'website-refresh-package',name:'Website Refresh Package',kind:'package',category:'Packages',icon:'REFRESH',status:'Published',featured:true,displayOrder:71,
      description:'Refresh the website and the surrounding digital presence together instead of treating them as separate projects.',pricingModel:'One-Time',oneTimePrice:749,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Website Refresh / Revamp','VMS Business & Website Audit','Local Presence Setup','VMS LinkHub Core'],included:['Website Refresh / Revamp','VMS Business & Website Audit','Local Presence Setup','VMS LinkHub Core'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'business-launch',name:'VMS Business Launch',kind:'package',category:'Packages',icon:'LAUNCH',status:'Published',featured:true,displayOrder:72,
      description:'A polished launch package for a business that needs a website plus the essential digital tools around it.',pricingModel:'One-Time',oneTimePrice:999,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['New Business Website','Local Presence Setup','VMS Smart QR','VMS LinkHub Core','First 3 months of LinkHub Pro'],included:['New Business Website','Local Presence Setup','VMS Smart QR','VMS LinkHub Core','3 months VMS LinkHub Pro'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'digital-presence',name:'VMS Digital Presence',kind:'subscription',category:'Bundles',icon:'DP',status:'Published',featured:true,displayOrder:80,
      description:'A simple monthly bundle for businesses that want local visibility, review growth, and a fully managed LinkHub.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:59,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Local Presence Care','Review Growth','VMS LinkHub Pro'],included:['Local Presence Care','Review Growth','VMS LinkHub Pro'],metadata:{family:'bundle',activationFeeWaived:true}
    },
    {
      id:'growth-care',name:'VMS Growth Care',kind:'subscription',category:'Bundles',icon:'GROW',status:'Published',featured:true,displayOrder:81,
      description:'The ongoing VMS bundle for a business that wants website care plus local, review, and LinkHub management.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:99,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Everything in Digital Presence','Monthly Website Care','Priority content updates','Periodic VMS digital checkups'],included:['Monthly Website Care','Local Presence Care','Review Growth','VMS LinkHub Pro'],metadata:{family:'bundle',activationFeeWaived:true,recommended:true}
    },
    {
      id:'vms-activation-fee',name:'VMS Activation Fee',kind:'internal',category:'Billing',icon:'FEE',status:'Published',featured:false,displayOrder:999,
      description:'One-time activation line item applied only to a client’s first paid standalone order. Waived for VMS packages and bundles.',pricingModel:'One-Time',oneTimePrice:4.99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Internal',websiteVisible:false,portalVisible:false,promoEligible:false,
      features:[],included:[],metadata:{firstPaidOrderOnly:true,waivedForBundles:true}
    }
  ];

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function normalize(row){
    if(!row)return null;
    return {
      id:row.id,name:row.name,kind:row.kind||row.offer_type||'service',category:row.category||'General',icon:row.icon||'VMS',status:row.status||'Draft',featured:!!row.featured,
      displayOrder:Number(row.display_order??row.displayOrder??999),description:row.description||'',pricingModel:row.pricing_model||row.pricingModel||'Quote Only',
      oneTimePrice:row.one_time_price===null||row.one_time_price===undefined?(row.oneTimePrice??null):Number(row.one_time_price),
      recurringPrice:row.recurring_price===null||row.recurring_price===undefined?(row.recurringPrice??null):Number(row.recurring_price),cadence:row.cadence||null,startingAt:!!(row.starting_at??row.startingAt),
      salesMode:row.sales_mode||row.salesMode||'Request First',websiteVisible:!!(row.website_visible??row.websiteVisible),portalVisible:!!(row.portal_visible??row.portalVisible),promoEligible:!!(row.promo_eligible??row.promoEligible),
      features:Array.isArray(row.features)?row.features:[],included:Array.isArray(row.included)?row.included:[],metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{}
    }
  }
  function dbRow(s){return {id:s.id,name:s.name,kind:s.kind,category:s.category,icon:s.icon,status:s.status,featured:!!s.featured,display_order:Number(s.displayOrder)||999,description:s.description||'',pricing_model:s.pricingModel||'Quote Only',one_time_price:s.oneTimePrice===''||s.oneTimePrice===undefined?null:s.oneTimePrice,recurring_price:s.recurringPrice===''||s.recurringPrice===undefined?null:s.recurringPrice,cadence:s.cadence||null,starting_at:!!s.startingAt,sales_mode:s.salesMode||'Request First',website_visible:!!s.websiteVisible,portal_visible:!!s.portalVisible,promo_eligible:!!s.promoEligible,features:s.features||[],included:s.included||[],metadata:s.metadata||{},updated_at:new Date().toISOString()}}
  function localRead(){try{const raw=localStorage.getItem(LOCAL_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length)return parsed.map(normalize)}}catch{}return clone(DEFAULTS)}
  function localWrite(rows){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(rows.map(normalize)))}catch{}}
  function configReady(){const c=window.VMS_CONFIG||{};return !!(c.supabaseUrl&&c.supabaseAnonKey&&!String(c.supabaseUrl).includes('PASTE_')&&!String(c.supabaseAnonKey).includes('PASTE_'))}
  async function getClient(){if(!configReady()||!window.VMSAuth?.client)return null;try{return await VMSAuth.client()}catch{return null}}
  async function load(opts={}){
    let list;
    const sb=await getClient();
    if(sb){
      try{
        const {data,error}=await sb.from('service_catalog').select('*').order('display_order',{ascending:true});
        if(error)throw error;
        if(Array.isArray(data)&&data.length)list=data.map(normalize);
      }catch(e){console.warn('VMS catalog cloud read failed; using fallback.',e)}
    }
    if(!list)list=localRead();
    if(opts.channel==='website')list=list.filter(x=>x.status==='Published'&&x.websiteVisible&&x.kind!=='internal');
    if(opts.channel==='portal')list=list.filter(x=>x.status==='Published'&&x.portalVisible&&x.kind!=='internal');
    if(opts.kind)list=list.filter(x=>x.kind===opts.kind);
    return list.sort((a,b)=>(a.displayOrder||999)-(b.displayOrder||999));
  }
  async function save(item){
    const normalized=normalize(item),sb=await getClient();
    if(sb&&location.protocol!=='file:'){
      const {error}=await sb.from('service_catalog').upsert(dbRow(normalized),{onConflict:'id'});if(error)throw error;return normalized;
    }
    const all=localRead(),i=all.findIndex(x=>x.id===normalized.id);if(i>=0)all[i]=normalized;else all.push(normalized);localWrite(all);return normalized;
  }
  async function remove(id){
    const sb=await getClient();if(sb&&location.protocol!=='file:'){const {error}=await sb.from('service_catalog').delete().eq('id',id);if(error)throw error;return}
    localWrite(localRead().filter(x=>x.id!==id));
  }
  function priceLabel(s){
    const pre=s.startingAt?'From ':'';
    if(s.pricingModel==='Free')return 'Free';
    if(s.pricingModel==='One-Time')return s.oneTimePrice!=null?`${pre}${money(s.oneTimePrice)} one time`:'Request pricing';
    if(s.pricingModel==='Recurring')return s.recurringPrice!=null?`${pre}${money(s.recurringPrice)}/${String(s.cadence||'Monthly').toLowerCase()==='annual'?'yr':'mo'}`:'Request pricing';
    if(s.pricingModel==='Setup + Recurring')return `${s.oneTimePrice!=null?money(s.oneTimePrice)+' + ':''}${s.recurringPrice!=null?money(s.recurringPrice)+'/mo':'Request pricing'}`;
    return 'Request pricing';
  }
  function tidyPublicLinkHubPricing(){
    if(!document?.body)return;
    document.querySelectorAll('.pricing-group-head').forEach(head=>{
      const eyebrow=head.querySelector('.eyebrow');
      if((eyebrow?.textContent||'').trim()==='VMS LinkHub'){
        const title=head.querySelector('h3');
        const copy=head.querySelector('p');
        if(title)title.textContent='Choose Core or unlock Pro.';
        if(copy)copy.textContent='LinkHub Core is $5.99/month. Wi‑Fi and Restaurant Menu are optional one-time add-ons for Core, or upgrade to LinkHub Pro for both features, Smart Scan Activity, analytics, and ongoing management.';
      }
    });
    document.querySelectorAll('body *').forEach(el=>{
      const text=(el.textContent||'').trim();
      if((text.startsWith('First standalone order:')||text.startsWith('Prices are controlled from VMS Admin')) && el.children.length===0){
        el.remove();
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tidyPublicLinkHubPricing,{once:true});
  else tidyPublicLinkHubPricing();
  window.VMSCatalog={DEFAULTS:clone(DEFAULTS),LOCAL_KEY,load,save,remove,normalize,priceLabel,money,configReady};
})();
