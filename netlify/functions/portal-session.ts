import type { Config, Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { cleanText, json, parseJson } from "./_shared/http.ts";

const COOKIE_NAME = "vms_portal_token";

const readCookie = (request: Request, name: string) => {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
};

const cookieHeader = (token: string, maxAge: number) => [
  `${COOKIE_NAME}=${encodeURIComponent(token)}`,
  "Path=/",
  "HttpOnly",
  "Secure",
  "SameSite=Lax",
  `Max-Age=${maxAge}`,
].join("; ");

const jsonWithCookie = (data: unknown, status: number, cookie: string) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Set-Cookie": cookie,
  },
});

export default async function handler(request: Request, _context: Context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Client Portal authentication is not configured yet." }, 503);
  }

  if (request.method === "DELETE") {
    return jsonWithCookie({ ok: true }, 200, cookieHeader("", 0));
  }

  let accessToken = "";
  if (request.method === "POST") {
    try {
      const body = await parseJson(request);
      accessToken = cleanText(body.accessToken, 5000);
    } catch {
      return json({ error: "The secure sign-in token could not be read." }, 400);
    }
  } else if (request.method === "GET") {
    accessToken = readCookie(request, COOKIE_NAME);
  } else {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!accessToken) return json({ error: "No active Client Portal session." }, 401);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) return jsonWithCookie({ error: "The Client Portal session expired." }, 401, cookieHeader("", 0));

    const payload = {
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        clientId: data.user.user_metadata?.client_id || null,
      },
    };
    return request.method === "POST"
      ? jsonWithCookie(payload, 200, cookieHeader(accessToken, 60 * 60))
      : json(payload);
  } catch (error) {
    console.error("Client Portal session validation failed", error);
    return json({ error: "The secure session could not be verified." }, 500);
  }
}

export const config: Config = { path: "/api/portal/session" };
