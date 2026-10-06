import { requireAdmin } from "./_shared/auth.mts";
import { supabaseWrite } from "./_shared/billing.mts";
import { runAiAudit } from "./_shared/ai-audit-core.mts";

/* Background function (the "-background" name gives it up to 15 minutes).
   Started by /api/ai-audit; writes the finished audit to workspace_state so the page can pick it up. */
export default async (req: Request) => {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const id = String(body?.job_id || "").replace(/[^a-z0-9-]/gi, "").slice(0, 64);
  if (!id) return;
  const save = (payload: any) => supabaseWrite(
    `workspace_state?scope=eq.admin&state_key=eq.${encodeURIComponent(`ai_audit_job:${id}`)}`, "PATCH",
    { payload, updated_at: new Date().toISOString() }, "return=minimal");
  try {
    await requireAdmin(req);
    const result = await runAiAudit(body);
    await save({ status: "done", finished_at: new Date().toISOString(), result });
  } catch (error: any) {
    await save({ status: "error", finished_at: new Date().toISOString(), error: String(error?.message || "Audit AI could not complete the request.").slice(0, 700), code: error?.code || "audit_internal_error", stage: error?.stage || "" }).catch(() => {});
  }
};
