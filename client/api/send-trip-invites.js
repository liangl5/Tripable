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

function buildInviteHtml({ inviterName, tripName, inviteUrl }) {
  return [
    "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#0f172a\">",
    `<h2 style=\"margin:0 0 12px\">${inviterName} invited you to Tripable</h2>`,
    `<p style=\"margin:0 0 10px\">You were invited to collaborate on <strong>${tripName}</strong>.</p>`,
    `<p style=\"margin:0 0 16px\">Use the button below to join the trip.</p>`,
    `<p style=\"margin:0 0 16px\"><a href=\"${inviteUrl}\" style=\"background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;display:inline-block\">Open Trip Invite</a></p>`,
    `<p style=\"font-size:12px;color:#475569\">If the button does not work, paste this link in your browser:<br/>${inviteUrl}</p>`,
    "</div>"
  ].join("");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Missing RESEND_API_KEY" });
  }

  const { tripId, tripName, invitees, inviterName, inviteUrl } = req.body || {};

  if (!tripId || !tripName || !inviteUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const recipients = normalizeEmails(invitees);
  if (!recipients.length) {
    return res.status(400).json({ error: "No valid invitees provided" });
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
