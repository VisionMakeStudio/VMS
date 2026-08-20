import type { Config, Context } from "@netlify/functions";

function clean(value:any,max=5000){return String(value??"").trim().slice(0,max)}
function serviceIds(value:any){return [...new Set((Array.isArray(value)?value:[]).map(v=>clean(v,120)).filter(Boolean))].slice(0,40)}
function dbHeaders(secret:string,json=false,prefer=""){
  const h:Record<string,string>={apikey:secret};
  if(!secret.startsWith("sb_secret_"))h.Authorization=`Bearer ${secret}`;
  if(json)h["Content-Type"]="application/json";
  if(prefer)h.Prefer=prefer;
  return h;
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body: any = await req.json();
    if (!body?.businessName || !body?.email) return Response.json({ error: "Business name and email are required." }, { status: 400 });

    const record = {
      business_name: clean(body.businessName,160),
      contact_name: clean(body.contactName,160),
      email: clean(body.email,240).toLowerCase(),
      phone: clean(body.phone,80),
      website: clean(body.website,400),
      goal: clean(body.goal,240),
      contact_method: clean(body.contactMethod || "Email",60),
      contact_time: clean(body.contactTime,120) || null,
      service_ids: serviceIds(body.serviceIds),
      message: clean(body.message,5000),
      status: "new",
      source: clean(body.source || "public-website",120),
      lead_score: 50,
      updated_at: new Date().toISOString(),
    };

    const url = Netlify.env.get("SUPABASE_URL");
    const secretKey = Netlify.env.get("SUPABASE_SECRET_KEY") || Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Netlify.env.get("RESEND_API_KEY");
    if ((!url || !secretKey) && !resendKey) return Response.json({ error: "VMS intake is not configured yet. Please email info@visionmakestudio.com." }, { status: 503 });

    let saved = false, leadId: string | null = null;
    if (url && secretKey) {
      const dbResponse = await fetch(`${url}/rest/v1/intake_requests`, {
        method: "POST", headers: dbHeaders(secretKey,true,"return=representation"), body: JSON.stringify(record)
      });
      if (!dbResponse.ok) {
        const detail = await dbResponse.text();
        console.error("VMS intake database write failed", dbResponse.status, detail);
        return Response.json({ error: "Your request could not be saved. Please try again or email VMS." }, { status: 502 });
      }
      const rows:any[] = await dbResponse.json(); leadId=rows?.[0]?.id||null; saved=Boolean(leadId);
      if (leadId) {
        await fetch(`${url}/rest/v1/activity_events`, {
          method:"POST", headers:dbHeaders(secretKey,true,"return=minimal"), body:JSON.stringify({
            lead_id:leadId,event_type:"lead_activity",title:`New lead · ${record.business_name}`,
            detail:`${record.contact_name||record.email} submitted a website inquiry.`,needs_action:true,resolved:false,
            metadata:{source:record.source,action:"new_lead"}
          })
        }).catch(()=>null);
      }
    }

    let notified = false;
    if (resendKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Netlify.env.get("VMS_NOTIFICATION_FROM") || "VMS Website <notifications@visionmakestudio.com>",
          to: ["info@visionmakestudio.com"], reply_to: record.email,
          subject: `New VMS Lead — ${record.business_name}`,
          text: `New website lead\n\nBusiness: ${record.business_name}\nContact: ${record.contact_name}\nEmail: ${record.email}\nPhone: ${record.phone}\nWebsite: ${record.website}\nGoal: ${record.goal}\nPreferred contact: ${record.contact_method}${record.contact_time?` · ${record.contact_time}`:""}\n\n${record.message}`,
        }),
      });
      notified = emailResponse.ok;
      if (!emailResponse.ok) console.error("VMS intake notification email failed", emailResponse.status, await emailResponse.text());
    }

    return Response.json({ ok: true, saved, notified, leadId });
  } catch (error: any) {
    console.error("VMS intake failed", error);
    return Response.json({ error: error?.message || "Request could not be submitted." }, { status: 500 });
  }
};

export const config: Config = { path: "/api/intake" };
