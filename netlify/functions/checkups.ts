import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { cleanMultiline, cleanText, isEmail, json, parseJson, requestIp } from "./_shared/http.ts";
import { sendVmsNotification } from "./_shared/notify.ts";

export default async function handler(request: Request, _context: Context) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await parseJson(request);
    if (cleanText(body.companyWebsite, 200)) return json({ ok: true, emailSent: false }, 202);

    const record = {
      id: crypto.randomUUID(),
      businessName: cleanText(body.businessName, 120),
      contactName: cleanText(body.contactName, 120),
      email: cleanText(body.email, 180).toLowerCase(),
      phone: cleanText(body.phone, 40),
      website: cleanText(body.website, 300),
      goal: cleanText(body.goal, 100),
      message: cleanMultiline(body.message, 3000),
      status: "new",
      source: "public-website",
      submittedAt: new Date().toISOString(),
      requestIp: requestIp(request),
    };

    if (!record.businessName || !record.contactName || !record.goal || !isEmail(record.email)) {
      return json({ error: "Please complete the business name, your name, email, and requested goal." }, 400);
    }

    if (record.website && !/^https?:\/\//i.test(record.website)) {
      return json({ error: "The business link must begin with http:// or https://." }, 400);
    }

    const store = getStore("vms-business-checkups", { consistency: "strong" });
    await store.setJSON(`requests/${record.submittedAt.slice(0, 10)}/${record.id}`, record);

    const notification = await sendVmsNotification({
      subject: `New VMS Business Checkup — ${record.businessName}`,
      heading: "New Business Checkup request",
      replyTo: record.email,
      rows: [
        ["Business", record.businessName],
        ["Contact", record.contactName],
        ["Email", record.email],
        ["Phone", record.phone],
        ["Website", record.website],
        ["Goal", record.goal],
        ["Message", record.message],
        ["Submitted", record.submittedAt],
        ["Request ID", record.id],
      ],
    });

    return json({ ok: true, requestId: record.id, emailSent: notification.sent }, 201);
  } catch (error) {
    console.error("Business Checkup submission failed", error);
    return json({ error: "We could not save the request right now. Please try again or email info@visionmakestudio.com." }, 500);
  }
}

export const config: Config = { path: "/api/checkups" };
