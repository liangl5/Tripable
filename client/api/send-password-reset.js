import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function getBody(req) {
  if (!req.body || typeof req.body !== "string") {
    return req.body || {};
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function formatFromAddress(value) {
  const trimmed = String(value || "").trim();
  const fallback = "Tripable <onboarding@resend.dev>";

  if (!trimmed) return fallback;

  const bracketedMatch = trimmed.match(/^([^<>]+?)\s*<\s*([^<>\s@]+@[^\s@]+\.[^\s@]+)\s*>$/);
  if (bracketedMatch) {
    const displayName = bracketedMatch[1].trim().replace(/\s+/g, " ");
    const email = bracketedMatch[2].trim().toLowerCase();
    return `${displayName} <${email}>`;
  }

  const emailMatch = trimmed.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (!emailMatch) return fallback;

  const email = emailMatch[1].trim().toLowerCase();
  const displayName = trimmed
    .replace(emailMatch[0], "")
    .replace(/[<>"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${displayName || "Tripable"} <${email}>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function buildResetHtml({ resetUrl }) {
  const safeResetUrl = escapeHtml(resetUrl);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your Tripable password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 40px 20px; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; padding: 40px; text-align: left;">
          <tr>
            <td>
              <h1 style="color: #09090b; font-size: 24px; font-weight: 600; margin: 0 0 12px 0;">
                Reset your Tripable password
              </h1>

              <p style="color: #52525b; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">
                Use the button below to choose a new password for your Tripable account.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 0 32px 0;">
                <tr>
                  <td>
                    <a href="${safeResetUrl}" style="display: inline-block; background-color: #09090b; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none; padding: 14px 28px; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="background-color: #f4f4f5; padding: 12px; border-radius: 6px; color: #3f3f46; font-size: 14px; word-break: break-all; margin: 0 0 32px 0;">
                <a href="${safeResetUrl}" style="color: #2563eb; text-decoration: none;">${safeResetUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0 0 24px 0;" />

              <p style="color: #a1a1aa; font-size: 12px; line-height: 18px; margin: 0;">
                If you did not request a password reset, you can safely ignore this email.
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

  const { email, redirectTo } = getBody(req);
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo
      }
    });

    if (error) {
      const isMissingUser = /not found|no user|user.*exist/i.test(String(error.message || ""));
      if (isMissingUser) {
        return res.status(200).json({ ok: true, sent: false });
      }
      throw error;
    }

    const resetUrl = data?.properties?.action_link;
    if (!resetUrl) {
      throw new Error("Supabase did not generate a reset link.");
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendError } = await resend.emails.send({
      from: formatFromAddress(process.env.RESEND_FROM_EMAIL),
      to: normalizedEmail,
      subject: "Reset your Tripable password",
      html: buildResetHtml({ resetUrl })
    });

    if (sendError) {
      throw new Error(sendError.message || "Password reset email failed to send.");
    }

    return res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to send a password reset email right now.",
      details: error?.message || "unknown_error"
    });
  }
}
