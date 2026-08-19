import type { Config } from "@netlify/functions";
import {
  billingEnv,
  dollars,
  jsonError,
  stripeRequest,
  supabaseJson,
  supabaseWrite,
  unixToIso,
} from "./_shared/billing.mts";

const encoder = new TextEncoder();

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(raw: string, header: string, secret: string) {
  const parts = header.split(",").map((x) => x.trim());
  const timestamp = parts.find((x) => x.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  const time = Number(timestamp);
  if (!time || !signatures.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - time) > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${raw}`);
  return signatures.some((sig) => timingSafeEqualHex(expected, sig));
}

function subPeriod(subscription: any) {
  const item = subscription?.items?.data?.[0];
  return {
    start: unixToIso(item?.current_period_start ?? subscription?.current_period_start),
    end: unixToIso(item?.current_period_end ?? subscription?.current_period_end),
  };
}

function subAmount(subscription: any) {
  const item = subscription?.items?.data?.[0];
  const unit = item?.price?.unit_amount ?? item?.plan?.amount ?? 0;
  return dollars(unit);
}

function subCadence(subscription: any) {
  const item = subscription?.items?.data?.[0];
  const interval = item?.price?.recurring?.interval || item?.plan?.interval || "month";
  return interval === "year" ? "Annual" : "Monthly";
}

function invoiceSubscriptionId(invoice: any) {
  return invoice?.parent?.type === "subscription_details"
    ? invoice?.parent?.subscription_details?.subscription || ""
    : invoice?.subscription || "";
}

function invoiceMetadata(invoice: any) {
  return {
    ...(invoice?.parent?.subscription_details?.metadata || {}),
    ...(invoice?.metadata || {}),
  };
}

async function getCatalog(serviceKey: string) {
  if (!serviceKey) return null;
  const rows = await supabaseJson(`service_catalog?id=eq.${encodeURIComponent(serviceKey)}&select=id,name,pricing_model,recurring_price,one_time_price,cadence&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function ensureClientService(clientId: string, serviceKey: string, serviceName: string, amount: number, cadence: string | null, billingStatus: string) {
  const rows = await supabaseJson(`client_services?client_id=eq.${encodeURIComponent(clientId)}&service_key=eq.${encodeURIComponent(serviceKey)}&select=*&limit=1`);
  if (Array.isArray(rows) && rows[0]) {
    const current = rows[0];
    const updated = await supabaseWrite(`client_services?id=eq.${encodeURIComponent(current.id)}`, "PATCH", {
      service_name: serviceName || current.service_name,
      service_status: ['active','trialing','paid'].includes(billingStatus) ? 'active' : current.service_status,
      billing_status: billingStatus,
      agreed_price: amount || current.agreed_price,
      billing_cadence: cadence || current.billing_cadence,
      price_locked: true,
      metadata: { ...(current.metadata || {}), testAccess: false, billingProvider: 'stripe' },
      updated_at: new Date().toISOString(),
    });
    return Array.isArray(updated) ? updated[0] : current;
  }
  const inserted = await supabaseWrite("client_services", "POST", {
    client_id: clientId,
    service_key: serviceKey,
    service_name: serviceName || serviceKey,
    service_status: ['active','trialing','paid'].includes(billingStatus) ? 'active' : 'pending',
    billing_status: billingStatus,
    catalog_service_id: serviceKey,
    agreed_price: amount || null,
    billing_cadence: cadence || null,
    price_locked: true,
    metadata: { billingProvider: 'stripe' },
    start_date: new Date().toISOString().slice(0,10),
    updated_at: new Date().toISOString(),
  });
  return Array.isArray(inserted) ? inserted[0] : inserted;
}

async function syncSubscription(subscription: any) {
  const metadata = subscription?.metadata || {};
  const clientId = String(metadata.client_id || "");
  const serviceKey = String(metadata.service_key || "");
  if (!clientId || !serviceKey) return;
  const cat = await getCatalog(serviceKey);
  const amount = subAmount(subscription) || Number(metadata.service_amount || cat?.recurring_price || 0);
  const cadence = subCadence(subscription) || cat?.cadence || 'Monthly';
  const status = String(subscription.status || 'incomplete');
  const service = await ensureClientService(clientId, serviceKey, String(metadata.service_name || cat?.name || serviceKey), amount, cadence, status);
  const period = subPeriod(subscription);
  const existing = await supabaseJson(`billing_subscriptions?provider_subscription_id=eq.${encodeURIComponent(subscription.id)}&select=id&limit=1`);
  const payload = {
    client_id: clientId,
    client_service_id: service?.id || null,
    provider: 'stripe',
    provider_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null,
    provider_subscription_id: subscription.id,
    status,
    amount,
    currency: String(subscription.currency || 'usd').toUpperCase(),
    cadence,
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: !!subscription.cancel_at_period_end,
    canceled_at: unixToIso(subscription.canceled_at || subscription.ended_at),
    metadata: { service_key: serviceKey, service_name: metadata.service_name || cat?.name || serviceKey },
    updated_at: new Date().toISOString(),
  };
  if (Array.isArray(existing) && existing[0]) await supabaseWrite(`billing_subscriptions?id=eq.${encodeURIComponent(existing[0].id)}`, 'PATCH', payload);
  else await supabaseWrite('billing_subscriptions', 'POST', payload);

  await supabaseWrite(`client_services?id=eq.${encodeURIComponent(service?.id || '')}`, 'PATCH', {
    billing_status: status,
    service_status: ['active','trialing'].includes(status) ? 'active' : status === 'canceled' ? 'canceled' : service?.service_status || 'pending',
    updated_at: new Date().toISOString(),
  }).catch(()=>{});
}

async function syncInvoice(invoice: any) {
  const metadata = invoiceMetadata(invoice);
  let clientId = String(metadata.client_id || "");
  const subscriptionProviderId = invoiceSubscriptionId(invoice);
  let subscriptionId: string | null = null;
  if (subscriptionProviderId) {
    const rows = await supabaseJson(`billing_subscriptions?provider_subscription_id=eq.${encodeURIComponent(subscriptionProviderId)}&select=id,client_id&limit=1`);
    if (Array.isArray(rows) && rows[0]) {
      subscriptionId = rows[0].id;
      if (!clientId) clientId = rows[0].client_id;
    }
  }
  if (!clientId && invoice.customer) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const rows = await supabaseJson(`billing_customers?provider_customer_id=eq.${encodeURIComponent(customerId)}&select=client_id&limit=1`);
    if (Array.isArray(rows) && rows[0]) clientId = rows[0].client_id;
  }
  if (!clientId) return;

  const existing = await supabaseJson(`billing_invoices?provider_invoice_id=eq.${encodeURIComponent(invoice.id)}&select=id&limit=1`);
  const status = String(invoice.status || (invoice.paid ? 'paid' : 'open'));
  const payload = {
    client_id: clientId,
    subscription_id: subscriptionId,
    provider: 'stripe',
    provider_invoice_id: invoice.id,
    invoice_number: invoice.number || null,
    status,
    amount_due: dollars(invoice.amount_due || 0),
    amount_paid: dollars(invoice.amount_paid || 0),
    currency: String(invoice.currency || 'usd').toUpperCase(),
    issued_at: unixToIso(invoice.created),
    due_at: unixToIso(invoice.due_date),
    paid_at: unixToIso(invoice.status_transitions?.paid_at),
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf_url: invoice.invoice_pdf || null,
    metadata: {
      service_key: metadata.service_key || null,
      service_name: metadata.service_name || null,
      billing_reason: invoice.billing_reason || null,
    },
    updated_at: new Date().toISOString(),
  };
  if (Array.isArray(existing) && existing[0]) await supabaseWrite(`billing_invoices?id=eq.${encodeURIComponent(existing[0].id)}`, 'PATCH', payload);
  else await supabaseWrite('billing_invoices', 'POST', payload);
}

async function syncCheckout(session: any) {
  const metadata = session?.metadata || {};
  const clientId = String(metadata.client_id || session.client_reference_id || '');
  const serviceKey = String(metadata.service_key || '');
  if (!clientId || !serviceKey) return;
  await supabaseWrite(`billing_checkout_sessions?provider_session_id=eq.${encodeURIComponent(session.id)}`, 'PATCH', {
    status: session.status || (session.payment_status === 'paid' ? 'complete' : 'open'),
    provider_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).catch(()=>{});

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
  if (customerId) {
    await supabaseWrite('billing_customers?on_conflict=client_id', 'POST', {
      client_id: clientId,
      provider: 'stripe',
      provider_customer_id: customerId,
      email: session.customer_details?.email || null,
      metadata: { last_checkout_session_id: session.id },
      updated_at: new Date().toISOString(),
    }, 'resolution=merge-duplicates,return=minimal').catch(()=>{});
  }

  if (session.mode === 'subscription' && session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const subscription = await stripeRequest(`subscriptions/${encodeURIComponent(subId)}`, undefined, 'GET');
    await syncSubscription(subscription);
  } else if (session.mode === 'payment' && session.payment_status === 'paid') {
    const cat = await getCatalog(serviceKey);
    const amount = Number(metadata.service_amount || cat?.one_time_price || 0);
    await ensureClientService(clientId, serviceKey, String(metadata.service_name || cat?.name || serviceKey), amount, null, 'paid');
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  try {
    const cfg = billingEnv();
    if (!cfg.stripeWebhookSecret) throw Object.assign(new Error('Stripe webhook secret is not configured.'), { status: 503 });
    const raw = await req.text();
    const signature = req.headers.get('stripe-signature') || '';
    if (!(await verifyStripeSignature(raw, signature, cfg.stripeWebhookSecret))) {
      return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
    }
    const event = JSON.parse(raw);
    const seen = await supabaseJson(`billing_events?provider_event_id=eq.${encodeURIComponent(event.id)}&select=provider_event_id&limit=1`);
    if (Array.isArray(seen) && seen[0]) return Response.json({ received: true, duplicate: true });

    const object = event?.data?.object || {};
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await syncCheckout(object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await syncSubscription(object);
        break;
      case 'invoice.created':
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible':
        await syncInvoice(object);
        break;
      default:
        break;
    }

    await supabaseWrite('billing_events', 'POST', {
      provider_event_id: event.id,
      provider: 'stripe',
      event_type: event.type,
      object_id: object?.id || null,
      livemode: !!event.livemode,
      metadata: { request_id: event?.request?.id || null },
      processed_at: new Date().toISOString(),
    }, 'return=minimal').catch(()=>{});

    return Response.json({ received: true });
  } catch (error) {
    return jsonError(error);
  }
};

export const config: Config = { path: '/api/stripe-webhook' };
