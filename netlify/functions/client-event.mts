import type { Config, Context } from "@netlify/functions";
import { jsonError, requireUser, supabaseEnv } from "./_shared/auth.mts";

const EVENT_META: Record<string, { title: string; action: boolean }> = {
  client_request: { title: "New Client Portal request", action: true },
  followup_scheduled: { title: "Client scheduled VMS follow-up", action: true },
  client_service_checkout_started: { title: "Client started a service order", action: true },
  client_qr_updated: { title: "Client updated Smart QR", action: false },
  client_linkhub_updated: { title: "Client updated LinkHub", action: false },
  subscription_pause_requested: { title: "Subscription pause requested", action: true },
  subscription_cancel_requested: { title: "Subscription cancellation requested", action: true },
  client_files_uploaded: { title: "Client uploaded files", action: true },
  client_requested_files_uploaded: { title: "Requested client files received", action: true },
  client_request_resolved: { title: "Client marked request resolved", action: false },
};

function detailFor(type: string, payload: any) {
  if (type === "client_request") return `${payload?.title || payload?.type || "Request"}: ${payload?.details || ""}`.slice(0, 3000);
  if (type === "followup_scheduled") return `${payload?.date || ""} ${payload?.time || ""} · ${payload?.method || ""} · ${payload?.purpose || ""}`.trim().slice(0, 3000);
  if (type === "client_service_checkout_started") return `${payload?.name || payload?.serviceName || "Service"} · ${payload?.price || ""}`.slice(0, 3000);
  if (type.includes("files_uploaded")) return `${Array.isArray(payload?.files) ? payload.files.map((f: any) => f.name).filter(Boolean).join(", ") : payload?.title || "Files uploaded"}`.slice(0, 3000);
  if (type.startsWith("subscription_")) return `${payload?.plan || "Subscription"}${payload?.reason ? ` · ${payload.reason}` : ""}`.slice(0, 3000);
  if (type === "client_qr_updated") return `${payload?.name || "Smart QR"} · ${payload?.destination || "Destination updated"}`.slice(0, 3000);
  if (type === "client_linkhub_updated") return `${payload?.businessName || payload?.title || "LinkHub"} · ${payload?.plan || ""}`.slice(0, 3000);
  return JSON.stringify(payload || {}).slice(0, 3000);
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const user = await requireUser(req);
    const email = String(user.email || "").trim().toLowerCase();
    if (!email) return Response.json({ error: "Your signed-in account is missing an email address." }, { status: 400 });

    const body: any = await req.json();
    const type = String(body?.type || "client_portal_activity").slice(0, 120);
    const payload = body?.payload || {};
    const meta = EVENT_META[type] || { title: "Client Portal activity", action: false };
    const detail = detailFor(type, payload);
    const { url, serviceKey } = supabaseEnv();

    const clientRes = await fetch(`${url}/rest/v1/clients?owner_email=ilike.${encodeURIComponent(email)}&select=id,business_name&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const clients = clientRes.ok ? await clientRes.json() : [];
    const client = Array.isArray(clients) ? clients[0] : null;

    const eventRes = await fetch(`${url}/rest/v1/activity_events`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        client_id: client?.id || null,
        event_type: type,
        title: meta.title,
        detail,
        needs_action: meta.action,
        resolved: false,
      }),
    });
    if (!eventRes.ok) throw Object.assign(new Error("Client activity could not be saved."), { status: 502 });

    const resendKey = Netlify.env.get("RESEND_API_KEY");
    if (resendKey && (meta.action || type === "client_service_checkout_started")) {
      const business = client?.business_name || email;
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Netlify.env.get("VMS_NOTIFICATION_FROM") || "VMS Portal <notifications@visionmakestudio.com>",
          to: ["info@visionmakestudio.com"],
          subject: `${meta.title} — ${business}`,
          text: `Client: ${business}\nEmail: ${email}\n\n${detail}`,
        }),
      });
      if (!emailRes.ok) console.error("VMS client-event email failed", emailRes.status, await emailRes.text());
    }

    return Response.json({ ok: true });
  } catch (error: any) {
    console.error("VMS client event failed", error);
    return jsonError(error);
  }
};

export const config: Config = { path: "/api/client-event" };
