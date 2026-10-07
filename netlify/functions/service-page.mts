import { getPublicSalesData, promotionApplies, servicePriceLabel } from './_shared/public-sales.mts';

const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const jsonForScript=(v:any)=>JSON.stringify(v).replace(/</g,'\\u003c');
function promoText(p:any){
  if(p.discountType==='percent'&&p.discountValue!=null)return `${p.discountValue}% off`;
  if(p.discountType==='amount'&&p.discountValue!=null)return `${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.discountValue)} off`;
  return p.description||'Special VMS offer';
}
const AREA='New Jersey, New York and Connecticut';
const AREA_SHORT='NJ, NY & CT';
const CITIES=['Newark','Jersey City','Elizabeth','Hoboken','Paterson','Edison','Union','Manhattan','Brooklyn','Queens','The Bronx','Staten Island','Westchester','Stamford'];
/* Search-focused copy per category: what people actually type into Google, answered plainly. */
const CAT:Record<string,{kw:string,intro:string[],faq:Array<[string,string]>}>={
  'Websites':{kw:'web design',intro:['A fast, mobile-first website is still the first thing most customers check before they call, book or visit. VMS designs and builds websites for local businesses that load quickly on phones, show up properly on Google and make the next step obvious: call, book, order or get directions.','Every site includes clear calls to action, on-page SEO basics (titles, descriptions, headings and structured data), Google Business Profile links and launch support, so you are not left guessing after it goes live.'],
    faq:[['How long does a small business website take?','Most refreshes launch in 1 to 3 weeks and most new sites in 2 to 5 weeks, depending on pages, photos and how quickly content is approved.'],['Will my website show up on Google?','Every VMS site is built with search basics in place: clean page titles, descriptions, headings, fast loading, mobile layout, structured data and a sitemap. Pair it with Local Presence for Google Maps visibility.'],['Can you redo my existing website?','Yes. A Website Refresh keeps what works, fixes what slows people down and adds clear buttons for calling, booking and ordering.']]},
  'Local Growth':{kw:'local SEO and Google Business Profile management',intro:['When people nearby search for what you sell, Google Maps decides who they see first. VMS cleans up your Google Business Profile, categories, hours, photos, links and business details so nearby customers find you and trust what they see.','We also check that your name, address and phone match across the directories and platforms Google cross-references, which is one of the most common reasons local businesses rank lower than they should.'],
    faq:[['What is local SEO?','Local SEO is everything that helps your business appear in Google Maps and "near me" searches: an accurate Google Business Profile, the right categories, consistent business details, photos, reviews and a website that supports it.'],['How fast will I see results on Google Maps?','Profile fixes often show within days. Ranking gains usually build over several weeks as Google re-checks your details, reviews and activity.'],['Do I need to give you my Google password?','No. You add VMS as a manager on your Google Business Profile and can remove access anytime.']]},
  'Reputation':{kw:'Google review growth',intro:['More recent, positive reviews help you rank higher on Google Maps and convince people to choose you. VMS sets up simple review paths, QR codes, tap cards and LinkHub buttons that take happy customers straight to your Google review page.','We also help you respond to reviews and keep a steady flow coming in, without fake reviews or anything that breaks Google rules.'],
    faq:[['How do I get more Google reviews?','Make it easy at the right moment: a QR code or tap card at the counter, a review link after the visit, and a short ask from your team. VMS sets all of this up for you.'],['Do you write or buy reviews?','Never. Every review comes from real customers, which keeps your profile safe and within Google policy.']]},
  'QR & Growth':{kw:'custom QR codes and NFC review stands',intro:['Branded QR codes and NFC tap products turn every counter, table and window into a shortcut to your menu, reviews, booking page, Wi-Fi or LinkHub. Tracked codes count scans and let you change the destination later without reprinting.','VMS designs the code in your colors, sets the link and ships physical stands and cards with free U.S. shipping.'],
    faq:[['What is the difference between a static and a tracked QR code?','A static code always opens the same address. A tracked (dynamic) code counts scans and can be pointed to a new link later without reprinting.'],['Do customers need an app to tap the stand?','No. Most modern phones read NFC and QR codes with the built-in camera or a simple tap.']]},
  'LinkHub':{kw:'link in bio page and digital business card',intro:['LinkHub is one mobile page for everything a customer needs: call, directions, menu, Wi-Fi, booking, reviews and socials. Share it from Instagram, print it on a QR code or put it on a tap stand.','You can edit it anytime from your Member Portal, and LinkHub Pro adds tracked QR codes and visit analytics.'],
    faq:[['Is LinkHub like Linktree?','Similar idea, built for local businesses: contact buttons, a menu screen, Wi-Fi sharing and Visit Us details, all in your colors.'],['Can I change my LinkHub myself?','Yes. Edit and publish anytime from the VMS Member Portal.']]},
  'Real Estate Media':{kw:'real estate photography, floor plans and virtual tours',intro:['Listings with professional photos, a floor plan and video get more clicks and more showings. VMS shoots edited listing photos, measured 2D floor plans, walkthrough video, agent on-camera tours, vertical reels and 360 virtual tours for agents and brokerages.','Everything is delivered in one download link, sized for the MLS, Zillow and social media.'],
    faq:[['How fast do I get listing photos back?','Edited photos are typically delivered within 24 to 48 hours of the shoot.'],['Do you offer monthly plans for agents?','Yes. Agent Monthly and Brokerage plans bundle regular shoots at a lower per-listing cost.'],['Where do you shoot?','Across New Jersey, New York and Connecticut. Send the address and a preferred date and VMS confirms the booking with you.']]},
  'Restaurant Media':{kw:'restaurant food photography and social content',intro:['Great food photos sell the dish before anyone walks in. VMS shoots plated food, drinks and interiors, plus short vertical clips for Instagram, TikTok and Google, and updates your menu photos where people actually look.'],
    faq:[['What do restaurant shoots include?','Food, drinks, interior and team shots, edited and delivered for your website, Google profile, delivery apps and social media.'],['Can you post the content for us?','Monthly content plans include fresh photos and clips each month; ask about posting support.']]},
  'Business Review':{kw:'free website and local business audit',intro:['Not sure what to fix first? A VMS checkup looks at your website, Google Maps presence, reviews and how customers reach you, then gives you a clear, prioritized list in plain language.','Every audit is reviewed by a real person, never an automatic fake score.'],
    faq:[['Is the checkup really free?','Yes. The Free Business Checkup has no cost and no obligation.'],['What does the full audit include?','Category scores for website, local presence, reviews and customer systems, evidence for each finding and prioritized recommendations.']]},
};
CAT['Packages']={kw:'website and local marketing packages',intro:['Packages combine the essentials local businesses need most, a website, local presence, review tools, Smart QR and LinkHub, at a lower price than buying each one separately. Packages also waive the one-time activation fee.'],faq:CAT['Websites'].faq.slice(0,2)};
CAT['Bundles']={kw:'monthly website and local marketing care',intro:['Monthly bundles keep your website, Google profile, reviews and LinkHub working for you every month, with VMS handling updates and recommendations.'],faq:CAT['Local Growth'].faq.slice(0,2)};

