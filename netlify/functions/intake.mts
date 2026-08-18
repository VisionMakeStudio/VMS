import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body: any = await req.json();
    if (!body?.businessName || !body?.email) {
      return Response.json({ error: "Business name and email are required." }, { status: 400 });
    }

    const record = {
      business_name: String(body.businessName).trim().slice(0, 160),
      contact_name: String(body.contactName || "").trim().slice(0, 160),
      email: String(body.email).trim().toLowerCase().slice(0, 240),
      phone: String(body.phone || "").trim().slice(0, 80),
      website: String(body.website || "").trim().slice(0, 400),
      goal: String(body.goal || "").trim().slice(0, 240),
      contact_method: String(body.contactMethod || "Email").trim().slice(0, 60),
      message: String(body.message || "").trim().slice(0, 5000),
      status: "new",
      source: "public-website",
    };

    const url = Netlify.env.get("SUPABASE_URL");
    const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Netlify.env.get("RESEND_API_KEY");

    if ((!url || !serviceKey) && !resendKey) {
      return Response.json(
        { error: "VMS intake is not configured yet. Please email info@visionmakestudio.com." },
        { status: 503 },
      );
    }

    let saved = false;
    if (url && serviceKey) {
      const dbResponse = await fetch(`${url}/rest/v1/intake_requests`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(record),
      });
      if (!dbResponse.ok) {
        const detail = await dbResponse.text();
        console.error("VMS intake database write failed", dbResponse.status, detail);
        return Response.json({ error: "Your request could not be saved. Please try again or email VMS." }, { status: 502 });
      }
      saved = true;
    }

    let notified = false;
    if (resendKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Netlify.env.get("VMS_NOTIFICATION_FROM") || "VMS Website <notifications@visionmakestudio.com>",
          to: ["info@visionmakestudio.com"],
          reply_to: record.email,
          subject: `New VMS Business Checkup — ${record.business_name}`,
          text: `New website request\n\nBusiness: ${record.business_name}\nContact: ${record.contact_name}\nEmail: ${record.email}\nPhone: ${record.phone}\nWebsite: ${record.website}\nGoal: ${record.goal}\nPreferred contact: ${record.contact_method}\n\n${record.message}`,
        }),
      });
      notified = emailResponse.ok;
      if (!emailResponse.ok) console.error("VMS intake notification email failed", emailResponse.status, await emailResponse.text());
    }

    return Response.json({ ok: true, saved, notified });
  } catch (error: any) {
    console.error("VMS intake failed", error);
    return Response.json({ error: error?.message || "Request could not be submitted." }, { status: 500 });
  }
};

export const config: Config = { path: "/api/intake" };
