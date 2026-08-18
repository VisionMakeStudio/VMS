import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin, supabaseEnv } from "./_shared/auth.mts";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    await requireAdmin(req);
    const body: any = await req.json();
    const businessName = String(body.business_name || "").trim();
    if (!businessName) return Response.json({ error: "Business name is required." }, { status: 400 });
    const { url, serviceKey } = supabaseEnv();
    let clientId: string | null = null;
    const clientSearch = await fetch(`${url}/rest/v1/clients?business_name=eq.${encodeURIComponent(businessName)}&select=id&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (clientSearch.ok) {
      const clients = await clientSearch.json();
      clientId = Array.isArray(clients) && clients[0]?.id ? clients[0].id : null;
    }
    const record = {
      client_id: clientId,
      business_name: businessName,
      status: String(body.status || "draft"),
      scores: body.scoring || {},
      findings: {
        industry: body.industry || "",
        website_url: body.website_url || "",
        google_url: body.google_url || "",
        internal_notes: body.internal_notes || "",
        final_notes: body.final_notes || {},
        assessment_notes: body.assessment_notes || {},
      },
      updated_at: new Date().toISOString(),
    };
    const save = await fetch(`${url}/rest/v1/audit_records`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
    if (!save.ok) throw Object.assign(new Error("Could not save the audit to VMS cloud storage."), { status: 502 });
    const rows = await save.json();
    return Response.json({ ok: true, audit: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) { return jsonError(error); }
};

export const config: Config = { path: "/api/audits" };
