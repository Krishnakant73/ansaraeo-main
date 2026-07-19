// ============================================================
// onboarding-emails — event-triggered transactional templates.
//
// Design rules (from the redesign):
//   - No newsletter layouts. Plain text + minimal HTML, ONE CTA each.
//   - No "how to use the product" educational content — every email is
//     a signal from the product itself (a delta, a rank change, a nudge).
//   - Subject lines lead with the outcome, not the feature.
//   - Mirrors to WhatsApp when the org has opted in via `whatsapp_phone`.
//
// Zoho SMTP is used for email (same wiring as weekly-reports cron).
// Templates below are lazy-imported so a missing SMTP config doesn't
// crash the build (identical pattern to the Razorpay lazy-init rule
// in CLAUDE.md).
//
// EMAIL_DRY_RUN=true skips real sending and logs the intended payload,
// so local dev / staging can trigger the crons safely.
// ============================================================

import { sendTemplateMessage } from "@/lib/whatsapp";
import type { ScanReport } from "@/lib/scan-classifier";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function dryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "true" || !process.env.ZOHO_SMTP_USER;
}

async function getTransporter() {
  // Lazy import so `next build` doesn't require nodemailer when this
  // module is only imported for its template functions.
  const nodemailer = (await import("nodemailer")).default;
  return nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
  });
}

// One place to send. Every template funnels through this so dry-run
// and error handling stay consistent.
export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  if (dryRun()) {
    console.info(
      `[email:DRY_RUN] to=${payload.to} subj="${payload.subject}"\n${payload.text}`,
    );
    return { ok: true };
  }
  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: `"AnsarAEO" <${process.env.ZOHO_SMTP_USER}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// Optional WhatsApp mirror. Silent no-op when the org has no phone or
// the API isn't configured — WhatsApp is an opt-in secondary channel,
// never a hard dependency.
export async function mirrorWhatsApp(params: {
  phone: string | null | undefined;
  templateName: string;
  templateParams: string[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!params.phone) return { ok: true };
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: true };
  }
  if (dryRun()) {
    console.info(
      `[whatsapp:DRY_RUN] to=${params.phone} tpl=${params.templateName} params=${JSON.stringify(
        params.templateParams,
      )}`,
    );
    return { ok: true };
  }
  try {
    await sendTemplateMessage(params.phone, params.templateName, params.templateParams);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================
// Templates — each is a pure function returning EmailPayload +
// optional WhatsApp params. Callers do the sending so a cron can log
// per-recipient results.
// ============================================================

const dashboardUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://ansaraeo.com";

export function reportReadyEmail(params: {
  email: string;
  brandName: string;
  domain: string;
  score: number;
}): { email: EmailPayload; whatsapp: { templateName: string; params: string[] } } {
  const subject = `Your AI Visibility Report for ${params.domain}`;
  const cta = `${dashboardUrl()}/dashboard/mission-control`;
  return {
    email: {
      to: params.email,
      subject,
      text: `${params.brandName}'s AI Visibility score: ${params.score}/100.

Open Mission Control to see which prompts you're winning, where competitors are winning instead, and the first draft your Copilot has queued.

${cta}
`,
    },
    whatsapp: { templateName: "aeo_report_ready", params: [params.brandName, `${params.score}`] },
  };
}

export function competitorAlertEmail(params: {
  email: string;
  brandName: string;
  competitorName: string;
  competitorMentions: number;
  brandMentions: number;
  total: number;
}) {
  const subject = `${params.competitorName} appears in ${params.competitorMentions} answers. You appear in ${params.brandMentions}.`;
  const cta = `${dashboardUrl()}/dashboard/competitors`;
  return {
    email: {
      to: params.email,
      subject,
      text: `Across the ${params.total} AI answers we tracked this week, ${params.competitorName} shows up in ${params.competitorMentions}. ${params.brandName} shows up in ${params.brandMentions}.

The specific prompts where they beat you are queued in the Opportunity Queue. Open one and we'll draft the counter for you:

${cta}
`,
    },
    whatsapp: {
      templateName: "aeo_competitor_alert",
      params: [params.competitorName, `${params.competitorMentions}`, `${params.brandMentions}`],
    },
  };
}

export function dailyDeltaEmail(params: {
  email: string;
  brandName: string;
  score: number;
  delta: number;
}) {
  const dir = params.delta > 0 ? "up" : params.delta < 0 ? "down" : "flat";
  const subject =
    params.delta === 0
      ? `${params.brandName}: score is flat at ${params.score}`
      : `${params.brandName}: score ${dir} ${Math.abs(params.delta)} → ${params.score}`;
  const cta = `${dashboardUrl()}/dashboard/mission-control`;
  return {
    email: {
      to: params.email,
      subject,
      text: `${params.brandName}'s AI Visibility score today: ${params.score}/100 (${params.delta >= 0 ? "+" : ""}${params.delta} vs yesterday).

Full breakdown: ${cta}
`,
    },
    whatsapp: {
      templateName: "aeo_daily_delta",
      params: [params.brandName, `${params.score}`, `${params.delta}`],
    },
  };
}

export function draftLiveEmail(params: {
  email: string;
  brandName: string;
  promptText: string;
  draftUrl: string;
}) {
  return {
    email: {
      to: params.email,
      subject: `Draft is live for "${params.promptText}"`,
      text: `${params.brandName} — your draft targeting "${params.promptText}" is now live. We'll re-check ChatGPT, Perplexity, and Gemini in 48 hours and tell you which sentence they picked up (if any).

