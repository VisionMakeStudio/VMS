export type VmsUser = { id: string; email?: string | null };

function env(name: string) {
  return Netlify.env.get(name) || "";
}

export function supabaseEnv() {
  return { url: env("SUPABASE_URL"), serviceKey: env("SUPABASE_SERVICE_ROLE_KEY") };
}

export async function requireUser(req: Request): Promise<VmsUser> {
  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey) throw Object.assign(new Error("Supabase server configuration is incomplete."), { status: 503 });
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw Object.assign(new Error("Sign-in required."), { status: 401 });
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: auth } });
  if (!userRes.ok) throw Object.assign(new Error("Session is invalid or expired."), { status: 401 });
  return (await userRes.json()) as VmsUser;
}

export async function requireAdmin(req: Request): Promise<VmsUser> {
  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey) throw Object.assign(new Error("Supabase server configuration is incomplete."), { status: 503 });
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw Object.assign(new Error("Admin sign-in required."), { status: 401 });

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: auth },
  });
  if (!userRes.ok) throw Object.assign(new Error("Admin session is invalid or expired."), { status: 401 });
  const user = (await userRes.json()) as VmsUser;

  const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const profiles = profileRes.ok ? await profileRes.json() : [];
  if (!Array.isArray(profiles) || profiles[0]?.role !== "admin") throw Object.assign(new Error("This account is not authorized for VMS Admin."), { status: 403 });
  return user;
}

export function jsonError(error: any) {
  const status = Number(error?.status) || 500;
  return Response.json({ error: error?.message || "Request failed." }, { status });
}
