import type { Config } from "@netlify/functions";
import { jsonError, requireAdmin, supabaseEnv } from "./_shared/auth.mts";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  try {
    await requireAdmin(req);
    const { url, serviceKey } = supabaseEnv();
    const r = await fetch(`${url}/rest/v1/intake_requests?select=*&order=created_at.desc`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!r.ok) throw Object.assign(new Error("Could not load VMS website requests."), { status: 502 });
    return Response.json({ requests: await r.json() });
  } catch (error) { return jsonError(error); }
};

export const config: Config = { path: "/api/requests" };
