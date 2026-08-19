/* Vision Make Studio — shared service catalog bridge.
   Supabase is the production source of truth for pricing, visibility, and offer details.
   Local file previews use bundled defaults/localStorage only. */
(()=>{
  const LOCAL_KEY='vms_catalog_preview_v4';
  const isHosted=location.protocol!=='file:';
  const CACHE_MS=15000;
  let cache=null;
  let cacheAt=0;
  let syncTimer=null;
  let observer=null;
  let portalAccountCache=null;
  let portalAccountAt=0;

  const money=n=>new Intl.NumberFormat('en-US',{
    style:'currency',
    currency:'USD',
    minimumFractionDigits:Number(n)%1?2:0,
    maximumFractionDigits:2
  }).format(Number(n)||0);

  /* Local-preview safety net. Production pricing always comes from Supabase. */
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
      id:'linkhub-core',name:'VMS LinkHub Core',kind:'subscription',category:'LinkHub',icon:'LH',status:'Published',featured:true,displayOrder:50,
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
      description:'The complete LinkHub membership with premium features, analytics, and Client Portal control.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:19.99,cadence:'Monthly',startingAt:false,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Everything in LinkHub Core','Restaurant Menu included','Wi‑Fi feature included','Smart Scan Activity','LinkHub views and click analytics','Dynamic management and updates','Client Portal management'],included:['VMS LinkHub Core','LinkHub Wi‑Fi Feature','LinkHub Restaurant Menu','Smart Scan Activity'],metadata:{family:'linkhub',plan:'pro',analyticsIncluded:true}
    },
    {
      id:'linkhub-done-for-you',name:'LinkHub Done-for-You Build',kind:'addon',category:'LinkHub',icon:'DFY',status:'Published',featured:false,displayOrder:54,
      description:'Optional hands-on VMS buildout for a client who wants VMS to configure and polish the LinkHub for them.',pricingModel:'One-Time',oneTimePrice:49,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:false,portalVisible:true,promoEligible:true,
      features:['Profile setup','Link organization','Theme/brand styling','VMS-managed initial build'],included:[],metadata:{family:'linkhub',optionalLabor:true}
    },
    {
      id:'vision-starter',name:'Vision Starter',kind:'package',category:'Packages',icon:'START',status:'Published',featured:true,displayOrder:70,
      description:'An affordable digital-foundation package for an existing local business that wants a cleaner, more professional presence.',pricingModel:'One-Time',oneTimePrice:249,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['VMS Business & Website Audit','Local Presence Setup','VMS Smart QR','First 3 months of LinkHub Pro'],included:['VMS Business & Website Audit','Local Presence Setup','VMS Smart QR','3 months VMS LinkHub Pro'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'website-refresh-package',name:'Website Refresh Package',kind:'package',category:'Packages',icon:'REFRESH',status:'Published',featured:true,displayOrder:71,
      description:'Refresh the website and the surrounding digital presence together instead of treating them as separate projects.',pricingModel:'One-Time',oneTimePrice:749,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Website Refresh / Revamp','VMS Business & Website Audit','Local Presence Setup'],included:['Website Refresh / Revamp','VMS Business & Website Audit','Local Presence Setup'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'business-launch',name:'VMS Business Launch',kind:'package',category:'Packages',icon:'LAUNCH',status:'Published',featured:true,displayOrder:72,
      description:'A polished launch package for a business that needs a website plus the essential digital tools around it.',pricingModel:'One-Time',oneTimePrice:999,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['New Business Website','Local Presence Setup','VMS Smart QR','First 3 months of LinkHub Pro'],included:['New Business Website','Local Presence Setup','VMS Smart QR','3 months VMS LinkHub Pro'],metadata:{family:'package',activationFeeWaived:true}
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
      id:row.id,
      name:row.name,
      kind:row.kind||row.offer_type||'service',
      category:row.category||'General',
      icon:row.icon||'VMS',
      status:row.status||'Draft',
      featured:!!row.featured,
      displayOrder:Number(row.display_order??row.displayOrder??999),
      description:row.description||'',
      pricingModel:row.pricing_model||row.pricingModel||'Quote Only',
      oneTimePrice:row.one_time_price===null||row.one_time_price===undefined?(row.oneTimePrice??null):Number(row.one_time_price),
      recurringPrice:row.recurring_price===null||row.recurring_price===undefined?(row.recurringPrice??null):Number(row.recurring_price),
      cadence:row.cadence||null,
      startingAt:!!(row.starting_at??row.startingAt),
      salesMode:row.sales_mode||row.salesMode||'Request First',
      websiteVisible:!!(row.website_visible??row.websiteVisible),
      portalVisible:!!(row.portal_visible??row.portalVisible),
      promoEligible:!!(row.promo_eligible??row.promoEligible),
      features:Array.isArray(row.features)?row.features:[],
      included:Array.isArray(row.included)?row.included:[],
      metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{}
    };
  }

  function dbRow(s){
    return {
      id:s.id,name:s.name,kind:s.kind,category:s.category,icon:s.icon,status:s.status,featured:!!s.featured,
      display_order:Number(s.displayOrder)||999,description:s.description||'',pricing_model:s.pricingModel||'Quote Only',
      one_time_price:s.oneTimePrice===''||s.oneTimePrice===undefined?null:s.oneTimePrice,
      recurring_price:s.recurringPrice===''||s.recurringPrice===undefined?null:s.recurringPrice,
      cadence:s.cadence||null,starting_at:!!s.startingAt,sales_mode:s.salesMode||'Request First',
      website_visible:!!s.websiteVisible,portal_visible:!!s.portalVisible,promo_eligible:!!s.promoEligible,
      features:s.features||[],included:s.included||[],metadata:s.metadata||{},updated_at:new Date().toISOString()
    };
  }

  function localRead(){
    try{
      const raw=localStorage.getItem(LOCAL_KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        if(Array.isArray(parsed)&&parsed.length)return parsed.map(normalize);
      }
    }catch{}
    return clone(DEFAULTS);
  }

  function localWrite(rows){
    try{localStorage.setItem(LOCAL_KEY,JSON.stringify(rows.map(normalize)))}catch{}
  }

  function configReady(){
    const c=window.VMS_CONFIG||{};
    return !!(
      c.supabaseUrl&&
      c.supabaseAnonKey&&
      !String(c.supabaseUrl).includes('PASTE_')&&
      !String(c.supabaseAnonKey).includes('PASTE_')
    );
  }

  async function getClient(){
    if(!configReady()||!window.VMSAuth?.client)return null;
    return VMSAuth.client();
  }

  async function requiredCloudClient(){
    const sb=await getClient();
    if(!sb)throw new Error('Live VMS Service Catalog connection is unavailable.');
    return sb;
  }

  function filterList(list,opts={}){
    let out=[...list];
    if(opts.channel==='website')out=out.filter(x=>x.status==='Published'&&x.websiteVisible&&x.kind!=='internal');
    if(opts.channel==='portal')out=out.filter(x=>x.status==='Published'&&x.portalVisible&&x.kind!=='internal');
    if(opts.kind)out=out.filter(x=>x.kind===opts.kind);
    return out.sort((a,b)=>(a.displayOrder||999)-(b.displayOrder||999));
  }

  function announce(list,source='cloud'){
    try{
      window.dispatchEvent(new CustomEvent('vms:catalog-ready',{
        detail:{services:clone(list),source,at:Date.now()}
      }));
    }catch{}
  }

  async function load(opts={}){
    let all;
    if(!isHosted){
      all=localRead();
      cache=all;cacheAt=Date.now();
      announce(all,'preview');
      return filterList(all,opts);
    }

    const now=Date.now();
    if(!opts.force&&cache&&now-cacheAt<CACHE_MS)return filterList(cache,opts);

    const sb=await requiredCloudClient();
    const {data,error}=await sb
      .from('service_catalog')
      .select('*')
      .order('display_order',{ascending:true});

    if(error)throw error;
    all=(Array.isArray(data)?data:[]).map(normalize);
    cache=all;cacheAt=Date.now();
    announce(all,'supabase');
    return filterList(all,opts);
  }

  async function save(item){
    const normalized=normalize(item);

    if(isHosted){
      const sb=await requiredCloudClient();
      const {error}=await sb.from('service_catalog').upsert(dbRow(normalized),{onConflict:'id'});
      if(error)throw error;
      cache=null;cacheAt=0;
      return normalized;
    }

    const all=localRead();
    const i=all.findIndex(x=>x.id===normalized.id);
    if(i>=0)all[i]=normalized;
    else all.push(normalized);
    localWrite(all);
    cache=null;cacheAt=0;
    return normalized;
  }

  async function remove(id){
    if(isHosted){
      const sb=await requiredCloudClient();
      const {error}=await sb.from('service_catalog').delete().eq('id',id);
      if(error)throw error;
      cache=null;cacheAt=0;
      return;
    }
    localWrite(localRead().filter(x=>x.id!==id));
    cache=null;cacheAt=0;
  }

  function cadenceUnit(cadence,long=false){
    const value=String(cadence||'Monthly').toLowerCase();
    if(value==='annual'||value==='yearly')return long?'year':'yr';
    return long?'month':'mo';
  }

  function priceLabel(s){
    if(!s)return '';
    const pre=s.startingAt?'From ':'';
    if(s.pricingModel==='Free')return 'Free';
    if(s.pricingModel==='One-Time')return s.oneTimePrice!=null?`${pre}${money(s.oneTimePrice)} one time`:'Request pricing';
    if(s.pricingModel==='Recurring')return s.recurringPrice!=null?`${pre}${money(s.recurringPrice)}/${cadenceUnit(s.cadence,false)}`:'Request pricing';
    if(s.pricingModel==='Setup + Recurring'){
      const setup=s.oneTimePrice!=null?`${money(s.oneTimePrice)} + `:'';
      const recurring=s.recurringPrice!=null?`${money(s.recurringPrice)}/${cadenceUnit(s.cadence,false)}`:'Request pricing';
      return `${pre}${setup}${recurring}`;
    }
    return 'Request pricing';
  }

  function priceLabelLong(s){
    if(!s)return '';
    const pre=s.startingAt?'From ':'';
    if(s.pricingModel==='Free')return 'Free';
    if(s.pricingModel==='One-Time')return s.oneTimePrice!=null?`${pre}${money(s.oneTimePrice)} one time`:'Request pricing';
    if(s.pricingModel==='Recurring')return s.recurringPrice!=null?`${pre}${money(s.recurringPrice)}/${cadenceUnit(s.cadence,true)}`:'Request pricing';
    return priceLabel(s);
  }

  function recurringPrice(s,long=false){
    if(!s||s.recurringPrice==null)return s?priceLabel(s):'';
    return `${s.startingAt?'From ':''}${money(s.recurringPrice)}/${cadenceUnit(s.cadence,long)}`;
  }

  function oneTimePrice(s){
    if(!s||s.oneTimePrice==null)return s?priceLabel(s):'';
    return `${s.startingAt?'From ':''}${money(s.oneTimePrice)} one time`;
  }

  function find(id,list=cache||DEFAULTS){
    return (list||[]).find(x=>x.id===id)||null;
  }

  function setText(el,value){
    if(!el||value===undefined||value===null)return;
    const text=String(value);
    if(el.textContent!==text)el.textContent=text;
  }

  function removeLegacyCatalogNotes(){
    if(!document?.body)return;
    document.querySelectorAll('body *').forEach(el=>{
      const text=(el.textContent||'').trim();
      if((text.startsWith('First standalone order:')||text.startsWith('Prices are controlled from VMS Admin'))&&el.children.length===0){
        el.remove();
      }
    });
  }

  function bindExplicitCatalogNodes(list,channel){
    if(!document?.body)return;
    document.querySelectorAll('[data-vms-service-id]').forEach(node=>{
      const id=node.getAttribute('data-vms-service-id');
      const service=list.find(x=>x.id===id);
      if(!service)return;

      const allowed=service.status==='Published'&&service.kind!=='internal'&&
        (channel==='portal'?service.portalVisible:channel==='website'?service.websiteVisible:true);

      if(node.hasAttribute('data-vms-auto-visibility')){
        node.hidden=!allowed;
      }

      const apply=(selector,value)=>{
        if(node.matches(selector))setText(node,value);
        node.querySelectorAll(selector).forEach(el=>setText(el,value));
      };

      apply('[data-vms-name]',service.name);
      apply('[data-vms-description]',service.description);
      apply('[data-vms-price]',priceLabel(service));
      apply('[data-vms-price-long]',priceLabelLong(service));
      apply('[data-vms-icon]',service.icon);
      apply('[data-vms-category]',service.category);
      apply('[data-vms-sales-mode]',service.salesMode);
      node.dataset.vmsCatalogBound='1';
    });
  }

  function normalizedName(v){
    return String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function serviceAliases(service){
    const names=[service.name];
    const short=service.name.replace(/^VMS\s+/i,'');
    if(short!==service.name)names.push(short);
    if(service.id==='linkhub-wifi')names.push('Guest Wi-Fi','Wi-Fi Feature','Wi-Fi');
    if(service.id==='linkhub-menu')names.push('Restaurant Menu');
    return [...new Set(names.map(normalizedName).filter(Boolean))];
  }

  function priceLike(text){
    const t=String(text||'').replace(/\s+/g,' ').trim();
    if(!t||t.length>80)return false;
    return /^(?:from\s+)?(?:free|request pricing|\$[\d,.]+(?:\s*\+\s*\$[\d,.]+)?)(?:\s*(?:\/\s*(?:mo|month|yr|year)|per\s+(?:month|year)|one[\s-]?time|monthly|annual(?:ly)?))?$/i.test(t);
  }

  function nearestOfferCard(title){
    return title.closest(
      '[data-vms-service-id],article,.pricing-card,.service-card,.offer-card,.package-card,.price-card,.pricing-item,.plan-card,.card'
    );
  }

  function findPriceTarget(card){
    if(!card)return null;
    const direct=card.querySelector(
      '[data-vms-price],.pricing-price,.service-price,.offer-price,.card-price,.price-value,.plan-price,[data-price]'
    );
    if(direct)return direct;

    const leaves=[...card.querySelectorAll('strong,b,span,p,small,div')]
      .filter(el=>el.children.length===0&&priceLike(el.textContent));
    return leaves[0]||null;
  }

  function bindLegacyNamedCards(list){
    if(!document?.body)return;

    const titleNodes=[...document.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,.service-name,.pricing-title,.card-title,.offer-title,.plan-title,strong'
    )];

    for(const service of list){
      const aliases=serviceAliases(service);
      const title=titleNodes.find(el=>aliases.includes(normalizedName(el.textContent)));
      if(!title)continue;

      const card=nearestOfferCard(title);
      const target=findPriceTarget(card);
      if(target)setText(target,priceLabel(service));
    }
  }

  function syncPublicLinkHubCopy(list){
    if(!document?.body||location.pathname.startsWith('/portal')||location.pathname.startsWith('/admin'))return;
    const core=list.find(x=>x.id==='linkhub-core');
    const pro=list.find(x=>x.id==='linkhub-pro');
    const wifi=list.find(x=>x.id==='linkhub-wifi');
    const menu=list.find(x=>x.id==='linkhub-menu');

    document.querySelectorAll('.pricing-group-head').forEach(head=>{
      const eyebrow=head.querySelector('.eyebrow');
      if(!/VMS LinkHub/i.test((eyebrow?.textContent||'').trim()))return;

      const title=head.querySelector('h3');
      const copy=head.querySelector('p');
      if(title)setText(title,'Choose Core or unlock Pro.');

      if(copy&&core){
        const pieces=[`LinkHub Core is ${recurringPrice(core,true)}`];
        if(wifi)pieces.push(`Wi-Fi is ${oneTimePrice(wifi)}`);
        if(menu)pieces.push(`Restaurant Menu is ${oneTimePrice(menu)}`);
        let text=pieces.join('. ')+'.';
        if(pro)text+=` LinkHub Pro is ${recurringPrice(pro,true)} and includes Wi-Fi, Restaurant Menu, Smart Scan Activity, and analytics.`;
        setText(copy,text);
      }
    });
  }

  function agreedPriceLabel(service,row){
    if(!service)return '';
    if(!row||row.agreed_price===null||row.agreed_price===undefined)return priceLabel(service);

    const amount=Number(row.agreed_price);
    if(!Number.isFinite(amount))return priceLabel(service);

    const cadence=row.billing_cadence||service.cadence;
    if(service.pricingModel==='Recurring'||cadence){
      return `${money(amount)}/${cadenceUnit(cadence,false)}`;
    }
    return `${money(amount)} one time`;
  }

  async function portalAccountPricing(all,opts={}){
    const rows=[];
    if(!isHosted)return {rows,client:null};

    if(!opts.force&&portalAccountCache&&Date.now()-portalAccountAt<CACHE_MS){
      return portalAccountCache;
    }

    try{
      const sb=await requiredCloudClient();
      const {data:{session}}=await sb.auth.getSession();
      const email=String(session?.user?.email||'').trim().toLowerCase();
      if(!email){
        portalAccountCache={rows,client:null};
        portalAccountAt=Date.now();
        return portalAccountCache;
      }

      const {data:client,error:clientError}=await sb
        .from('clients')
        .select('id,business_name,owner_email')
        .ilike('owner_email',email)
        .maybeSingle();

      if(clientError||!client?.id){
        portalAccountCache={rows,client:null};
        portalAccountAt=Date.now();
        return portalAccountCache;
      }

      const {data:serviceRows,error:serviceError}=await sb
        .from('client_services')
        .select('service_key,agreed_price,billing_cadence,service_status,billing_status')
        .eq('client_id',client.id);

      if(serviceError){
        portalAccountCache={rows,client};
        portalAccountAt=Date.now();
        return portalAccountCache;
      }

      portalAccountCache={rows:Array.isArray(serviceRows)?serviceRows:[],client};
      portalAccountAt=Date.now();
      return portalAccountCache;
    }catch(e){
      console.warn('VMS portal agreed-price lookup failed; using catalog standard.',e);
      portalAccountCache={rows,client:null};
      portalAccountAt=Date.now();
      return portalAccountCache;
    }
  }

  function updatePortalActiveServiceCards(all,rows){
    const grid=document.getElementById('activeServiceGrid');
    if(!grid)return;

    grid.querySelectorAll('.service-card').forEach(card=>{
      const name=normalizedName(card.querySelector('.service-copy strong')?.textContent);
      if(!name)return;

      const service=all.find(s=>serviceAliases(s).includes(name));
      if(!service)return;

      const row=rows.find(r=>r.service_key===service.id);
      const badge=card.querySelector('.catalog-meta .badge');
      if(badge)setText(badge,agreedPriceLabel(service,row));
    });
  }

  function updatePortalOptionalAddons(all){
    const pro=all.find(x=>x.id==='linkhub-pro');
    const wifi=all.find(x=>x.id==='linkhub-wifi');
    const menu=all.find(x=>x.id==='linkhub-menu');

    const wifiCopy=document.querySelector('#linkHubWifiFeatureCard .optional-feature-copy p');
    const menuCopy=document.querySelector('#linkHubMenuFeatureCard .optional-feature-copy p');

    if(wifiCopy&&wifi){
      setText(wifiCopy,`${pro?'Included with LinkHub Pro. ':''}Standalone LinkHub add-on: ${oneTimePrice(wifi)}.`);
    }
    if(menuCopy&&menu){
      setText(menuCopy,`${pro?'Included with LinkHub Pro. ':''}Standalone LinkHub add-on: ${oneTimePrice(menu)}.`);
    }
  }

  function updatePortalBilling(all,rows){
    const pro=all.find(x=>x.id==='linkhub-pro');
    if(!pro)return;

    const proRow=rows.find(r=>r.service_key==='linkhub-pro');
    const activeAmount=proRow?.agreed_price!==null&&proRow?.agreed_price!==undefined
      ?Number(proRow.agreed_price)
      :pro.recurringPrice;
    const activeCadence=proRow?.billing_cadence||pro.cadence||'Monthly';
    const activeShort=Number.isFinite(activeAmount)
      ?`${money(activeAmount)}/${cadenceUnit(activeCadence,false)}`
      :recurringPrice(pro,false);
    const activeLong=Number.isFinite(activeAmount)
      ?`${money(activeAmount)}/${cadenceUnit(activeCadence,true)}`
      :recurringPrice(pro,true);

    const planName=document.getElementById('billingPlanName');
    if(planName)setText(planName,`${pro.name} · ${activeLong}`);

    const standard=document.getElementById('billingStandardPrice');
    if(standard)setText(standard,recurringPrice(pro,false));

    const linkHubBadge=[...document.querySelectorAll('#section-linkhub .badge')]
      .find(el=>/LinkHub Pro/i.test(el.textContent||''));
    if(linkHubBadge)setText(linkHubBadge,`${pro.name.replace(/^VMS\s+/,'')} · ${activeShort}`);

    const billingEyebrow=document.querySelector('#section-billing .billing-hero small');
    if(billingEyebrow&&/TEST MEMBERSHIP/i.test(billingEyebrow.textContent||'')){
      setText(billingEyebrow,'ACTIVE MEMBERSHIP');
    }

    const activation=all.find(x=>x.id==='vms-activation-fee');
    if(activation){
      document.querySelectorAll('#section-billing .billing-item').forEach(item=>{
        const label=(item.querySelector('span')?.textContent||'').trim().toUpperCase();
        if(label==='ACTIVATION FEE'){
          const value=item.querySelector('strong');
          if(value)setText(value,`${money(activation.oneTimePrice)} first standalone order`);
        }
      });
    }
  }

  async function syncPortalCatalogUi(all=null){
    if(!document?.body||!location.pathname.startsWith('/portal'))return;
    try{
      const catalog=all||await load({force:false});
      const account=await portalAccountPricing(catalog);
      updatePortalBilling(catalog,account.rows);
      updatePortalOptionalAddons(catalog);
      updatePortalActiveServiceCards(catalog,account.rows);
      bindExplicitCatalogNodes(catalog,'portal');
    }catch(e){
      console.warn('VMS Client Portal catalog UI sync failed.',e);
    }
  }

  async function syncPublicCatalogUi(all=null){
    if(!document?.body||location.pathname.startsWith('/portal')||location.pathname.startsWith('/admin'))return;
    try{
      const catalog=all||await load({force:false});
      const website=filterList(catalog,{channel:'website'});
      removeLegacyCatalogNotes();
      bindExplicitCatalogNodes(catalog,'website');
      bindLegacyNamedCards(website);
      syncPublicLinkHubCopy(website);
    }catch(e){
      console.warn('VMS public catalog UI sync failed.',e);
    }
  }

  function scheduleDomResync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{
      if(location.pathname.startsWith('/portal'))syncPortalCatalogUi(cache||null);
      else if(!location.pathname.startsWith('/admin'))syncPublicCatalogUi(cache||null);
    },90);
  }

  function startDomObserver(){
    if(observer||!document?.body||location.pathname.startsWith('/admin'))return;
    observer=new MutationObserver(scheduleDomResync);
    observer.observe(document.body,{childList:true,subtree:true});
  }

  async function syncRuntime(opts={}){
    if(location.pathname.startsWith('/admin'))return;
    try{
      if(opts.force)portalAccountAt=0;
      const all=await load({force:!!opts.force});
      if(location.pathname.startsWith('/portal'))await syncPortalCatalogUi(all);
      else await syncPublicCatalogUi(all);
      startDomObserver();
    }catch(e){
      console.warn('VMS catalog runtime sync failed.',e);
    }
  }

  function bootCatalogUiSync(){
    if(!location.pathname.startsWith('/admin'))removeLegacyCatalogNotes();
    syncRuntime({force:true});

    if(!location.pathname.startsWith('/admin')){
      window.addEventListener('focus',()=>syncRuntime({force:true}));
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible')syncRuntime({force:true});
      });
      setInterval(()=>syncRuntime({force:true}),60000);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootCatalogUiSync,{once:true});
  else setTimeout(bootCatalogUiSync,0);

  window.VMSCatalog={
    DEFAULTS:clone(DEFAULTS),
    LOCAL_KEY,
    load,
    save,
    remove,
    normalize,
    priceLabel,
    priceLabelLong,
    recurringPrice,
    oneTimePrice,
    money,
    find,
    configReady,
    syncRuntime,
    syncPortalPricing:syncPortalCatalogUi
  };
})();
