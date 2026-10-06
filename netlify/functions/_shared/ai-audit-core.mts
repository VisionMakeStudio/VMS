import {claudeMessage,extractJson,hasClaudeKey} from "./claude.mts";

type Row = Record<string, any>;
type AuditCategory = "website" | "google" | "reviews" | "systems";
type AuditItem = { id:string; title:string; max:number; options:Array<[string,number|null]> };
type WebSnapshot = {
  requestedUrl:string;
  finalUrl:string;
  status:number;
  responseMs:number;
  bytes:number;
  contentType:string;
  headers:Record<string,string>;
  title:string;
  description:string;
  h1Count:number;
  hasViewport:boolean;
  hasCanonical:boolean;
  hasPhoneLink:boolean;
  hasEmailLink:boolean;
  hasForm:boolean;
  hasBookingSignal:boolean;
  hasReviewSignal:boolean;
  hasLocalBusinessSchema:boolean;
  imageCount:number;
  imagesMissingAlt:number;
  internalLinks:string[];
  externalLinks:string[];
  keyPages:Array<{url:string;status:number;title:string;responseMs:number}>;
  linkChecks:Array<{url:string;status:number;ok:boolean}>;
  warnings:string[];
};

const clean=(v:any,n=2000)=>String(v??"").trim().slice(0,n);
const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n));
const CATS:AuditCategory[]=["website","google","reviews","systems"];

const RUBRIC:Record<AuditCategory,AuditItem[]>={
  website:[
    {id:"mobile",title:"Mobile experience",max:15,options:[["Broken",0],["Poor",5],["Usable",10],["Excellent",15],["N/A",null]]},
    {id:"speed",title:"Speed & loading",max:10,options:[["Very slow",0],["Slow",4],["Acceptable",7],["Fast",10],["N/A",null]]},
    {id:"links",title:"Links / buttons work",max:15,options:[["Major problems",0],["Several issues",5],["Minor issues",10],["Everything works",15],["N/A",null]]},
    {id:"navigation",title:"Navigation & finding info",max:15,options:[["Confusing",0],["Difficult",5],["Mostly clear",10],["Very clear",15],["N/A",null]]},
    {id:"contact",title:"Contact / booking flow",max:15,options:[["Missing / broken",0],["Difficult",5],["Works",10],["Excellent",15],["N/A",null]]},
    {id:"design",title:"Visual design / professionalism",max:15,options:[["Poor",0],["Dated",5],["Decent",10],["Modern / professional",15],["N/A",null]]},
    {id:"trust",title:"Trust & business legitimacy",max:10,options:[["Weak",0],["Basic",4],["Good",7],["Strong",10],["N/A",null]]},
    {id:"technical",title:"Technical health",max:5,options:[["Major issues",0],["Minor issues",3],["Healthy",5],["N/A",null]]},
  ],
  google:[
    {id:"profile",title:"Primary local profile setup",max:15,options:[["Missing / poor",0],["Basic",5],["Good",10],["Strong",15],["N/A",null]]},
    {id:"accuracy",title:"Name, address, phone & hours accurate",max:15,options:[["Several errors",0],["Some errors",5],["Mostly correct",10],["Fully correct",15],["N/A",null]]},
    {id:"categories",title:"Business categories & services",max:10,options:[["Wrong / missing",0],["Basic",4],["Good",7],["Strong",10],["N/A",null]]},
    {id:"photos",title:"Photos & visual presentation",max:15,options:[["Poor / none",0],["Weak",5],["Good",10],["Strong / current",15],["N/A",null]]},
    {id:"actions",title:"Website, call, directions & booking actions",max:15,options:[["Broken / missing",0],["Some issues",5],["Mostly work",10],["All work",15],["N/A",null]]},
    {id:"activity",title:"Profile activity / freshness",max:10,options:[["Stale",0],["Weak",4],["Active",7],["Very active",10],["N/A",null]]},
    {id:"competition",title:"Presence vs nearby competitors",max:10,options:[["Far behind",0],["Below average",4],["Average",7],["Above average",10],["N/A",null]]},
    {id:"consistency",title:"Listings match website/business info",max:10,options:[["Major mismatch",0],["Some mismatch",4],["Mostly consistent",7],["Fully consistent",10],["N/A",null]]},
  ],
  reviews:[
    {id:"volume",title:"Total review volume",max:20,options:[["0 reviews",0],["1–9",4],["10–24",8],["25–49",12],["50–99",16],["100+",20],["N/A",null]]},
    {id:"rating",title:"Average rating",max:20,options:[["Below 3.5",0],["3.5–3.9",5],["4.0–4.2",10],["4.3–4.5",15],["4.6+",20],["N/A",null]]},
    {id:"recency",title:"How recent are the reviews?",max:15,options:[["12+ months",0],["Within 12 months",4],["Within 6 months",7],["Within 90 days",10],["Within 30 days",15],["N/A",null]]},
    {id:"consistency",title:"Are new reviews coming in consistently?",max:15,options:[["Rarely",0],["Sometimes",5],["Fairly often",10],["Consistently",15],["N/A",null]]},
    {id:"responses",title:"Does the business respond to reviews?",max:10,options:[["Never",0],["Sometimes",4],["Often",7],["Almost always",10],["N/A",null]]},
    {id:"negative",title:"How are negative reviews handled?",max:10,options:[["Ignored / poor",0],["Mixed",5],["Professional",10],["N/A",null]]},
    {id:"easy",title:"Is it easy for customers to leave a review?",max:5,options:[["No",0],["Somewhat",3],["Yes",5],["N/A",null]]},
    {id:"system",title:"Review QR / link / request system",max:5,options:[["None",0],["Basic",3],["Strong",5],["N/A",null]]},
  ],
  systems:[
    {id:"contact",title:"How easy is it to contact the business?",max:15,options:[["Very difficult",0],["Difficult",5],["Easy",10],["Very easy",15],["N/A",null]]},
    {id:"booking",title:"Booking / ordering experience",max:20,options:[["Broken / missing",0],["Difficult",7],["Works",14],["Excellent",20],["N/A",null]]},
    {id:"followup",title:"Customer confirmations & follow-up",max:15,options:[["None",0],["Basic",5],["Good",10],["Automated / strong",15],["N/A",null]]},
    {id:"reviewsystem",title:"Review request / QR system",max:10,options:[["None",0],["Basic",5],["Strong",10],["N/A",null]]},
    {id:"organization",title:"Customer information / scheduling organization",max:10,options:[["Disorganized",0],["Basic",5],["Strong",10],["N/A",null]]},
    {id:"automation",title:"Helpful automation",max:10,options:[["None",0],["Some",5],["Strong",10],["N/A",null]]},
    {id:"integration",title:"Tools work well together",max:10,options:[["Disconnected",0],["Somewhat connected",5],["Well connected",10],["N/A",null]]},
    {id:"journey",title:"Overall customer journey",max:10,options:[["Confusing",0],["Okay",5],["Good",7],["Very smooth",10],["N/A",null]]},
  ],
};

