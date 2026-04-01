import { Resend } from "resend";

const MAX_RECIPIENTS = 25;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizeEmails(emails) {
  const unique = new Set();
  for (const value of Array.isArray(emails) ? emails : []) {
    const email = String(value || "").trim().toLowerCase();
    if (!email || !isValidEmail(email)) continue;
    unique.add(email);
    if (unique.size >= MAX_RECIPIENTS) break;
  }
  return Array.from(unique);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInviteHtml({ inviterName, tripName, inviteUrl }) {
  const safeInviterName = escapeHtml(inviterName || "A teammate");
  const safeTripName = escapeHtml(tripName || "your trip");
  const safeInviteUrl = escapeHtml(inviteUrl || "");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>You're invited to Tripable</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; padding: 40px; text-align: left;">
          <tr>
            <td>
              <h1 style="color: #09090b; font-size: 24px; font-weight: 600; margin: 0 0 12px 0;">
                You're invited to Tripable
              </h1>

              <p style="color: #52525b; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">
                ${safeInviterName} invited you to collaborate on <strong>${safeTripName}</strong>. Use the button below to review and join the trip.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 0 32px 0;">
                <tr>
                  <td>
                    <a href="${safeInviteUrl}" style="display: inline-block; background-color: #09090b; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none; padding: 14px 28px; border-radius: 8px;">
                      Open Trip Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="background-color: #f4f4f5; padding: 12px; border-radius: 6px; color: #3f3f46; font-size: 14px; word-break: break-all; margin: 0 0 32px 0;">
                <a href="${safeInviteUrl}" style="color: #2563eb; text-decoration: none;">${safeInviteUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0 0 24px 0;" />

              <p style="color: #a1a1aa; font-size: 12px; line-height: 18px; margin: 0;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Missing RESEND_API_KEY" });
  }

  const { tripId, tripName, invitees, inviterName, inviteUrl, notify } = req.body || {};

  if (!tripId || !tripName || !inviteUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const recipients = normalizeEmails(invitees);
  if (!recipients.length) {
    return res.status(400).json({ error: "No valid invitees provided" });
  }

  if (notify === false) {
    return res.status(200).json({
      sent: 0,
      failed: 0,
      total: recipients.length,
      results: recipients.map((email) => ({ email, success: false, skipped: true, reason: "notifications_disabled" }))
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || "Tripable <onboarding@resend.dev>";

  const results = [];

  for (const to of recipients) {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject: `${inviterName || "A teammate"} invited you to ${tripName}`,
        html: buildInviteHtml({
          inviterName: inviterName || "A teammate",
          tripName,
          inviteUrl
        })
      });

      if (error) {
        results.push({ email: to, success: false, error: error.message || "send_failed" });
      } else {
        results.push({ email: to, success: true, id: data?.id || null });
      }
    } catch (error) {
      results.push({ email: to, success: false, error: error?.message || "send_failed" });
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.length - sent;

  return res.status(200).json({
    sent,
    failed,
    total: results.length,
    results
  });
}
