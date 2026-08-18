import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin, supabaseEnv } from "./_shared/auth.mts";

type ClientInput = {
  business?: string;
  email?: string;
  contact?: string;
  phone?: string;
  status?: string;
  services?: any[];
};

function cleanEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}
function slug(value: any) {
  return String(value || "service").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "service";
}
async function jsonOrText(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}
async function findOrCreateClient(input: ClientInput) {
  const { url, serviceKey } = supabaseEnv();
  const email = cleanEmail(input.email);
  if (!email) throw Object.assign(new Error("Client email is required for Portal access."), { status: 400 });
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const find = await fetch(`${url}/rest/v1/clients?owner_email=eq.${encodeURIComponent(email)}&select=*&limit=1`, { headers });
  if (!find.ok) throw Object.assign(new Error("Could not look up the VMS client record."), { status: 502 });
  const rows: any[] = await find.json();
  const payload = {
    business_name: String(input.business || rows?.[0]?.business_name || "VMS Client").trim().slice(0, 180),
    owner_email: email,
    contact_name: String(input.contact || "").trim().slice(0, 180) || null,
    phone: String(input.phone || "").trim().slice(0, 80) || null,
    status: String(input.status || "active").trim().toLowerCase() === "archived" ? "archived" : "active",
  };
  if (rows?.[0]?.id) {
    const update = await fetch(`${url}/rest/v1/clients?id=eq.${encodeURIComponent(rows[0].id)}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload) });
    if (!update.ok) throw Object.assign(new Error("Could not update the VMS client record."), { status: 502 });
    return (await update.json())[0] || { ...rows[0], ...payload };
  }
  const create = await fetch(`${url}/rest/v1/clients`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload) });
  if (!create.ok) throw Object.assign(new Error("Could not create the VMS client record."), { status: 502 });
  return (await create.json())[0];
}

async function syncServices(clientId: string, services: any[]) {
  const { url, serviceKey } = supabaseEnv();
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const catalogRes = await fetch(`${url}/rest/v1/service_catalog?select=id,name,pricing_model,one_time_price,recurring_price,cadence`, { headers });
  const catalog: any[] = catalogRes.ok ? await catalogRes.json() : [];
  const byId = new Map(catalog.map(x => [String(x.id).toLowerCase(), x]));
  const byName = new Map(catalog.map(x => [String(x.name).toLowerCase(), x]));
  const normalized = (Array.isArray(services) ? services : []).map((service: any) => {
    const candidate = byId.get(String(service.catalogType || "").toLowerCase()) || byName.get(String(service.name || "").toLowerCase());
    const billingType = String(service.billingType || "").toLowerCase();
    const cadence = billingType.includes("month") ? "Monthly" : (candidate?.cadence || null);
    const price = service.price === "" || service.price == null
      ? (cadence ? candidate?.recurring_price : candidate?.one_time_price)
      : Number(service.price);
    return {
      client_id: clientId,
      service_key: candidate?.id || slug(service.catalogType || service.name),
      service_name: String(service.name || candidate?.name || "VMS Service").slice(0, 180),
      service_status: String(service.status || "active").toLowerCase(),
      billing_status: String(service.status || "active").toLowerCase() === "active" ? "active" : "pending",
      catalog_service_id: candidate?.id || null,
      agreed_price: Number.isFinite(Number(price)) ? Number(price) : null,
      billing_cadence: cadence,
      price_locked: true,
      metadata: { source: "vms-admin-clients", note: String(service.note || "").slice(0, 1000) },
    };
  });
  const remove = await fetch(`${url}/rest/v1/client_services?client_id=eq.${encodeURIComponent(clientId)}&metadata->>source=eq.vms-admin-clients`, { method: "DELETE", headers });
  if (!remove.ok) throw Object.assign(new Error("Could not refresh the client service list."), { status: 502 });
  if (!normalized.length) return [];
  const insert = await fetch(`${url}/rest/v1/client_services`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(normalized) });
  if (!insert.ok) throw Object.assign(new Error("Could not sync the client services."), { status: 502 });
  return await insert.json();
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    await requireAdmin(req);
    const body: any = await req.json();
    const action = String(body.action || "sync");
    const input: ClientInput = body.client || {};
    if (action === "delete") {
      const { url, serviceKey } = supabaseEnv();
      const email = cleanEmail(input.email);
      if (!email) return Response.json({ ok: true, skipped: true });
      const r = await fetch(`${url}/rest/v1/clients?owner_email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!r.ok) throw Object.assign(new Error("Could not delete the production client record."), { status: 502 });
      return Response.json({ ok: true, deleted: true });
    }
    const client = await findOrCreateClient(input);

    if (action === "sync-services") {
      const services = await syncServices(client.id, input.services || []);
      return Response.json({ ok: true, client, services });
    }

    if (action === "invite") {
      const { url, serviceKey } = supabaseEnv();
      const email = cleanEmail(input.email);
      const redirectTo = new URL("/portal/", new URL(req.url).origin).href;
      const invite = await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, data: { business_name: client.business_name, vms_client_id: client.id } }),
      });
      const result: any = await jsonOrText(invite);
      if (!invite.ok) {
        const message = String(result?.msg || result?.message || result?.error_description || result || "Could not invite this client.");
        if (/already|registered|exists/i.test(message)) return Response.json({ ok: true, client, alreadyUser: true, message: "This email already has Portal authentication. They can use the Member Portal magic-link sign-in." });
        throw Object.assign(new Error(message), { status: invite.status || 502 });
      }
      return Response.json({ ok: true, client, invited: true, message: `Portal invitation sent to ${email}.` });
    }

    return Response.json({ ok: true, client });
  } catch (error) { return jsonError(error); }
};

export const config: Config = { path: "/api/client-account" };
