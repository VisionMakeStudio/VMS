import type { Config } from "@netlify/functions";
import { jsonError, requireClient, stripeRequest, supabaseJson } from "./_shared/billing.mts";

async function customerIdFor(clientId: string) {
  const rows = await supabaseJson(`billing_customers?client_id=eq.${encodeURIComponent(clientId)}&select=provider_customer_id&limit=1`);
  return Array.isArray(rows) ? rows[0]?.provider_customer_id || "" : "";
}

function paymentLabel(pm: any) {
  if (!pm) return "Not connected";
  if (pm.type === "card" && pm.card) {
    const brand = String(pm.card.display_brand || pm.card.brand || "Card");
    const title = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Card";
    return pm.card.last4 ? `${title} •••• ${pm.card.last4}` : title;
  }
  if (pm.type === "us_bank_account" && pm.us_bank_account) {
    const bank = pm.us_bank_account.bank_name || "Bank account";
    return pm.us_bank_account.last4 ? `${bank} •••• ${pm.us_bank_account.last4}` : bank;
  }
  return String(pm.type || "Payment method").replace(/_/g, " ");
}

async function getAccount(customerId: string) {
  const customer = await stripeRequest(`customers/${encodeURIComponent(customerId)}`, undefined, "GET");
  const defaultPm = typeof customer?.invoice_settings?.default_payment_method === "string"
    ? customer.invoice_settings.default_payment_method
    : customer?.invoice_settings?.default_payment_method?.id || "";
  let paymentMethod: any = null;
  if (defaultPm) {
    try { paymentMethod = await stripeRequest(`payment_methods/${encodeURIComponent(defaultPm)}`, undefined, "GET"); } catch {}
  }
  if (!paymentMethod) {
    try {
      const list = await stripeRequest(`payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=1`, undefined, "GET");
      paymentMethod = Array.isArray(list?.data) ? list.data[0] : null;
    } catch {}
  }
  return {
    customerId,
    paymentMethodLabel: paymentLabel(paymentMethod),
    hasPaymentMethod: !!paymentMethod,
    livemode: !!customer?.livemode,
  };
}

export default async (req: Request) => {
  if (!['GET','POST'].includes(req.method)) return Response.json({ error: "Method not allowed." }, { status: 405 });
  try {
    const { client } = await requireClient(req);
    const customerId = await customerIdFor(client.id);
    if (!customerId) {
      if (req.method === "POST") throw Object.assign(new Error("Complete a VMS checkout before managing payment details."), { status: 409 });
      return Response.json({ connected: false, paymentMethodLabel: "Not connected" });
    }

    if (req.method === "GET") {
      const account = await getAccount(customerId);
      return Response.json({ connected: true, ...account });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "portal");
    if (!['portal','payment_method','cancel'].includes(action)) throw Object.assign(new Error("Unknown billing action."), { status: 400 });
    const params = new URLSearchParams();
    params.set("customer", customerId);
    params.set("return_url", `${new URL(req.url).origin}/portal/?billing=portal-return`);
    if (action === "payment_method") params.set("flow_data[type]", "payment_method_update");
    const session = await stripeRequest("billing_portal/sessions", params);
    return Response.json({ url: session.url, action });
  } catch (error) {
    return jsonError(error);
  }
};

export const config: Config = { path: "/api/billing-account" };
