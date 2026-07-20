// ============================================================
// email — unified send wrapper for AnsarAEO.
//
// The repo already uses Zoho SMTP via nodemailer for the contact form and
// onboarding-emails.ts. This wrapper adds Resend as a second provider WITHOUT
// migrating the existing send path — each caller picks provider per send,
// defaulting to Zoho for backward compatibility.
//
// Rollout plan (from Batch C):
//   - New transactional emails start on Resend.
//   - Existing onboarding/cron emails stay on Zoho until Resend deliverability
//     is proven on the ansaraeo.com domain (SPF/DKIM verified).
//
// Both providers are lazy-initialized (mirrors getRazorpay() pattern) so
// missing keys never break `next build`.
// ============================================================

import { getResendConfig } from "@/lib/env";
import { Resend } from "resend";

export type EmailProvider = "resend" | "zoho";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  // Explicit provider override. Defaults to "zoho" to preserve existing
  // caller behavior when onboarding-emails.ts routes through this wrapper.
  provider?: EmailProvider;
};

export type EmailResult = { ok: boolean; provider: EmailProvider; error?: string; id?: string };

// EMAIL_DRY_RUN=true forces dry-run for BOTH providers.
// Zoho path also treats a missing ZOHO_SMTP_USER as implicit dry-run — this
// preserves the pre-existing onboarding-emails.ts behavior where crons could
// fire in dev/CI without SMTP creds and return {ok: true} silently. Resend
// stays strict (missing key → error) because it's opt-in per call.
function isForcedDryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "true";
}
function isZohoImplicitDryRun(): boolean {
  return !process.env.ZOHO_SMTP_USER;
}

// ---------- Resend ----------
let _resend: Resend | null = null;

function getResend(): Resend | null {
  const cfg = getResendConfig();
  if (!cfg) return null;
  if (!_resend) _resend = new Resend(cfg.apiKey);
  return _resend;
}

async function sendViaResend(payload: EmailPayload): Promise<EmailResult> {
  const cfg = getResendConfig();
  const client = getResend();
  if (!cfg || !client) {
    return { ok: false, provider: "resend", error: "RESEND_API_KEY not configured" };
  }
  if (isForcedDryRun()) {
    console.info(`[email:DRY_RUN][resend] to=${payload.to} subj="${payload.subject}"`);
    return { ok: true, provider: "resend" };
  }
  const { data, error } = await client.emails.send({
    from: payload.from ?? cfg.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  if (error) return { ok: false, provider: "resend", error: error.message };
  return { ok: true, provider: "resend", id: data?.id };
}

// ---------- Zoho SMTP ----------
// Kept as the default provider for backward compatibility with the pre-Resend
// call sites. See src/lib/onboarding-emails.ts for the pre-existing usage.
async function sendViaZoho(payload: EmailPayload): Promise<EmailResult> {
  if (isForcedDryRun() || isZohoImplicitDryRun()) {
    console.info(`[email:DRY_RUN][zoho] to=${payload.to} subj="${payload.subject}"`);
    return { ok: true, provider: "zoho" };
  }
  try {
    // Lazy import so nodemailer isn't pulled into route bundles that don't
    // send email — matches the pattern in the pre-existing onboarding-emails.
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: payload.from ?? `"AnsarAEO" <${process.env.ZOHO_SMTP_USER}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { ok: true, provider: "zoho", id: info.messageId };
  } catch (err) {
    return { ok: false, provider: "zoho", error: (err as Error).message };
  }
}

// ---------- public API ----------
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const provider: EmailProvider = payload.provider ?? "zoho";
  if (provider === "resend") return sendViaResend(payload);
  return sendViaZoho(payload);
}
