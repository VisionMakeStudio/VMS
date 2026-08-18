const DEFAULT_NOTIFICATION_EMAIL = "info@visionmakestudio.com";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

type NotificationInput = {
  subject: string;
  heading: string;
  rows: Array<[string, unknown]>;
  replyTo?: string;
};

export async function sendVmsNotification({ subject, heading, rows, replyTo }: NotificationInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VMS_FROM_EMAIL;
  const to = process.env.VMS_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;

  if (!apiKey || !from) return { sent: false, reason: "not_configured" as const };

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <th style="padding:10px 12px;border-bottom:1px solid #dbe5e9;text-align:left;color:#45606c;vertical-align:top;">${escapeHtml(label)}</th>
      <td style="padding:10px 12px;border-bottom:1px solid #dbe5e9;color:#0a3448;white-space:pre-wrap;">${escapeHtml(value || "—")}</td>
    </tr>`).join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      ...(replyTo ? { reply_to: replyTo } : {}),
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#f4f7f8;padding:28px;color:#0a3448;">
          <div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dbe5e9;border-radius:16px;overflow:hidden;">
            <div style="background:#003049;color:#fff;padding:24px 28px;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#9cc5da;">Vision Make Studio</div>
              <h1 style="margin:8px 0 0;font-size:25px;line-height:1.2;">${escapeHtml(heading)}</h1>
            </div>
            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows}</table>
            <p style="margin:0;padding:20px 28px;color:#6a7c84;font-size:12px;">Sent automatically by the VMS website.</p>
          </div>
        </div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("VMS notification email failed", response.status, detail.slice(0, 500));
    return { sent: false, reason: "provider_error" as const };
  }

  return { sent: true, reason: "sent" as const };
}
