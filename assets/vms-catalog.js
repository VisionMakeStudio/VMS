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
      description:'Ongoing content changes, small updates, and support for a VMS-managed website.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:49.99,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Content and image changes','Small page/section updates','Routine maintenance','VMS support requests'],included:[],metadata:{family:'website'}
    },
    {
      id:'local-presence-setup',name:'Local Presence Setup',kind:'service',category:'Local Growth',icon:'LOCAL',status:'Published',featured:true,displayOrder:20,
      description:'Clean up and strengthen how your business information appears across important local platforms.',pricingModel:'One-Time',oneTimePrice:149,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Business information consistency','Google-focused visibility review','Hours, links, and category cleanup','Local presence recommendations'],included:[],metadata:{family:'local'}
    },
    {
      id:'local-presence-care',name:'Local Presence Care',kind:'subscription',category:'Local Growth',icon:'LOCAL+',status:'Published',featured:false,displayOrder:21,
      description:'Ongoing monitoring and updates for core business information and local visibility signals.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:29.99,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Listing monitoring','Business info corrections','Hours/link updates','Visibility recommendations'],included:[],metadata:{family:'local'}
    },
    {
      id:'review-growth',name:'Review Growth',kind:'subscription',category:'Reputation',icon:'REV',status:'Published',featured:true,displayOrder:30,
      description:'A practical system for consistently making it easier for happy customers to leave reviews.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:39.99,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Review pathways and calls-to-action','QR / LinkHub review routes','Review-growth workflow','Ongoing recommendations'],included:[],metadata:{family:'reviews'}
    },
    {
      id:'smart-qr',name:'VMS Smart QR',kind:'service',category:'QR & Growth',icon:'QR',status:'Published',featured:true,displayOrder:40,
      description:'A branded QR for the destination your business needs. The standard one-time version is ideal when ongoing scan analytics are not required.',pricingModel:'One-Time',oneTimePrice:14.99,recurringPrice:null,cadence:null,startingAt:true,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Branded QR artwork','Website, reviews, booking, social, and custom destinations','Print-ready export','No monthly fee for the standard version'],included:[],metadata:{family:'qr',analyticsIncluded:false}
    },
    {
      id:'tap-scan-stand',name:'VMS Tap and Scan Stand',kind:'addon',category:'QR & Growth',icon:'QR',status:'Published',featured:false,displayOrder:45,
      description:'A countertop stand with a QR code and an NFC tap tag. VMS sets it up to open the link you choose, such as your LinkHub, reviews or menu.',pricingModel:'One-Time',oneTimePrice:29.99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:['Tap with a phone or scan the QR code','Comes in white or black','Set to any link you choose, and changeable later with a tracked code','Free shipping in the U.S.'],included:[],metadata:{family:'stand',physical:true,freeShipping:true,colors:['white','black']}
    },
    {
      id:'review-tap-card',name:'VMS Review Tap Card',kind:'addon',category:'QR & Growth',icon:'QR',status:'Published',featured:false,displayOrder:46,
      description:'A wallet-size NFC card customers tap with their phone to leave you a Google review. Great for the register, tables or your team.',pricingModel:'One-Time',oneTimePrice:15,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:['Wallet-size card, white','Tap with a phone or scan to leave a review','VMS sets it to your Google review link','Free shipping in the U.S.'],included:[],metadata:{family:'review-card',physical:true,freeShipping:true,colors:['white']}
    },
    {
      id:"re-essentials",name:"Listing Essentials",kind:"package",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:60,
      description:"The core media for a listing: photos, a floor plan and a feature walkthrough video.",pricingModel:"One-Time",oneTimePrice:299,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["About 25 edited photos", "Measured floor plan", "Feature highlight walkthrough video", "Delivered as one download link"],included:["Listing Photography", "Floor Plan", "Feature Highlight Tour"],metadata:{"family": "media", "vertical": "real-estate", "tier": "package"}
    },
    {
      id:"re-agent-pro",name:"Agent Listing Pro",kind:"package",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:61,
      description:"Everything in Essentials, plus an on-camera agent tour and short reels for social.",pricingModel:"One-Time",oneTimePrice:549,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["Everything in Listing Essentials", "Agent on-camera lifestyle tour", "2 short vertical reels", "Delivered as one download link"],included:["Listing Photography", "Floor Plan", "Feature Highlight Tour", "Agent On-Camera Tour", "Listing Reels"],metadata:{"family": "media", "vertical": "real-estate", "tier": "package"}
    },
    {
      id:"re-agent-monthly",name:"Agent Monthly",kind:"subscription",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:62,
      description:"Two listing shoots every month for busy agents.",pricingModel:"Recurring",oneTimePrice:null,recurringPrice:499,cadence:"Monthly",startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["2 listing shoots each month", "Photos, floor plan or walkthrough per shoot", "Priority scheduling", "Cancel any time"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "monthly"}
    },
    {
      id:"re-brokerage",name:"Brokerage Plan",kind:"subscription",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:63,
      description:"A shared pool of shoots for a brokerage, used by any agent on the team.",pricingModel:"Recurring",oneTimePrice:null,recurringPrice:2200,cadence:"Monthly",startingAt:true,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["10 shoots each month, shared by your agents", "One invoice for the brokerage", "Agents book from one place", "Custom plans for larger teams"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "monthly"}
    },
    {
      id:"re-listing-photos",name:"Listing Photography",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:64,
      description:"Edited photos of the property, ready for the MLS, Zillow and social.",pricingModel:"One-Time",oneTimePrice:175,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["About 25 edited photos", "Interior and exterior", "Bright, natural color editing", "Delivered as a download link"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single"}
    },
    {
      id:"re-floor-plan",name:"Floor Plan",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:65,
      description:"A measured 2D floor plan buyers can understand at a glance.",pricingModel:"One-Time",oneTimePrice:129,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["Measured 2D floor plan", "Great for listings and brochures", "Add it to any photo package for $79"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single", "addOnPrice": 79}
    },
    {
      id:"re-feature-tour",name:"Feature Highlight Tour",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:66,
      description:"A quick walkthrough-style video that moves through the home and shows off its best features.",pricingModel:"One-Time",oneTimePrice:149,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["Walkthrough-style video", "Smooth movement through the home", "Cut for listings and social"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single"}
    },
    {
      id:"re-agent-tour",name:"Agent On-Camera Tour",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:67,
      description:"The agent walks through the home on camera and explains every detail.",pricingModel:"One-Time",oneTimePrice:299,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["Agent on camera, room by room", "Edited and ready to post", "Great for introductions and open houses"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single"}
    },
    {
      id:"re-reels",name:"Listing Reels",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:68,
      description:"Three short vertical clips for Instagram, TikTok and Facebook.",pricingModel:"One-Time",oneTimePrice:149,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["3 short vertical clips", "Cut for social feeds", "Includes feature highlights"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single"}
    },
    {
      id:"re-360-tour",name:"360 Virtual Tour",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:69,
      description:"An interactive 360 tour buyers can explore online.",pricingModel:"One-Time",oneTimePrice:249,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["Interactive 360 tour", "A link to share or embed", "Hosting terms confirmed when you book"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single"}
    },
    {
      id:"re-drone-photos",name:"Drone Photos",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:70,
      description:"Aerial photos that show the property and its surroundings.",pricingModel:"One-Time",oneTimePrice:125,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:false,portalVisible:false,promoEligible:false,
      features:["Aerial photos", "Edited and ready for listings"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single", "drone": true}
    },
    {
      id:"re-drone-video",name:"Drone Video",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:71,
      description:"A short aerial video of the property and its surroundings.",pricingModel:"One-Time",oneTimePrice:175,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:false,portalVisible:false,promoEligible:false,
      features:["Aerial video", "Edited and ready for listings"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single", "drone": true}
    },
    {
      id:"re-drone-bundle",name:"Drone Bundle",kind:"service",category:"Real Estate Media",icon:'Media',status:'Published',featured:false,displayOrder:72,
      description:"Aerial photos and video together.",pricingModel:"One-Time",oneTimePrice:249,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:false,portalVisible:false,promoEligible:false,
      features:["Aerial photos", "Aerial video", "Edited and ready for listings"],included:[],metadata:{"family": "media", "vertical": "real-estate", "tier": "single", "drone": true}
    },
    {
      id:"rest-photo-refresh",name:"Restaurant Photo Refresh",kind:"package",category:"Restaurant Media",icon:'Media',status:'Published',featured:false,displayOrder:80,
      description:"Food, drink and interior photos for your menu, website and Google profile.",pricingModel:"One-Time",oneTimePrice:249,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["About 20 edited photos", "Food, drinks and interior", "Sized for web, Google and social"],included:[],metadata:{"family": "media", "vertical": "restaurant", "tier": "package"}
    },
    {
      id:"rest-social-content",name:"Restaurant Social Content",kind:"package",category:"Restaurant Media",icon:'Media',status:'Published',featured:false,displayOrder:81,
      description:"Photos plus short vertical clips made for social media.",pricingModel:"One-Time",oneTimePrice:449,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["About 20 edited photos", "4 short vertical clips", "Food, drinks and interior", "Sized for web, Google and social"],included:[],metadata:{"family": "media", "vertical": "restaurant", "tier": "package"}
    },
    {
      id:"rest-full-presence",name:"Full Restaurant Presence",kind:"package",category:"Restaurant Media",icon:'Media',status:'Published',featured:false,displayOrder:82,
      description:"A complete content set: photos, clips, a walkthrough and a 360 tour of the space.",pricingModel:"One-Time",oneTimePrice:749,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["About 30 edited photos", "6 short vertical clips", "Interior walkthrough video", "360 tour of the space"],included:[],metadata:{"family": "media", "vertical": "restaurant", "tier": "package"}
    },
    {
      id:"rest-monthly-content",name:"Monthly Content Day",kind:"subscription",category:"Restaurant Media",icon:'Media',status:'Published',featured:false,displayOrder:83,
      description:"One shoot each month so your content always feels fresh.",pricingModel:"Recurring",oneTimePrice:null,recurringPrice:399,cadence:"Monthly",startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:false,
      features:["One shoot each month", "Photos and short clips", "Ready for social and Google", "Cancel any time"],included:[],metadata:{"family": "media", "vertical": "restaurant", "tier": "monthly"}
    },
    {
      id:"auto-inventory-day",name:"Inventory Photo Day",kind:"service",category:"Automotive Media",icon:'Media',status:'Published',featured:false,displayOrder:90,
      description:"A shoot day to photograph the vehicles on your lot.",pricingModel:"One-Time",oneTimePrice:399,recurringPrice:null,cadence:null,startingAt:true,salesMode:'Request First',websiteVisible:false,portalVisible:false,promoEligible:false,
      features:["Photos of your inventory", "Consistent angles and editing", "Ready for your listings"],included:[],metadata:{"family": "media", "vertical": "automotive", "tier": "single"}
    },
    {
      id:"auto-walkaround-reels",name:"Walkaround Reels",kind:"service",category:"Automotive Media",icon:'Media',status:'Published',featured:false,displayOrder:91,
      description:"Short vertical walkaround videos of featured vehicles.",pricingModel:"One-Time",oneTimePrice:249,recurringPrice:null,cadence:null,startingAt:true,salesMode:'Request First',websiteVisible:false,portalVisible:false,promoEligible:false,
      features:["Short vertical walkarounds", "Cut for social and listings"],included:[],metadata:{"family": "media", "vertical": "automotive", "tier": "single"}
    },
    {
      id:'linkhub-core',name:'VMS LinkHub Core',kind:'subscription',category:'LinkHub',icon:'LH',status:'Published',featured:true,displayOrder:50,
      description:'A polished digital business card with your profile, contact actions, links, social icons, colors, and Visit Us page.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:5.99,cadence:'Monthly',startingAt:false,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Business profile and contact actions','Custom links and social icons','Theme and brand colors','Visit Us / Directions page','Unlimited static QR codes'],included:[],metadata:{family:'linkhub',plan:'core'}
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
      description:'The complete managed LinkHub membership with premium features, analytics, and ongoing control from the Client Portal.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:19.99,cadence:'Monthly',startingAt:false,salesMode:'Buy Now',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Everything in LinkHub Core','Tracked (dynamic) QR codes with scan counts','Restaurant Menu included','Wi‑Fi feature included','Smart Scan Activity','LinkHub views and click analytics','Dynamic management and ongoing updates','Client Portal management'],included:['VMS LinkHub Core','LinkHub Wi‑Fi Feature','LinkHub Restaurant Menu','Smart Scan Activity'],metadata:{family:'linkhub',plan:'pro',analyticsIncluded:true}
    },
    {
      id:'linkhub-done-for-you',name:'LinkHub Done-for-You Build',kind:'addon',category:'LinkHub',icon:'DFY',status:'Published',featured:false,displayOrder:54,
      description:'Optional hands-on VMS buildout for a client who wants VMS to configure and polish the LinkHub for them.',pricingModel:'One-Time',oneTimePrice:49,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:false,portalVisible:true,promoEligible:true,
      features:['Profile setup','Link organization','Theme/brand styling','VMS-managed initial build'],included:[],metadata:{family:'linkhub',optionalLabor:true}
    },
    {
      id:'vision-starter',name:'Vision Starter',kind:'package',category:'Packages',icon:'START',status:'Published',featured:true,displayOrder:70,
      description:'An affordable digital-foundation package for an existing local business that wants a cleaner, more professional presence.',pricingModel:'One-Time',oneTimePrice:249.99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['VMS Business & Website Audit','Local Presence Setup','VMS Smart QR','First 3 months of LinkHub Pro'],included:['VMS Business & Website Audit','Local Presence Setup','VMS Smart QR','3 months VMS LinkHub Pro'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'website-refresh-package',name:'Website Refresh Package',kind:'package',category:'Packages',icon:'REFRESH',status:'Published',featured:true,displayOrder:71,
      description:'Refresh the website and the surrounding digital presence together instead of treating them as separate projects.',pricingModel:'One-Time',oneTimePrice:749.99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Website Refresh / Revamp','VMS Business & Website Audit','Local Presence Setup'],included:['Website Refresh / Revamp','VMS Business & Website Audit','Local Presence Setup'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'business-launch',name:'VMS Business Launch',kind:'package',category:'Packages',icon:'LAUNCH',status:'Published',featured:true,displayOrder:72,
      description:'A polished launch package for a business that needs a website plus the essential digital tools around it.',pricingModel:'One-Time',oneTimePrice:849.99,recurringPrice:null,cadence:null,startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['New Business Website','Local Presence Setup','VMS Smart QR','First 3 months of LinkHub Pro'],included:['New Business Website','Local Presence Setup','VMS Smart QR','3 months VMS LinkHub Pro'],metadata:{family:'package',activationFeeWaived:true}
    },
    {
      id:'digital-presence',name:'VMS Digital Presence',kind:'subscription',category:'Bundles',icon:'DP',status:'Published',featured:true,displayOrder:80,
      description:'A simple monthly bundle for businesses that want local visibility, review growth, and a fully managed LinkHub.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:59.99,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
      features:['Local Presence Care','Review Growth','VMS LinkHub Pro'],included:['Local Presence Care','Review Growth','VMS LinkHub Pro'],metadata:{family:'bundle',activationFeeWaived:true}
    },
    {
      id:'growth-care',name:'VMS Growth Care',kind:'subscription',category:'Bundles',icon:'GROW',status:'Published',featured:true,displayOrder:81,
      description:'The ongoing VMS bundle for a business that wants website care plus local, review, and LinkHub management.',pricingModel:'Recurring',oneTimePrice:null,recurringPrice:89.99,cadence:'Monthly',startingAt:false,salesMode:'Request First',websiteVisible:true,portalVisible:true,promoEligible:true,
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
      features:Array.isArray(row.features)?row.features:[],included:Array.isArray(row.included)?row.included:[],metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{},archived:!!(row.archived??row.metadata?.archived)
    }
  }
  function dbRow(s){const metadata={...(s.metadata||{})};if(s.archived!==undefined)metadata.archived=!!s.archived;return {id:s.id,name:s.name,kind:s.kind,category:s.category,icon:s.icon,status:s.status,featured:!!s.featured,display_order:Number(s.displayOrder)||999,description:s.description||'',pricing_model:s.pricingModel||'Quote Only',one_time_price:s.oneTimePrice===''||s.oneTimePrice===undefined?null:s.oneTimePrice,recurring_price:s.recurringPrice===''||s.recurringPrice===undefined?null:s.recurringPrice,cadence:s.cadence||null,starting_at:!!s.startingAt,sales_mode:s.salesMode||'Request First',website_visible:!!s.websiteVisible,portal_visible:!!s.portalVisible,promo_eligible:!!s.promoEligible,features:s.features||[],included:s.included||[],metadata,updated_at:new Date().toISOString()}}
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
    if(opts.channel==='website')list=list.filter(x=>!x.archived&&x.status==='Published'&&x.websiteVisible&&x.kind!=='internal');
    if(opts.channel==='portal')list=list.filter(x=>!x.archived&&x.status==='Published'&&x.portalVisible&&x.kind!=='internal');
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
