import type { Config, Context } from "@netlify/functions";
export default async (req: Request, context: Context) => {
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 try{
  const body:any=await req.json(); if(!body?.businessName||!body?.email)return Response.json({error:"Business name and email are required."},{status:400});
  const record={business_name:String(body.businessName).slice(0,160),contact_name:String(body.contactName||'').slice(0,160),email:String(body.email).slice(0,240),phone:String(body.phone||'').slice(0,80),website:String(body.website||'').slice(0,400),goal:String(body.goal||'').slice(0,240),contact_method:String(body.contactMethod||'Email').slice(0,60),message:String(body.message||'').slice(0,5000),status:'new',source:'public-website'};
  const url=Netlify.env.get('SUPABASE_URL'),serviceKey=Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(url&&serviceKey){await fetch(`${url}/rest/v1/intake_requests`,{method:'POST',headers:{'apikey':serviceKey,'Authorization':`Bearer ${serviceKey}`,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(record)});}
  const resend=Netlify.env.get('RESEND_API_KEY');
  if(resend){await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from:Netlify.env.get('VMS_NOTIFICATION_FROM')||'VMS Website <notifications@visionmakestudio.com>',to:['info@visionmakestudio.com'],subject:`New VMS Business Checkup — ${record.business_name}`,text:`New website request\n\nBusiness: ${record.business_name}\nContact: ${record.contact_name}\nEmail: ${record.email}\nPhone: ${record.phone}\nWebsite: ${record.website}\nGoal: ${record.goal}\nPreferred contact: ${record.contact_method}\n\n${record.message}`})});}
  return Response.json({ok:true});
 }catch(error:any){return Response.json({error:error?.message||'Request could not be submitted.'},{status:500})}
};
export const config: Config={path:'/api/intake'};
