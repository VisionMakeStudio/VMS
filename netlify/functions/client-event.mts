import type { Config, Context } from "@netlify/functions";

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

function env(name: string) {
  return Netlify.env.get(name) || "";
}

function supabasePublicEnv() {
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !publishableKey) {
    throw Object.assign(new Error("Client Portal server configuration is incomplete."), { status: 503 });
  }
  return { url, publishableKey };
}

function jsonError(error: any) {
  const status = Number(error?.status) || 500;
  return Response.json({ error: error?.message || "Request failed." }, { status });
}

function bearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    throw Object.assign(new Error("Sign-in required."), { status: 401 });
  }
  return auth;
}

async function supabaseRest(path: string, token: string, init: RequestInit = {}) {
  const { url, publishableKey } = supabasePublicEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      Authorization: token,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  let payload: any = null;
  if (raw) {
    try { payload = JSON.parse(raw); }
    catch { payload = raw; }
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error_description || payload?.error || `Client Portal database request failed (${response.status}).`;
    const status = response.status === 401 || response.status === 403 ? 401 : response.status >= 500 ? 502 : response.status;
    throw Object.assign(new Error(message), { status });
  }
  return payload;
}

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
    const token = bearer(req);
    const clients = await supabaseRest("clients?select=id,business_name,owner_email&limit=1", token);
    const client = Array.isArray(clients) ? clients[0] : null;
    if (!client?.id || !client?.owner_email) {
      return Response.json({ error: "Your VMS client account was not found." }, { status: 404 });
    }

    const body: any = await req.json();
    const type = String(body?.type || "client_portal_activity").slice(0, 120);
    const payload = body?.payload || {};
    const meta = EVENT_META[type] || { title: "Client Portal activity", action: false };
    const detail = detailFor(type, payload);

    await supabaseRest("activity_events", token, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        client_id: client.id,
        event_type: type,
        title: meta.title,
        detail,
        needs_action: meta.action,
        resolved: false,
      }),
    });

    const resendKey = env("RESEND_API_KEY");
    if (resendKey && (meta.action || type === "client_service_checkout_started")) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env("VMS_NOTIFICATION_FROM") || "VMS Portal <notifications@visionmakestudio.com>",
          to: ["info@visionmakestudio.com"],
          subject: `${meta.title} — ${client.business_name || client.owner_email}`,
          text: `Client: ${client.business_name || client.owner_email}\nEmail: ${client.owner_email}\n\n${detail}`,
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
