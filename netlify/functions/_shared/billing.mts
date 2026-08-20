export type VmsClient = {
  id: string;
  business_name: string;
  owner_email: string;
  contact_name?: string | null;
};

function env(name: string) {
  return Netlify.env.get(name) || "";
}

function normalizedStripeMode() {
  const value = env("VMS_STRIPE_MODE").trim().toLowerCase();
  return value === "live" ? "live" : "test";
}

function stripeKeyMode(key: string) {
  if (/^(?:sk|rk)_live_/i.test(key)) return "live";
  if (/^(?:sk|rk)_test_/i.test(key)) return "test";
  return "unknown";
}

function stripeModeError(mode: string, key: string) {
  const keyMode = stripeKeyMode(key);
  if (!key) {
    return mode === "test"
      ? "Stripe Test Mode is not connected yet. Add STRIPE_TEST_SECRET_KEY before QA checkout."
      : "Stripe Live Mode is not connected yet.";
  }
  if (keyMode === "unknown") return "VMS cannot verify the configured Stripe key mode.";
  if (mode === "test" && keyMode !== "test") {
    return "VMS billing is locked to Stripe Test Mode for QA. Live Stripe requests are disabled.";
  }
  if (mode === "live" && keyMode !== "live") {
    return "VMS billing is configured for Live Mode, but the connected Stripe key is not live.";
  }
  return "";
}

export function billingEnv() {
  const supabaseUrl = env("SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const stripeMode = normalizedStripeMode();

  // Phase 12B keeps QA and production Stripe credentials separate.
  // Test mode NEVER falls back to the legacy/live key.
  const stripeSecretKey = stripeMode === "test"
    ? env("STRIPE_TEST_SECRET_KEY")
    : (env("STRIPE_LIVE_SECRET_KEY") || env("STRIPE_SECRET_KEY"));

  const rawStripeWebhookSecret = stripeMode === "test"
    ? env("STRIPE_TEST_WEBHOOK_SECRET")
    : (env("STRIPE_LIVE_WEBHOOK_SECRET") || env("STRIPE_WEBHOOK_SECRET"));

  const stripeSafetyError = stripeModeError(stripeMode, stripeSecretKey);

  // Fail closed: no webhook processing if the selected Stripe key is missing
  // or does not match the selected environment.
  const stripeWebhookSecret = stripeSafetyError ? "" : rawStripeWebhookSecret;

  return {
    supabaseUrl,
    publishableKey,
    secretKey,
    stripeSecretKey,
    stripeWebhookSecret,
    stripeMode,
    stripeSafetyError,
  };
}

export function requireServerConfig(includeStripe = true) {
  const cfg = billingEnv();
  if (!cfg.supabaseUrl || !cfg.publishableKey || !cfg.secretKey) {
    throw Object.assign(new Error("VMS billing server configuration is incomplete."), { status: 503 });
  }
  if (includeStripe) {
    if (!cfg.stripeSecretKey) {
      throw Object.assign(new Error("Stripe is not connected yet."), { status: 503, code: "stripe_not_configured" });
    }
    if (cfg.stripeSafetyError) {
      throw Object.assign(new Error(cfg.stripeSafetyError), {
        status: 503,
        code: cfg.stripeMode === "test" ? "stripe_test_mode_required" : "stripe_live_mode_required",
      });
    }
  }
  return cfg;
}

function adminHeaders(secretKey: string, extra: HeadersInit = {}) {
  const headers = new Headers(extra);
  headers.set("apikey", secretKey);
  if (!secretKey.startsWith("sb_secret_")) headers.set("Authorization", `Bearer ${secretKey}`);
  return headers;
}

export async function requireClient(req: Request): Promise<{ user: any; client: VmsClient }> {
  const cfg = requireServerConfig(false);
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw Object.assign(new Error("Client Portal sign-in required."), { status: 401 });
  }

  const userRes = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: cfg.publishableKey, Authorization: authorization },
  });
  if (!userRes.ok) throw Object.assign(new Error("Client Portal session is invalid or expired."), { status: 401 });
  const user = await userRes.json();
  const email = String(user?.email || "").trim();
  if (!email) throw Object.assign(new Error("This Client Portal account has no email address."), { status: 403 });

  const clientRes = await fetch(
    `${cfg.supabaseUrl}/rest/v1/clients?owner_email=ilike.${encodeURIComponent(email)}&select=id,business_name,owner_email,contact_name&limit=1`,
    { headers: adminHeaders(cfg.secretKey) },
  );
  if (!clientRes.ok) throw Object.assign(new Error("VMS could not load the client billing account."), { status: 502 });
  const clients = await clientRes.json();
  if (!Array.isArray(clients) || !clients[0]) throw Object.assign(new Error("No VMS client record is connected to this sign-in."), { status: 404 });
  return { user, client: clients[0] as VmsClient };
}

export async function supabaseAdmin(path: string, init: RequestInit = {}) {
  const cfg = requireServerConfig(false);
  const headers = adminHeaders(cfg.secretKey, init.headers || {});
  if (init.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { ...init, headers });
  return res;
}

export async function supabaseJson(path: string) {
  const res = await supabaseAdmin(path);
  if (!res.ok) throw Object.assign(new Error(`VMS database request failed (${res.status}).`), { status: 502 });
  return res.json();
}

export async function supabaseWrite(path: string, method: "POST" | "PATCH" | "DELETE", body?: any, prefer = "return=representation") {
  const headers: Record<string, string> = {};
  if (prefer) headers.Prefer = prefer;
  const res = await supabaseAdmin(path, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw Object.assign(new Error(`VMS database update failed (${res.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`), { status: 502 });
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function stripeRequest(path: string, params?: URLSearchParams, method = "POST") {
  const { stripeSecretKey } = requireServerConfig(true);
  const headers: Record<string, string> = { Authorization: `Bearer ${stripeSecretKey}` };
  let body: string | undefined;
  if (params) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = params.toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || `Stripe request failed (${res.status}).`;
    throw Object.assign(new Error(message), { status: res.status >= 500 ? 502 : 400, stripeCode: json?.error?.code });
  }
  return json;
}

export function cents(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function dollars(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

export function unixToIso(value: any) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

export function stripeInterval(cadence: any) {
  const value = String(cadence || "").toLowerCase();
  return value.includes("year") || value.includes("annual") ? "year" : "month";
}

export function jsonError(error: any) {
  const status = Number(error?.status) || 500;
  const payload: any = { error: error?.message || "Billing request failed." };
  if (error?.code) payload.code = error.code;
  return Response.json(payload, { status });
}
