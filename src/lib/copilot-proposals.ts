// ============================================================
// copilot-proposals — pure functions that build Copilot's proactive
// messages. Kept separate from agent-context.ts so they can be reused
// in the welcome UI, the celebrations layer, and the weekly digest.
//
// A "proposal" is what Copilot suggests the user do next, without
// waiting for a chat turn. Each returns:
//   - text: the observation-first message copy
//   - cta: the primary CTA label
//   - action: a stable string the caller uses to route on click
// ============================================================

import type { ScanReport } from "@/lib/scan-classifier";

export type GoalKey = "chatgpt_mentions" | "beat_competitor" | "fix_site";

export type Proposal = {
  text: string;
  cta: string;
  action: string;
};

// Preselect the goal that best fits the report signal. Rules match the
// design: score < 20 → chatgpt_mentions; competitor lead ≥ 50pp →
// beat_competitor; citation share < 5% → fix_site.
export function recommendGoal(report: ScanReport | null): GoalKey {
  if (!report) return "chatgpt_mentions";
  const competitorLead = (report.competitorScores[0]?.rate ?? 0) - report.visibilityScore;
  if (competitorLead >= 50) return "beat_competitor";
  if (report.visibilityScore < 20) return "chatgpt_mentions";
  // Free scan doesn't extract citations today, so we conservatively fall
  // back to chatgpt_mentions when neither strong signal is present.
  return "chatgpt_mentions";
}

// The Copilot intro shown on /dashboard/welcome/copilot. Grounded in the
// specific most-invisible prompt and the chosen goal.
export function proposeFirstDraft(params: {
  brandName: string;
  mostInvisiblePrompt: string | null;
  goal: GoalKey;
}): Proposal {
  const { brandName, mostInvisiblePrompt, goal } = params;
  if (!mostInvisiblePrompt) {
    return {
      text: `Hi. I'm your AEO Copilot. Your scan didn't surface a clear miss — we'll pick one up in the first nightly run. Want me to walk you through Mission Control while we wait?`,
      cta: "Show me Mission Control",
      action: "mission-control",
    };
  }
  const framing =
    goal === "beat_competitor"
      ? `to beat your top competitor on`
      : goal === "fix_site"
        ? `to fix the citation gap around`
        : `where you're most invisible:`;
  return {
    text: `Hi. I'm your AEO Copilot. I drafted an answer block for ${brandName} ${framing} "${mostInvisiblePrompt}". It uses [ADD …] placeholders wherever real facts about your brand are needed — that's the honesty rule, not a bug. Want me to open the draft so you can fill it in?`,
    cta: "Yes, open the draft",
    action: "open-draft",
  };
}

// A one-line reply Copilot fires when the user just published a draft.
export function proposeAfterPublish(params: { promptText: string }): Proposal {
  return {
    text: `Published. I'll re-check ChatGPT, Perplexity, and Gemini for "${params.promptText}" in 48h. If you appear, I'll tell you which sentence they picked up.`,
    cta: "Sounds good",
    action: "acknowledge",
  };
}

// Share-view proposal — used post-publish to suggest sending a signed
// URL to a teammate rather than a full seat invite.
export function proposeShareView(params: { brandName: string }): Proposal {
  return {
    text: `Want a teammate to review your next draft? Send them a view-only link for ${params.brandName}'s report — no signup on their side.`,
    cta: "Generate share link",
    action: "share-link",
  };
}
