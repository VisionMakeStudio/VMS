import { logout, verifyRequestOrigin } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

export default async function handler(request: Request, _context: Context) {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405 });
  try {
    verifyRequestOrigin(request);
    await logout();
    return new Response(null, { status: 303, headers: { Location: "/staff-login/", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin logout failed", error);
    return new Response(null, { status: 303, headers: { Location: "/staff-login/", "Cache-Control": "no-store" } });
  }
}

export const config: Config = { path: "/api/admin/logout" };
