import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { json } from "./_shared/http.ts";

export default async function handler(_request: Request, _context: Context) {
  const user = await getUser();
  const roles = user?.roles || user?.appMetadata?.roles || [];
  if (!user || (user.role !== "admin" && !roles.includes("admin"))) {
    return json({ error: "Unauthorized." }, 401);
  }
  return json({ ok: true, user: { id: user.id, email: user.email, name: user.name, roles } });
}

export const config: Config = { path: "/api/admin/session" };
