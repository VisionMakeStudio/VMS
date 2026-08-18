import type { Config, Context } from "@netlify/functions";
export default async (req: Request, context: Context) => {
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const token=Netlify.env.get('VMS_INTERNAL_NOTIFY_TOKEN'); if(!token||req.headers.get('x-vms-notify-token')!==token)return new Response('Unauthorized',{status:401});
 const body:any=await req.json(); const resend=Netlify.env.get('RESEND_API_KEY'); if(!resend)return Response.json({error:'RESEND_API_KEY is not configured.'},{status:503});
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from:Netlify.env.get('VMS_NOTIFICATION_FROM')||'VMS Notifications <notifications@visionmakestudio.com>',to:['info@visionmakestudio.com'],subject:String(body.subject||'VMS Notification'),text:String(body.message||'')})});
 if(!r.ok)return Response.json({error:'Notification email failed.'},{status:502});return Response.json({ok:true});
};
export const config: Config={path:'/api/notify'};