Review the draft: ${params.draftUrl}
`,
    },
    whatsapp: {
      templateName: "aeo_draft_live",
      params: [params.brandName, params.promptText],
    },
  };
}

export function rankChangeEmail(params: {
  email: string;
  brandName: string;
  engine: string;
  promptText: string;
  delta: number;
  sentence: string;
}) {
  const dir = params.delta > 0 ? "entered" : "dropped from";
  return {
    email: {
      to: params.email,
      subject: `${params.brandName} ${dir} ${params.engine}'s answer for "${params.promptText}"`,
      text: `${params.brandName} ${dir} ${params.engine}'s answer for "${params.promptText}" (delta ${params.delta >= 0 ? "+" : ""}${params.delta}).

The exact sentence they used:
"${params.sentence}"

Double down on this angle: ${dashboardUrl()}/dashboard/content
`,
    },
    whatsapp: {
      templateName: "aeo_rank_change",
      params: [params.brandName, params.engine, params.promptText, `${params.delta}`],
    },
  };
}

export function engineChangeEmail(params: {
  email: string;
  brandName: string;
  engineDisplay: string;
  engineSlug: string;
  kind: "baseline_drift" | "citation_shift" | "format_shift" | "manual";
  magnitude: number | null;
  summary: string;
}) {
  const dir =
    params.magnitude != null && params.magnitude !== 0
      ? params.magnitude > 0 ? "up" : "down"
      : "shifting";
  const magText =
    params.magnitude != null ? ` ${Math.abs(params.magnitude).toFixed(1)}pp ${dir}` : "";
  const kindLabel =
    params.kind === "baseline_drift" ? "Mention rate"
    : params.kind === "citation_shift" ? "Citation share"
    : params.kind === "format_shift" ? "Format bias"
    : "Behavior";
  const subject = `${params.engineDisplay}: ${kindLabel}${magText} for ${params.brandName}`;
  const cta = `${dashboardUrl()}/dashboard/w/engine/${params.engineSlug}/model-changes`;
  return {
    email: {
      to: params.email,
      subject,
      text: `${params.engineDisplay}'s answering pattern for ${params.brandName} has shifted.

${params.summary}

Open the change log to see the runs that triggered it and queue a response:
${cta}
`,
    },
    whatsapp: {
      templateName: "aeo_engine_change",
      params: [
        params.brandName,
        params.engineDisplay,
        kindLabel,
        params.magnitude != null ? `${params.magnitude.toFixed(1)}pp` : "shift",
      ],
    },
  };
}

export function weeklyDigestEmail(params: {
  email: string;
  brandName: string;
  wins: string[];
  losses: string[];
  recommendedAction: string;
}) {
  const winsBlock = params.wins.length ? params.wins.map((w) => `• ${w}`).join("\n") : "• No score-moving wins this week.";
  const lossesBlock = params.losses.length ? params.losses.map((l) => `• ${l}`).join("\n") : "• No score-moving losses this week.";
  return {
    email: {
      to: params.email,
      subject: `This week for ${params.brandName}: ${params.wins.length} wins, ${params.losses.length} losses, 1 action`,
      text: `Wins:
${winsBlock}

Losses:
${lossesBlock}

The one thing to do this week:
${params.recommendedAction}

${dashboardUrl()}/dashboard/mission-control
`,
    },
    whatsapp: {
      templateName: "aeo_weekly_digest",
      params: [params.brandName, `${params.wins.length}`, `${params.losses.length}`],
    },
  };
}

export function competitorMovesEmail(params: {
  email: string;
  brandName: string;
  competitorName: string;
  newPages: number;
}) {
  return {
    email: {
      to: params.email,
      subject: `${params.competitorName} shipped ${params.newPages} pages last week`,
      text: `${params.competitorName} added ${params.newPages} pages likely aimed at your top prompts.

The full list plus counter-drafts your Copilot can generate: ${dashboardUrl()}/dashboard/competitor-topics
`,
    },
    whatsapp: {
      templateName: "aeo_competitor_moves",
      params: [params.competitorName, `${params.newPages}`, params.brandName],
    },
  };
}

// ============================================================
// pickWeeklyDigestAction — deterministic selection of the ONE thing to
// suggest in this week's digest. Guarantees the subject line is never
// zero-delta.
// ============================================================
export function pickWeeklyDigestAction(report: ScanReport | null): {
  wins: string[];
  losses: string[];
  action: string;
} {
  if (!report) {
    return {
      wins: [],
      losses: [],
      action: "Run this week's scan from Mission Control to establish a baseline.",
    };
  }
  const wins: string[] = [];
  const losses: string[] = [];
  if (report.brandMentionedAnswers > 0) {
    wins.push(`Mentioned in ${report.brandMentionedAnswers}/${report.totalAnswers} answers.`);
  }
  const topCompetitor = report.competitorScores[0];
  if (topCompetitor && topCompetitor.mentioned > report.brandMentionedAnswers) {
    losses.push(`${topCompetitor.name} appears in ${topCompetitor.mentioned} answers to your ${report.brandMentionedAnswers}.`);
  }
  const action =
    report.opportunities[0]
      ? `Draft an answer block for "${report.opportunities[0].prompt}" — it's your highest-leverage gap.`
      : `Score ${report.visibilityScore}/100. Add one prompt where a competitor beats you and we'll draft the counter.`;
  return { wins, losses, action };
}
