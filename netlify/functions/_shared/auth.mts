export type VmsUser = { id: string; email?: string | null };

function env(name: string) {
  return Netlify.env.get(name) || "";
}

export function supabaseEnv() {
  return {
    url: env("SUPABASE_URL"),
    publishableKey: env("SUPABASE_PUBLISHABLE_KEY"),
    serviceKey: env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function adminHeaders(serviceKey: string) {
  const headers: Record<string, string> = { apikey: serviceKey };
  if (!serviceKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceKey}`;
  return headers;
}

export async function requireUser(req: Request): Promise<VmsUser> {
  const { url, publishableKey, serviceKey } = supabaseEnv();
  if (!url || !publishableKey || !serviceKey) throw Object.assign(new Error("Supabase server configuration is incomplete."), { status: 503 });
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw Object.assign(new Error("Sign-in required."), { status: 401 });
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: auth } });
  if (!userRes.ok) throw Object.assign(new Error("Session is invalid or expired."), { status: 401 });
  return (await userRes.json()) as VmsUser;
}

export async function requireAdmin(req: Request): Promise<VmsUser> {
  const { url, publishableKey, serviceKey } = supabaseEnv();
  if (!url || !publishableKey || !serviceKey) throw Object.assign(new Error("Supabase server configuration is incomplete."), { status: 503 });
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw Object.assign(new Error("Admin sign-in required."), { status: 401 });

  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: auth },
  });
  if (!userRes.ok) throw Object.assign(new Error("Admin session is invalid or expired."), { status: 401 });
  const user = (await userRes.json()) as VmsUser;

  const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, {
    headers: adminHeaders(serviceKey),
  });
  const profiles = profileRes.ok ? await profileRes.json() : [];
  if (!Array.isArray(profiles) || profiles[0]?.role !== "admin") throw Object.assign(new Error("This account is not authorized for VMS Admin."), { status: 403 });
  return user;
}

export function jsonError(error: any) {
  const status = Number(error?.status) || 500;
  return Response.json({ error: error?.message || "Request failed." }, { status });
}