function isPrivateIPv4(ip:string){
  const p=ip.split(".").map(Number); if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true;
  const [a,b]=p;
  return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19));
}
function isPrivateIPv6(ip:string){
  const x=ip.toLowerCase();
  return x==="::"||x==="::1"||x.startsWith("fc")||x.startsWith("fd")||x.startsWith("fe8")||x.startsWith("fe9")||x.startsWith("fea")||x.startsWith("feb")||x.startsWith("::ffff:127.")||x.startsWith("::ffff:10.")||x.startsWith("::ffff:192.168.");
}
function ipKind(host:string){
  const raw=host.replace(/^\[|\]$/g,"");
  if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw))return 4;
  if(raw.includes(":"))return 6;
  return 0;
}
async function resolvePublicDns(host:string){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),3500);
  try{
    const q=encodeURIComponent(host);
    const [a,aaaa]=await Promise.all([
      fetch(`https://dns.google/resolve?name=${q}&type=A`,{signal:ctrl.signal,headers:{Accept:"application/dns-json"}}).then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(`https://dns.google/resolve?name=${q}&type=AAAA`,{signal:ctrl.signal,headers:{Accept:"application/dns-json"}}).then(r=>r.ok?r.json():null).catch(()=>null),
    ]);
    const rows=[...(Array.isArray(a?.Answer)?a.Answer:[]),...(Array.isArray(aaaa?.Answer)?aaaa.Answer:[])];
    return rows.filter((x:any)=>x?.type===1||x?.type===28).map((x:any)=>clean(x?.data,120)).filter(Boolean);
  }finally{clearTimeout(timer)}
}
async function assertPublicHost(u:URL){
  const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))throw Object.assign(new Error("That website address cannot be audited."),{status:400});
  const kind=ipKind(host);
  if(kind===4&&isPrivateIPv4(host))throw Object.assign(new Error("That website address cannot be audited."),{status:400});
  if(kind===6&&isPrivateIPv6(host))throw Object.assign(new Error("That website address cannot be audited."),{status:400});
  if(!kind){
    const addresses=await resolvePublicDns(host);
    if(!addresses.length)throw Object.assign(new Error("The website hostname could not be resolved."),{status:400});
    for(const address of addresses){const family=ipKind(address);if((family===4&&isPrivateIPv4(address))||(family===6&&isPrivateIPv6(address)))throw Object.assign(new Error("That website address cannot be audited."),{status:400});}
  }
}
function normalizeWebsite(v:any){
  let s=clean(v,700); if(!s)return "";
  if(!/^https?:\/\//i.test(s))s=`https://${s}`;
  const u=new URL(s); if(!/^https?:$/.test(u.protocol))throw Object.assign(new Error("Website must use http or https."),{status:400});
  u.hash=""; return u.toString();
}
async function readLimited(res:Response,maxBytes=1_500_000){
  if(!res.body)return "";
  const reader=res.body.getReader(); const chunks:Uint8Array[]=[]; let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;if(!value)continue;total+=value.byteLength;if(total>maxBytes){try{await reader.cancel()}catch{};break}chunks.push(value)}
  const out=new Uint8Array(chunks.reduce((n,c)=>n+c.byteLength,0));let off=0;for(const c of chunks){out.set(c,off);off+=c.byteLength}return new TextDecoder().decode(out);
}
async function fetchHtml(start:string,maxRedirects=4){
  let current=new URL(start); let redirects=0; const started=Date.now();
  while(true){
    await assertPublicHost(current);
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),8000);
    let r:Response;
    try{r=await fetch(current,{redirect:"manual",signal:ctrl.signal,headers:{"User-Agent":"VisionMakeStudio-Audit/1.0 (+https://visionmakestudio.com)"}})}finally{clearTimeout(timer)}
    if([301,302,303,307,308].includes(r.status)){
      const loc=r.headers.get("location"); if(!loc||redirects++>=maxRedirects)throw new Error("Too many website redirects.");
      current=new URL(loc,current); if(!/^https?:$/.test(current.protocol))throw new Error("Unsupported website redirect."); continue;
    }
    const contentType=r.headers.get("content-type")||"";
    const html=/text\/html|application\/xhtml\+xml/i.test(contentType)?await readLimited(r):"";
    return {url:current.toString(),status:r.status,responseMs:Date.now()-started,contentType,html,headers:r.headers};
  }
}
function stripTags(v:string){return v.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function attr(tag:string,name:string){const m=tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`,`i`));return m?.[1]||""}
function firstMatch(html:string,re:RegExp){return clean(html.match(re)?.[1]||"",500)}
function absoluteHref(raw:string,base:string){try{const u=new URL(raw,base);if(!/^https?:$/.test(u.protocol))return "";u.hash="";return u.toString()}catch{return ""}}
function unique<T>(a:T[]){return [...new Set(a)]}
function analyzeHtml(html:string,base:string){
  const title=stripTags(firstMatch(html,/<title[^>]*>([\s\S]*?)<\/title>/i));
  const description=firstMatch(html,/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)||firstMatch(html,/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const anchors=[...html.matchAll(/<a\b[^>]*>/gi)].map(m=>m[0]);
  const hrefs=anchors.map(t=>attr(t,"href")).filter(Boolean);
  const abs=hrefs.map(h=>absoluteHref(h,base)).filter(Boolean);
  const baseOrigin=new URL(base).origin;
  const internal=unique(abs.filter(h=>{try{return new URL(h).origin===baseOrigin}catch{return false}})).slice(0,80);
  const external=unique(abs.filter(h=>{try{return new URL(h).origin!==baseOrigin}catch{return false}})).slice(0,50);
  const imgs=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
  const plain=stripTags(html).toLowerCase();
  return {
    title,description,
    h1Count:(html.match(/<h1\b/gi)||[]).length,
    hasViewport:/<meta[^>]+name=["']viewport["']/i.test(html),
    hasCanonical:/<link[^>]+rel=["'][^"']*canonical[^"']*["']/i.test(html),
    hasPhoneLink:/href=["']tel:/i.test(html),
    hasEmailLink:/href=["']mailto:/i.test(html),
    hasForm:/<form\b/i.test(html),
    hasBookingSignal:/\b(book|booking|schedule|appointment|reserve|reservation|order online|request quote|request service)\b/i.test(plain)||hrefs.some(h=>/book|schedul|appoint|reserv|order|quote/i.test(h)),
    hasReviewSignal:/\b(review us|leave a review|google review|reviews)\b/i.test(plain)||hrefs.some(h=>/g\.page\/r|search\.google\.com\/local\/writereview|review/i.test(h)),
    hasLocalBusinessSchema:/["']@type["']\s*:\s*["'][^"']*(LocalBusiness|Organization|ProfessionalService|Restaurant|Store|MedicalBusiness|RealEstateAgent)/i.test(html),
    imageCount:imgs.length,
    imagesMissingAlt:imgs.filter(t=>!attr(t,"alt").trim()).length,
    internalLinks:internal,externalLinks:external,
  };
}
function keyPageCandidates(links:string[],base:string){
  const origin=new URL(base).origin;
  const scored=links.map(url=>{const p=new URL(url).pathname.toLowerCase();let score=0;if(/contact/.test(p))score+=10;if(/book|schedul|appoint|reserv|order/.test(p))score+=9;if(/service/.test(p))score+=8;if(/about/.test(p))score+=7;if(/location|hours/.test(p))score+=5;return {url,score}}).filter(x=>x.score>0&&new URL(x.url).origin===origin).sort((a,b)=>b.score-a.score);
  return unique(scored.map(x=>x.url)).slice(0,4);
}
async function checkUrl(url:string){
  try{await assertPublicHost(new URL(url));const c=new AbortController();const t=setTimeout(()=>c.abort(),5000);try{const r=await fetch(url,{method:"HEAD",redirect:"manual",signal:c.signal,headers:{"User-Agent":"VisionMakeStudio-Audit/1.0"}});return {url,status:r.status,ok:r.status>0&&r.status<400}}finally{clearTimeout(t)}}catch{return {url,status:0,ok:false}}
}
async function buildWebsiteSnapshot(url:string):Promise<WebSnapshot>{
  const home=await fetchHtml(url); if(!home.html)throw Object.assign(new Error(`Website did not return an HTML page (${home.status}).`),{status:422});
  const sig=analyzeHtml(home.html,home.url); const keyUrls=keyPageCandidates(sig.internalLinks,home.url);
  const keyPages=(await Promise.all(keyUrls.map(async u=>{try{const p=await fetchHtml(u,2);const a=analyzeHtml(p.html,p.url);return {url:p.url,status:p.status,title:a.title,responseMs:p.responseMs}}catch{return {url:u,status:0,title:"",responseMs:0}}}))).slice(0,4);
  const sampleLinks=unique([...keyUrls,...sig.internalLinks]).slice(0,8); const linkChecks=await Promise.all(sampleLinks.map(checkUrl));
  const headers:Record<string,string>={};for(const k of ["strict-transport-security","content-security-policy","x-frame-options","x-content-type-options","server"]){const v=home.headers.get(k);if(v)headers[k]=v.slice(0,500)}
  const warnings:string[]=[];if(home.status>=400)warnings.push(`Homepage returned HTTP ${home.status}.`);if(!sig.hasViewport)warnings.push("No viewport meta tag was detected.");if(new URL(home.url).protocol!=="https:")warnings.push("Website is not using HTTPS.");
  return {requestedUrl:url,finalUrl:home.url,status:home.status,responseMs:home.responseMs,bytes:new TextEncoder().encode(home.html).byteLength,contentType:home.contentType,headers,title:sig.title,description:sig.description,h1Count:sig.h1Count,hasViewport:sig.hasViewport,hasCanonical:sig.hasCanonical,hasPhoneLink:sig.hasPhoneLink,hasEmailLink:sig.hasEmailLink,hasForm:sig.hasForm,hasBookingSignal:sig.hasBookingSignal,hasReviewSignal:sig.hasReviewSignal,hasLocalBusinessSchema:sig.hasLocalBusinessSchema,imageCount:sig.imageCount,imagesMissingAlt:sig.imagesMissingAlt,internalLinks:sig.internalLinks,externalLinks:sig.externalLinks,keyPages,linkChecks,warnings};
}

function rubricForPrompt(){
  const out:Row={};for(const c of CATS)out[c]=RUBRIC[c].map(x=>({id:x.id,title:x.title,max:x.max,allowed:x.options.map(o=>({label:o[0],points:o[1]}))}));return out;
}
const ITEM_SCHEMA={type:"object",additionalProperties:false,required:["id","points","label","confidence","evidence","source_urls"],properties:{id:{type:"string"},points:{anyOf:[{type:"integer"},{type:"null"}]},label:{type:"string"},confidence:{type:"string",enum:["low","medium","high"]},evidence:{type:"string"},source_urls:{type:"array",items:{type:"string"},maxItems:5}}};
const CAT_SCHEMA={type:"object",additionalProperties:false,required:["reason","assessment_note","items"],properties:{reason:{type:"string"},assessment_note:{type:"string"},items:{type:"array",items:ITEM_SCHEMA,maxItems:12}}};
const RESPONSE_SCHEMA={type:"object",additionalProperties:false,required:["summary","categories","recommendations","priority_findings","warnings","sources"],properties:{summary:{type:"string"},categories:{type:"object",additionalProperties:false,required:CATS,properties:{website:CAT_SCHEMA,google:CAT_SCHEMA,reviews:CAT_SCHEMA,systems:CAT_SCHEMA}},recommendations:{type:"array",maxItems:8,items:{type:"object",additionalProperties:false,required:["priority","category","title","why","next_step"],properties:{priority:{type:"string",enum:["high","medium","low"]},category:{type:"string",enum:CATS},title:{type:"string"},why:{type:"string"},next_step:{type:"string"}}}},priority_findings:{type:"array",maxItems:6,items:{type:"object",additionalProperties:false,required:["severity","category","title","finding","why_it_matters","source_urls"],properties:{severity:{type:"string",enum:["critical","high","medium"]},category:{type:"string",enum:CATS},title:{type:"string"},finding:{type:"string"},why_it_matters:{type:"string"},source_urls:{type:"array",items:{type:"string"},maxItems:5}}}},warnings:{type:"array",items:{type:"string"},maxItems:8},sources:{type:"array",maxItems:16,items:{type:"object",additionalProperties:false,required:["url","title","supports"],properties:{url:{type:"string"},title:{type:"string"},supports:{type:"string"}}}}}};

function outputText(r:Row){
  for(const item of Array.isArray(r.output)?r.output:[]){if(item?.type!=="message")continue;for(const c of Array.isArray(item.content)?item.content:[]){if(c?.type==="output_text"&&typeof c.text==="string")return c.text}}
  return "";
}
function annotationSources(r:Row){
  const out:Array<{url:string;title:string;supports:string}>=[];
  for(const item of Array.isArray(r.output)?r.output:[]){for(const c of Array.isArray(item?.content)?item.content:[]){for(const a of Array.isArray(c?.annotations)?c.annotations:[]){const url=clean(a?.url||a?.url_citation?.url,1000);if(/^https?:\/\//i.test(url))out.push({url,title:clean(a?.title||a?.url_citation?.title,200)||new URL(url).hostname,supports:"Public web evidence used by Audit AI"})}}}
  return out;
}
const AUDIT_INSTRUCTIONS=`You are the internal audit engine for Vision Make Studio (VMS). Produce a rigorous business presence audit using the exact VMS rubric supplied by the application.\n\nRules:\n1. Use the supplied live website snapshot as factual evidence for the website category. Do not claim Lighthouse/Core Web Vitals measurements; the snapshot is a lightweight live technical check.\n2. Use web search to verify the public business footprint, especially Google/local presence, reviews, reputation, and visible competitors. Prefer official business pages, the business website, Google-visible results, major review platforms, and credible directory/business sources.\n3. Never invent a Google profile, rating, review count, review recency, hours, address, competitor comparison, booking system, automation, CRM, follow-up system, or internal workflow. If evidence is insufficient, use points=null and label="N/A" and explain what needs manual review.\n4. For internal YOU-only systems (follow-up, organization, automation, integration, review request process), only score them when the supplied reviewer notes explicitly establish the fact. Otherwise return N/A.\n5. Every numeric points value must exactly match one allowed points value for that rubric item. No arbitrary numbers.\n6. Keep reasons and Assessment Notes concise, professional, client-safe, and natural. Do not say "the AI thinks" or "AI-generated". Use wording such as "The assessment found" or "Current evidence shows".\n7. Recommendations must be specific and actionable.\n8. Do not lower a score merely because evidence is unavailable; use N/A instead.\n9. Use no more web searching than necessary.\n10. Treat the "google" category key as VMS Local Presence: Google Business Profile is one source, but also use Yelp, Apple Maps, Bing, major directories, listing consistency, and other relevant public local-search evidence when available.\n11. Create priority_findings only for issues that deserve immediate attention beyond an ordinary score deduction, such as a broken or hijacked old domain, customer misdirection, serious listing/contact/hour conflicts, broken booking/contact paths, security/trust problems, or reputation risks. Do not manufacture priority findings just to fill the array.\n12. Output only the structured response schema.`;

async function claudeAudit(context:Row){
  const system=AUDIT_INSTRUCTIONS+"\n\nOUTPUT FORMAT: Reply with exactly one JSON object and nothing else (no markdown fences, no commentary). It must validate against this JSON Schema:\n"+JSON.stringify(RESPONSE_SCHEMA);
  const out=await claudeMessage({system,user:JSON.stringify(context),maxTokens:6500,timeoutMs:180000,webSearchUses:4});
  if(!out.text)throw Object.assign(new Error("Audit AI returned no structured result."),{status:502});
  const parsed=extractJson(out.text,"categories");
  if(!parsed)throw Object.assign(new Error("Audit AI returned an invalid structured result."),{status:502});
  return {parsed,model:out.model,responseId:out.responseId,usage:out.usage,annotationSources:out.sources};
}
async function openAiAudit(context:Row){
  const netlifyEnv=(globalThis as any)?.Netlify?.env;
  const processEnv=((globalThis as any)?.process?.env||{}) as Record<string,string|undefined>;
  const getEnv=(name:string)=>clean(netlifyEnv?.get?.(name)??processEnv[name],500);
  const key=getEnv("OPENAI_API_KEY");if(!key)throw Object.assign(new Error("Audit AI is not connected yet. Add ANTHROPIC_API_KEY in Netlify first."),{status:503,code:"openai_not_configured"});
  /* Codex workspace labels are not public OpenAI API model IDs. Keep the audit
     on a supported, economical Responses model even when an old site setting
     still contains one of those labels. */
  const requestedModel=clean(getEnv("OPENAI_AUDIT_MODEL"),120);
  const supportedModels=new Set(["gpt-4o-mini","gpt-4.1-mini","gpt-4.1","gpt-5-mini","gpt-5"]);
  const model=supportedModels.has(requestedModel)?requestedModel:"gpt-4o-mini";
  const instructions=AUDIT_INSTRUCTIONS;
  const payload={model,store:false,instructions,input:JSON.stringify(context),tools:[{type:"web_search"}],tool_choice:"auto",max_output_tokens:6500,text:{verbosity:"medium",format:{type:"json_schema",name:"vms_business_audit",description:"VMS business audit with exact rubric selections and evidence.",strict:true,schema:RESPONSE_SCHEMA}}};
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),180000);
  try{
    const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:ctrl.signal,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const raw=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(new Error(clean(raw?.error?.message,500)||`OpenAI audit request failed (${res.status}).`),{status:502,code:"openai_request_failed"});
    const text=outputText(raw);if(!text)throw Object.assign(new Error("Audit AI returned no structured result."),{status:502});
    let parsed:Row;try{parsed=JSON.parse(text)}catch{throw Object.assign(new Error("Audit AI returned an invalid structured result."),{status:502})}
    return {parsed,model,responseId:clean(raw.id,160),usage:raw.usage||{},annotationSources:annotationSources(raw)};
  }finally{clearTimeout(timer)}
}

function normalizeItem(cat:AuditCategory,item:Row){
  const def=RUBRIC[cat].find(x=>x.id===clean(item?.id,80));if(!def)return null;
  const rawLabel=clean(item?.label,120);const rawPoints=item?.points===null?null:Number(item?.points);
  let chosen=def.options.find(o=>o[0].toLowerCase()===rawLabel.toLowerCase());if(!chosen&&Number.isFinite(rawPoints as number))chosen=def.options.find(o=>o[1]===rawPoints);if(!chosen&&rawPoints===null)chosen=def.options.find(o=>o[1]===null);if(!chosen)return {id:def.id,title:def.title,max:def.max,points:null,label:"N/A",confidence:"low",evidence:"The available evidence was not strong enough to select a rubric option.",source_urls:[]};
  return {id:def.id,title:def.title,max:def.max,points:chosen[1],label:chosen[0],confidence:["low","medium","high"].includes(item?.confidence)?item.confidence:"low",evidence:clean(item?.evidence,900),source_urls:(Array.isArray(item?.source_urls)?item.source_urls:[]).map((u:any)=>clean(u,1000)).filter((u:string)=>/^https?:\/\//i.test(u)).slice(0,5)};
}
function fixedItem(cat:AuditCategory,id:string,label:string,evidence:string,url:string){
  const def=RUBRIC[cat].find(x=>x.id===id)!;const opt=def.options.find(o=>o[0]===label)!;return {id,title:def.title,max:def.max,points:opt[1],label:opt[0],confidence:"high",evidence,source_urls:url?[url]:[]};
}
function deterministicWebsite(s:WebSnapshot){
  const out:Row={};
  const kb=Math.round(s.bytes/1024);let speed="Very slow";if(s.responseMs<900&&s.bytes<900_000)speed="Fast";else if(s.responseMs<1800&&s.bytes<1_500_000)speed="Acceptable";else if(s.responseMs<3500)speed="Slow";
  out.speed=fixedItem("website","speed",speed,`The live homepage responded in about ${s.responseMs} ms and the inspected HTML payload was about ${kb} KB. This is a lightweight response/page-weight signal, not a Core Web Vitals test.`,s.finalUrl);
  if(s.linkChecks.length){const broken=s.linkChecks.filter(x=>!x.ok).length;let label="Everything works";if(broken>=Math.max(3,Math.ceil(s.linkChecks.length*.4)))label="Major problems";else if(broken>=2)label="Several issues";else if(broken===1)label="Minor issues";out.links=fixedItem("website","links",label,`${s.linkChecks.length} representative internal links were checked live; ${broken} did not return a normal successful/redirect status.`,s.finalUrl)}
  const https=new URL(s.finalUrl).protocol==="https:";const healthy=s.status<400&&https&&s.hasViewport;const major=s.status>=400||!https;out.technical=fixedItem("website","technical",major?"Major issues":healthy?"Healthy":"Minor issues",`${https?"HTTPS is active":"HTTPS is not active"}; homepage status ${s.status}; ${s.hasViewport?"mobile viewport metadata was detected":"mobile viewport metadata was not detected"}.`,s.finalUrl);
  return out;
}
function scoreItems(items:Row[]){let earned=0,max=0;for(const i of items){if(typeof i?.points!=="number")continue;earned+=i.points;max+=Number(i.max)||0}return max?{score:Math.round(earned/max*100),earned,max}:{score:null,earned:0,max:0}}
function safeUrl(v:any){const s=clean(v,1000);if(!/^https?:\/\//i.test(s))return "";try{return new URL(s).toString()}catch{return ""}}
function finalize(model:Row,website:WebSnapshot|null,meta:Row){
  const categories:Row={};for(const cat of CATS){const src=Array.isArray(model?.categories?.[cat]?.items)?model.categories[cat].items:[];const map=new Map<string,Row>();for(const raw of src){const n=normalizeItem(cat,raw);if(n)map.set(n.id,n)}if(cat==="website"&&website){for(const [id,v] of Object.entries(deterministicWebsite(website)))map.set(id,v as Row)}const ordered=RUBRIC[cat].map(def=>map.get(def.id)||{id:def.id,title:def.title,max:def.max,points:null,label:"N/A",confidence:"low",evidence:"This item needs manual review because the available public evidence was not sufficient.",source_urls:[]});const calc=scoreItems(ordered);categories[cat]={score:calc.score,assessed_points:calc.earned,assessed_max:calc.max,reason:clean(model?.categories?.[cat]?.reason,900)||"Complete the remaining manual checks to finalize this section.",assessment_note:clean(model?.categories?.[cat]?.assessment_note,1400)||"The available evidence was reviewed against the VMS rubric.",items:ordered}}
  const numeric=CATS.map(c=>categories[c].score).filter((x:any)=>typeof x==="number");const overall=numeric.length?Math.round(numeric.reduce((a:number,b:number)=>a+b,0)/numeric.length):null;
  const sourceMap=new Map<string,Row>();const all=[...(Array.isArray(model?.sources)?model.sources:[]),...(meta.annotationSources||[])];if(website)all.unshift({url:website.finalUrl,title:website.title||new URL(website.finalUrl).hostname,supports:"Live website inspection"});for(const s of all){const url=safeUrl(s?.url);if(!url||sourceMap.has(url))continue;sourceMap.set(url,{url,title:clean(s?.title,220)||new URL(url).hostname,supports:clean(s?.supports,500)||"Audit evidence"})}
  return {version:"vms-audit-ai-live-2",ran_at:new Date().toISOString(),model:meta.model,response_id:meta.responseId||null,overall_score:overall,summary:clean(model?.summary,1200),categories,recommendations:(Array.isArray(model?.recommendations)?model.recommendations:[]).slice(0,8).map((r:any)=>({priority:["high","medium","low"].includes(r?.priority)?r.priority:"medium",category:CATS.includes(r?.category)?r.category:"website",title:clean(r?.title,240),why:clean(r?.why,600),next_step:clean(r?.next_step,600)})),priority_findings:(Array.isArray(model?.priority_findings)?model.priority_findings:[]).slice(0,6).map((r:any)=>({severity:["critical","high","medium"].includes(r?.severity)?r.severity:"high",category:CATS.includes(r?.category)?r.category:"website",title:clean(r?.title,240),finding:clean(r?.finding,900),why_it_matters:clean(r?.why_it_matters,700),source_urls:(Array.isArray(r?.source_urls)?r.source_urls:[]).map((u:any)=>safeUrl(u)).filter(Boolean).slice(0,5)})),warnings:unique([...(website?.warnings||[]),...(Array.isArray(model?.warnings)?model.warnings.map((x:any)=>clean(x,500)):[])]).filter(Boolean).slice(0,10),sources:[...sourceMap.values()].slice(0,18),website_snapshot:website?{final_url:website.finalUrl,status:website.status,response_ms:website.responseMs,html_kb:Math.round(website.bytes/1024),title:website.title,key_pages:website.keyPages,link_checks:website.linkChecks,signals:{viewport:website.hasViewport,canonical:website.hasCanonical,phone:website.hasPhoneLink,email:website.hasEmailLink,form:website.hasForm,booking:website.hasBookingSignal,review:website.hasReviewSignal,local_business_schema:website.hasLocalBusinessSchema,images:website.imageCount,images_missing_alt:website.imagesMissingAlt}}:null,usage:{input_tokens:Number(meta.usage?.input_tokens)||null,output_tokens:Number(meta.usage?.output_tokens)||null,total_tokens:Number(meta.usage?.total_tokens)||null}};
}


/* Shared by /api/ai-audit (starts a job) and the ai-audit-background function (does the slow work).
   The AI step with web search can take 30–90 seconds, longer than a normal Netlify function may run. */
export async function runAiAudit(body:Row){
  let stage="validate_request";
  try{
    // Phase 13 compatibility: the approved Audit page has existed through several
    // production layers. Accept both the current API field names and the legacy
    // camelCase names so an older browser/script cannot turn a valid filled form
    // into an HTTP 400 simply because it used the previous payload contract.
    const businessName=clean(body.business_name??body.businessName??body.name,180);
    if(!businessName)throw Object.assign(new Error("Business name is required before running the audit."),{status:400,code:"business_name_required"});
    const rawWebsite=body.website_url??body.websiteUrl??body.website??"";
    const websiteUrl=normalizeWebsite(rawWebsite);
    const googleUrl=clean(body.google_url??body.googleUrl??body.googleBusinessUrl??body.google??"",900);
    const reviewerNotes=clean(body.internal_notes??body.internalNotes??body.overviewNotes??body.notes??"",2200);
    const reviewPlatforms=Array.isArray(body.review_platforms)?body.review_platforms:Array.isArray(body.reviewPlatforms)?body.reviewPlatforms:[];
    let website:WebSnapshot|null=null;let websiteError="";
    stage="website_scan";
    if(websiteUrl){try{website=await buildWebsiteSnapshot(websiteUrl)}catch(e:any){websiteError=clean(e?.message,500)}}
    const context={business:{name:businessName,industry:clean(body.industry??body.businessIndustry,180),website_url:websiteUrl,google_url:googleUrl,reviewer_notes:reviewerNotes,review_platforms:reviewPlatforms.slice(0,8)},live_website_snapshot:website,website_check_error:websiteError||null,vms_rubric:rubricForPrompt(),task:"Score only what can be supported by evidence. Use web search for public local/review evidence and the live snapshot for website evidence. Return N/A for internal facts not established by reviewer notes."};
    stage="ai";
    const ai=hasClaudeKey()?await claudeAudit(context):await openAiAudit(context);
    stage="finalize";
    const result=finalize(ai.parsed,website,ai);if(websiteError)result.warnings.unshift(`Website live check: ${websiteError}`);
    return result;
  }catch(error:any){if(error&&!error.stage)error.stage=stage;throw error}
}
export function auditBusinessName(body:Row){return clean(body?.business_name??body?.businessName??body?.name,180)}
