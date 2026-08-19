import type { Config } from "@netlify/functions";
import {
  cents,
  jsonError,
  requireClient,
  stripeInterval,
  stripeRequest,
  supabaseJson,
  supabaseWrite,
} from "./_shared/billing.mts";

function cleanText(value: any, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function ensureCustomer(client: any) {
  const rows = await supabaseJson(`billing_customers?client_id=eq.${encodeURIComponent(client.id)}&select=*&limit=1`);
  if (Array.isArray(rows) && rows[0]?.provider_customer_id) return rows[0].provider_customer_id as string;

  const params = new URLSearchParams();
  params.set("email", client.owner_email);
  params.set("name", client.business_name || client.contact_name || client.owner_email);
  params.set("metadata[client_id]", client.id);
  params.set("metadata[vms_business_name]", client.business_name || "");
  const customer = await stripeRequest("customers", params);

  await supabaseWrite("billing_customers?on_conflict=client_id", "POST", {
    client_id: client.id,
    provider: "stripe",
    provider_customer_id: customer.id,
    email: client.owner_email,
    metadata: { livemode: !!customer.livemode },
    updated_at: new Date().toISOString(),
  }, "resolution=merge-duplicates,return=representation");
  return customer.id as string;
}

export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  try {
    const { client } = await requireClient(req);
    const body = await req.json().catch(() => ({}));
    const serviceKey = cleanText(body?.serviceKey, 120);
    if (!serviceKey) throw Object.assign(new Error("Choose a VMS service first."), { status: 400 });

    const services = await supabaseJson(
      `service_catalog?id=eq.${encodeURIComponent(serviceKey)}&status=eq.Published&portal_visible=eq.true&select=id,name,description,pricing_model,one_time_price,recurring_price,cadence,sales_mode,metadata&limit=1`,
    );
    const service = Array.isArray(services) ? services[0] : null;
    if (!service) throw Object.assign(new Error("This VMS service is not available for Client Portal checkout."), { status: 404 });
    if (service.sales_mode !== "Buy Now") throw Object.assign(new Error("This service requires VMS review before payment."), { status: 409 });

    const pricingModel = String(service.pricing_model || "");
    const recurring = /recurring/i.test(pricingModel);

    const existing = await supabaseJson(
      `client_services?client_id=eq.${encodeURIComponent(client.id)}&service_key=eq.${encodeURIComponent(serviceKey)}&service_status=not.in.(canceled,cancelled)&select=id,service_status,billing_status,agreed_price,billing_cadence,price_locked,metadata&limit=1`,
    );
    const assigned = Array.isArray(existing) ? existing[0] : null;
    const isTestAccess = assigned?.metadata?.testAccess === true;
    if (assigned && !isTestAccess) {
      throw Object.assign(new Error("This service is already assigned to your VMS account."), { status: 409, code: "already_assigned" });
    }

    const catalogAmount = Number(recurring ? service.recurring_price : service.one_time_price);
    const lockedAmount = isTestAccess && assigned?.price_locked && Number(assigned?.agreed_price) > 0 ? Number(assigned.agreed_price) : 0;
    const serviceAmount = lockedAmount || catalogAmount;
    if (!Number.isFinite(serviceAmount) || serviceAmount <= 0) throw Object.assign(new Error("This service does not have a valid checkout price."), { status: 409 });

    const requiredKey = cleanText(service?.metadata?.requires, 120);
    if (requiredKey) {
      const prerequisite = await supabaseJson(
        `client_services?client_id=eq.${encodeURIComponent(client.id)}&service_key=eq.${encodeURIComponent(requiredKey)}&service_status=not.in.(canceled,cancelled)&select=id&limit=1`,
      );
      if (!Array.isArray(prerequisite) || !prerequisite[0]) {
        throw Object.assign(new Error("This add-on requires the matching VMS base service first."), { status: 409, code: "missing_prerequisite" });
      }
    }

    const customerId = await ensureCustomer(client);
    const paidInvoices = await supabaseJson(
      `billing_invoices?client_id=eq.${encodeURIComponent(client.id)}&status=eq.paid&select=id&limit=1`,
    );
    const activationWaived = service?.metadata?.activationFeeWaived === true;
    const firstPaidOrder = !Array.isArray(paidInvoices) || paidInvoices.length === 0;
    const activationFee = firstPaidOrder && !activationWaived ? 4.99 : 0;

    const origin = new URL(req.url).origin;
    const params = new URLSearchParams();
    const mode = recurring ? "subscription" : "payment";
    params.set("mode", mode);
    params.set("customer", customerId);
    params.set("client_reference_id", client.id);
    params.set("success_url", `${origin}/portal/?billing=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/portal/?billing=cancel`);
    params.set("billing_address_collection", "auto");
    params.set("customer_update[address]", "auto");
    params.set("customer_update[name]", "auto");
    params.set("metadata[client_id]", client.id);
    params.set("metadata[service_key]", service.id);
    params.set("metadata[service_name]", cleanText(service.name, 200));
    params.set("metadata[service_amount]", serviceAmount.toFixed(2));
    params.set("metadata[activation_fee]", activationFee.toFixed(2));
    params.set("metadata[vms_source]", "client_portal");

    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(cents(serviceAmount)));
    params.set("line_items[0][price_data][product_data][name]", cleanText(service.name, 200));
    const description = cleanText(service.description, 450);
    if (description) params.set("line_items[0][price_data][product_data][description]", description);
    params.set("line_items[0][price_data][product_data][metadata][vms_service_key]", service.id);
    if (recurring) params.set("line_items[0][price_data][recurring][interval]", stripeInterval(service.cadence));

    let nextIndex = 1;
    if (activationFee > 0) {
      params.set(`line_items[${nextIndex}][quantity]`, "1");
      params.set(`line_items[${nextIndex}][price_data][currency]`, "usd");
      params.set(`line_items[${nextIndex}][price_data][unit_amount]`, String(cents(activationFee)));
      params.set(`line_items[${nextIndex}][price_data][product_data][name]`, "VMS Activation Fee");
      params.set(`line_items[${nextIndex}][price_data][product_data][description]`, "One-time activation fee on the client's first standalone paid VMS order.");
      nextIndex += 1;
    }

    if (recurring) {
      params.set("subscription_data[metadata][client_id]", client.id);
      params.set("subscription_data[metadata][service_key]", service.id);
      params.set("subscription_data[metadata][service_name]", cleanText(service.name, 200));
      params.set("subscription_data[metadata][service_amount]", serviceAmount.toFixed(2));
      params.set("subscription_data[metadata][vms_source]", "client_portal");
    } else {
      params.set("invoice_creation[enabled]", "true");
      params.set("invoice_creation[invoice_data][metadata][client_id]", client.id);
      params.set("invoice_creation[invoice_data][metadata][service_key]", service.id);
      params.set("invoice_creation[invoice_data][metadata][service_name]", cleanText(service.name, 200));
      params.set("payment_intent_data[metadata][client_id]", client.id);
      params.set("payment_intent_data[metadata][service_key]", service.id);
    }

    const session = await stripeRequest("checkout/sessions", params);
    await supabaseWrite("billing_checkout_sessions?on_conflict=provider_session_id", "POST", {
      provider_session_id: session.id,
      client_id: client.id,
      service_key: service.id,
      mode,
      status: session.status || "open",
      currency: String(session.currency || "usd").toUpperCase(),
      service_amount: serviceAmount,
      activation_fee: activationFee,
      provider_customer_id: customerId,
      metadata: { service_name: service.name, checkout_url_created: true },
      updated_at: new Date().toISOString(),
    }, "resolution=merge-duplicates,return=minimal");

    return Response.json({
      url: session.url,
      sessionId: session.id,
      mode,
      service: { id: service.id, name: service.name, amount: serviceAmount, cadence: service.cadence || null },
      activationFee,
    });
  } catch (error) {
    return jsonError(error);
  }
};

export const config: Config = { path: "/api/billing-checkout" };
