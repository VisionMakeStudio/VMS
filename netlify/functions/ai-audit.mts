import type { Config } from "@netlify/functions";
import { requireAdmin } from "./_shared/auth.mts";
import { supabaseJson, supabaseWrite } from "./_shared/billing.mts";
import { auditBusinessName } from "./_shared/ai-audit-core.mts";

/* Live AI audit, job style.
   POST /api/ai-audit        → checks the request, starts the background audit, returns { job } right away.
   GET  /api/ai-audit?job=ID → { status: "running" | "done" | "error", result?, error? }
   The slow work runs in ai-audit-background (up to 15 minutes), so the browser never hits a 504. */

const KEY = (id: string) => `ai_audit_job:${id}`;
const json = (data: any, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req: Request) => {
  let stage = "authorize";
  try {
    const user = await requireAdmin(req);
    const url = new URL(req.url);

    if (req.method === "GET") {
      stage = "read_job";
      const id = String(url.searchParams.get("job") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 64);
      if (!id) return json({ error: "Missing audit job.", code: "job_required", stage }, 400);
      const rows = await supabaseJson(`workspace_state?scope=eq.admin&state_key=eq.${encodeURIComponent(KEY(id))}&select=payload,updated_at&limit=1`);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return json({ error: "That audit run was not found.", code: "job_not_found", stage }, 404);
      const p = row.payload || {};
      if (p.status === "running" && Date.now() - new Date(p.started_at || row.updated_at).getTime() > 16 * 60 * 1000)
        return json({ status: "error", error: "The live audit took too long. Try again.", code: "audit_timeout" });
      return json(p);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed.", code: "method_not_allowed", stage }, 405);
    stage = "validate_request";
    const body = await req.json().catch(() => ({}));
    if (!auditBusinessName(body)) return json({ error: "Business name is required before running the audit.", code: "business_name_required", stage }, 400);

    stage = "create_job";
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await supabaseWrite("workspace_state?on_conflict=scope,state_key", "POST",
      { scope: "admin", state_key: KEY(id), owner_email: user.email || null, payload: { status: "running", started_at: now }, updated_at: now },
      "resolution=merge-duplicates,return=minimal");
    /* tidy up runs older than two days */
    const old = new Date(Date.now() - 2 * 864e5).toISOString();
    supabaseWrite(`workspace_state?scope=eq.admin&state_key=like.ai_audit_job:*&updated_at=lt.${encodeURIComponent(old)}`, "DELETE", undefined, "return=minimal").catch(() => {});

    stage = "start_job";
    const res = await fetch(`${url.origin}/.netlify/functions/ai-audit-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: req.headers.get("authorization") || "" },
      body: JSON.stringify({ ...body, job_id: id }),
    });
    if (!res.ok && res.status !== 202) throw Object.assign(new Error(`Could not start the live audit (${res.status}).`), { status: 502, code: "audit_start_failed" });
    return json({ ok: true, job: id, status: "running" }, 202);
  } catch (error: any) {
    const status = Number(error?.status) || 500;
    return json({ error: String(error?.message || "Audit AI could not complete the request.").slice(0, 700), code: error?.code || "audit_request_error", stage }, status);
  }
};

export const config: Config = { path: "/api/ai-audit" };
