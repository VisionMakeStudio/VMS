import type { Config } from "@netlify/functions";

export default async () => {
  const database = !!(
    Netlify.env.get("SUPABASE_URL") &&
    (Netlify.env.get("SUPABASE_SECRET_KEY") || Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY"))
  );
  const ai = !!Netlify.env.get("OPENAI_API_KEY");

  return Response.json(
    { ok: true, database, ai },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
};

export const config: Config = { path: "/api/health" };
