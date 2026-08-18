import type { Config } from "@netlify/functions";

export default async () => {
  const database = !!(Netlify.env.get("SUPABASE_URL") && Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const ai = !!Netlify.env.get("OPENAI_API_KEY");
  return Response.json({ ok: true, database, ai });
};

export const config: Config = { path: "/api/health" };