function render(service:any,data:any,origin:string){
  const price=servicePriceLabel(service);
  const promos=(data.promotions||[]).filter((p:any)=>promotionApplies(p,service.id));
  const portfolio=(data.portfolio||[]).filter((x:any)=>!x.serviceIds?.length||x.serviceIds.includes(service.id)).slice(0,4);
  const testimonials=(data.testimonials||[]).filter((x:any)=>!x.serviceIds?.length||x.serviceIds.includes(service.id)).slice(0,3);
  const canonical=`${origin}/services/${encodeURIComponent(service.id)}`;
  const cat=CAT[service.category]||CAT['Websites'];
  const title=`${service.name} in ${AREA_SHORT} | Vision Make Studio`;
  const desc=`${String(service.description||'').replace(/\s+$/,'').replace(/\.?$/,'.')} ${price?price+'. ':''}Serving businesses across ${AREA}.`.slice(0,300);
  const related=(data.services||[]).filter((x:any)=>x.id!==service.id&&x.category===service.category).slice(0,6);
  const others=(data.services||[]).filter((x:any)=>x.category!==service.category&&['website-revamp','local-presence-setup','review-growth','smart-qr','linkhub-core','re-essentials','rest-photo-refresh'].includes(x.id)).slice(0,6);
  const org={'@type':'ProfessionalService','@id':`${origin}/#organization`,name:'Vision Make Studio',url:`${origin}/`,email:'info@visionmakestudio.com',logo:`${origin}/assets/vms-logo.png`,image:`${origin}/assets/vms-og.jpg`,
    areaServed:[{'@type':'State',name:'New Jersey'},{'@type':'State',name:'New York'},{'@type':'State',name:'Connecticut'}]};
  const svc:any={'@type':'Service','@id':`${canonical}#service`,name:service.name,serviceType:cat.kw,description:service.description,provider:{'@id':`${origin}/#organization`},
    areaServed:org.areaServed,url:canonical,category:service.category};
  const amount=service.recurringPrice??service.oneTimePrice;
  if(amount!=null)svc.offers={'@type':'Offer',price:Number(amount).toFixed(2),priceCurrency:'USD',url:canonical,availability:'https://schema.org/InStock',
    ...(service.recurringPrice!=null?{priceSpecification:{'@type':'UnitPriceSpecification',price:Number(amount).toFixed(2),priceCurrency:'USD',unitCode:'MON'}}:{})};
  const crumbs={'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:`${origin}/`},{'@type':'ListItem',position:2,name:'Services',item:`${origin}/services.html`},{'@type':'ListItem',position:3,name:service.name,item:canonical}]};
  const faqLd={'@type':'FAQPage',mainEntity:cat.faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))};
  const ld={'@context':'https://schema.org','@graph':[org,svc,crumbs,faqLd]};
  const ico=(n:string)=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const link=(x:any)=>`<a class="sp-rel" href="/services/${encodeURIComponent(x.id)}"><b>${esc(x.name)}</b><span>${esc(servicePriceLabel(x)||x.category)}</span>${ico('arrow')}</a>`;
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#00121C">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="Vision Make Studio"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${origin}/assets/vms-og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${origin}/assets/vms-og.jpg">
<link rel="icon" href="/assets/vms-logo.png"><link rel="apple-touch-icon" href="/assets/vms-logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@600;700&display=swap" rel="stylesheet">
<script>(function(){var t='dark';try{t=localStorage.getItem('vms-theme')||'dark'}catch(e){}document.documentElement.dataset.theme=t==='light'?'light':'dark'})();</script>
<link rel="stylesheet" href="/assets/vms-v2.css?v=20261006-seo"><link rel="stylesheet" href="/assets/vms-v2-site.css?v=20261006-seo">
<script type="application/ld+json">${jsonForScript(ld)}</script>
<style>.sp-hero{padding-top:28px}.sp-crumb{font-size:13.5px;color:var(--muted);display:flex;gap:6px;flex-wrap:wrap}.sp-crumb a{color:inherit}.sp-price{font-family:var(--display);font-size:1.6rem;font-weight:700;margin-top:16px}
.sp-grid{display:grid;gap:18px;margin-top:28px}@media(min-width:900px){.sp-grid{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}}.sp-grid>*{min-width:0}
.sp-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:22px;display:grid;gap:12px;align-content:start}.sp-card h2{font-family:var(--display);font-size:1.2rem;letter-spacing:-.02em}.sp-card p{color:var(--muted)}
.sp-feat{list-style:none;margin:0;padding:0;display:grid;gap:9px}.sp-feat li{display:flex;gap:9px}.sp-feat .ico{width:18px;height:18px;color:var(--ok);flex:none;margin-top:3px}
.sp-rels{display:grid;gap:8px}.sp-rel{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 14px;border-radius:14px;border:1px solid var(--line);text-decoration:none;color:var(--ink)}.sp-rel span{grid-column:1;color:var(--muted);font-size:13.5px}.sp-rel .ico{grid-row:1/3;grid-column:2;align-self:center;width:18px;height:18px}
.sp-areas{color:var(--muted);font-size:14.5px}.ico{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.sp-q{margin:0;color:var(--muted)}</style>
</head><body class="site">
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol><symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol><symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol></svg>
<header class="wnav" id="nav"><a class="brand" href="/" aria-label="Vision Make Studio home"><img class="logo-l" src="/assets/vms-logo-navy.png" alt="Vision Make Studio" width="72" height="32"><img class="logo-d" src="/assets/vms-logo-cream.png" alt="Vision Make Studio" width="72" height="32"></a>
<nav aria-label="Primary"><a href="/#services">Services</a><a href="/#media">Photo &amp; Video</a><a href="/#pricing">Pricing</a><a href="/services.html">All services</a><a href="/portal/">Member Portal</a></nav>
<div class="acts"><a class="btn acc sm" href="/#checkup">Free Checkup</a></div></header>
<main id="top">
<section class="sec sp-hero"><div class="wrap">
 <nav class="sp-crumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/services.html">Services</a><span>›</span><span aria-current="page">${esc(service.name)}</span></nav>
 <span class="eyebrow" style="margin-top:18px;display:inline-flex">${esc(service.category)} · ${AREA_SHORT}</span>
 <h1 class="h-lg" style="margin-top:12px">${esc(service.name)} for businesses in ${AREA_SHORT}</h1>
 <p class="lead" style="margin-top:12px;max-width:60ch">${esc(service.description)}</p>
 ${price?`<div class="sp-price">${esc(price)}</div>`:''}
 <div class="row" style="margin-top:18px"><a class="btn acc" href="/get-started.html?service=${encodeURIComponent(service.id)}">${service.salesMode==='Buy Now'?'Get this service':'Request this service'} ${ico('arrow')}</a><a class="btn gh" href="/#checkup">Free business checkup</a></div>
 ${promos.length?`<div class="note" style="margin-top:16px">${promos.map((p:any)=>`<b>${esc(p.name||'Offer')}</b> · ${esc(promoText(p))}`).join('<br>')}</div>`:''}
 <div class="sp-grid">
  <section class="sp-card"><h2>About our ${esc(cat.kw)}</h2>${cat.intro.map(t=>`<p>${esc(t)}</p>`).join('')}<p class="sp-areas">Serving ${esc(CITIES.join(', '))} and businesses throughout ${AREA}.</p></section>
  <section class="sp-card"><h2>What's included</h2><ul class="sp-feat">${(service.features||[]).map((x:string)=>`<li>${ico('check')}<span>${esc(x)}</span></li>`).join('')||`<li>${ico('check')}<span>VMS confirms the exact scope with you before any work starts.</span></li>`}</ul>
   ${(service.included||[]).length?`<p style="margin-top:6px"><b>Also included:</b> ${esc(service.included.join(', '))}</p>`:''}</section>
 </div>
</div></section>
${portfolio.length?`<section class="sec"><div class="wrap"><h2 class="h-lg">Related work</h2><div class="sp-grid">${portfolio.map((x:any)=>`<article class="sp-card">${x.imageUrl?`<img src="${esc(x.imageUrl)}" alt="${esc(x.title)}" loading="lazy" style="width:100%;border-radius:14px">`:''}<h2>${esc(x.title)}</h2>${x.body?`<p>${esc(x.body)}</p>`:''}</article>`).join('')}</div></div></section>`:''}
${testimonials.length?`<section class="sec"><div class="wrap"><h2 class="h-lg">What clients say</h2><div class="sp-grid">${testimonials.map((x:any)=>`<blockquote class="sp-card"><p>“${esc(x.body||x.title)}”</p><footer>${esc(x.attributionName||'VMS client')}${x.attributionCompany?` · ${esc(x.attributionCompany)}`:''}</footer></blockquote>`).join('')}</div></div></section>`:''}
<section class="sec alt"><div class="wrap"><span class="eyebrow">Questions</span><h2 class="h-lg" style="margin-top:12px">${esc(service.name)}: common questions</h2>
 <div class="faq">${cat.faq.map(([q,a])=>`<details><summary>${esc(q)} ${ico('plus')}</summary><p class="sp-q">${esc(a)}</p></details>`).join('')}</div></div></section>
<section class="sec"><div class="wrap sp-grid">
 ${related.length?`<div class="sp-card"><h2>More ${esc(service.category)} services</h2><div class="sp-rels">${related.map(link).join('')}</div></div>`:''}
 ${others.length?`<div class="sp-card"><h2>Popular with local businesses</h2><div class="sp-rels">${others.map(link).join('')}</div></div>`:''}
</div></section>
<section class="sec"><div class="wrap"><div class="sp-card" style="text-align:center;justify-items:center"><h2>Ready to get started with ${esc(service.name)}?</h2><p>Send a short request. VMS follows up with you personally, usually within one business day.</p><a class="btn acc" href="/get-started.html?service=${encodeURIComponent(service.id)}">Request this service ${ico('arrow')}</a></div></div></section>
</main>
<footer class="wfoot"><div class="wrap fcols">
 <div class="fbrand"><img class="logo-l" src="/assets/vms-logo-navy.png" alt="Vision Make Studio" width="68" height="30"><img class="logo-d" src="/assets/vms-logo-cream.png" alt="Vision Make Studio" width="68" height="30"><p>Websites, local SEO, reviews, smart tools and photo &amp; video for local businesses in ${AREA}.</p></div>
 <div><b>Services</b><a href="/services/website-revamp">Website design</a><a href="/services/local-presence-setup">Local SEO &amp; Google Maps</a><a href="/services/review-growth">Review growth</a><a href="/services/re-essentials">Real estate photography</a><a href="/services/rest-photo-refresh">Restaurant photography</a></div>
 <div><b>Tools</b><a href="/services/smart-qr">Smart QR codes</a><a href="/services/linkhub-core">LinkHub</a><a href="/services/tap-scan-stand">Tap &amp; scan stand</a><a href="/#checkup">Free checkup</a></div>
 <div><b>Contact</b><a href="mailto:info@visionmakestudio.com">info@visionmakestudio.com</a><span>Serving the Tri-State Area</span></div>
</div><div class="wrap fbot"><span>© ${new Date().getFullYear()} Vision Make Studio</span><span><a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></span></div></footer>
<script src="/assets/vms-consent.js" defer></script></body></html>`;
}

export default async(req:Request)=>{
  if(req.method!=='GET')return new Response('Method not allowed',{status:405});
  try{
    const u=new URL(req.url);if(u.pathname==='/services'||u.pathname==='/services/')return Response.redirect(`${u.origin}/services.html`,302);const id=decodeURIComponent(u.pathname.replace(/^\/services\//,'').replace(/\/$/,'')).trim();
    if(!id)return Response.redirect(`${u.origin}/services.html`,302);
    const data=await getPublicSalesData();const service=data.services.find((x:any)=>x.id===id);
    if(!service)return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px"><h1>Service not found</h1><p>This VMS service is unavailable or no longer public.</p><a href="/services.html">View current services</a></body>',{status:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    return new Response(render(service,data,u.origin),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=300'}});
  }catch(e:any){return new Response(`<!doctype html><body style="font-family:system-ui;padding:40px"><h1>VMS service page unavailable</h1><p>${esc(e?.message||'Please try again shortly.')}</p></body>`,{status:Number(e?.status)||500,headers:{'Content-Type':'text/html; charset=utf-8'}})}
};
export const config={path:['/services','/services/:id']};
