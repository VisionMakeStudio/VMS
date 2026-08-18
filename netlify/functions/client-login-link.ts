import type { Config, Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { cleanText, isEmail, json, parseJson } from "./_shared/http.ts";

export default async function handler(request: Request, _context: Context) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await parseJson(request);
    if (cleanText(body.companyWebsite, 200)) return json({ ok: true }, 202);

    const email = cleanText(body.email, 180).toLowerCase();
    if (!isEmail(email)) return json({ error: "Enter a valid email address." }, 400);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Client email sign-in is waiting for the Supabase environment settings." }, 503);
    }

    const siteUrl = (process.env.URL || new URL(request.url).origin).replace(/\/$/, "");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteUrl}/portal/`,
      },
    });

    // Keep the response intentionally generic so the form never reveals whether an account exists.
    if (error) console.warn("Client magic-link request was not delivered", error.message);
    return json({ ok: true, message: "If this email belongs to an active VMS client, a secure link will arrive shortly." });
  } catch (error) {
    console.error("Client login-link request failed", error);
    return json({ error: "The secure sign-in service is temporarily unavailable." }, 500);
  }
}

export const config: Config = { path: "/api/client-login-link" };
