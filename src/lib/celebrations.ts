// ============================================================
// celebrations — decide when to fire a success celebration and what
// tier it belongs to. Every trigger maps to a real, earned outcome
// (per the redesign): no confetti for finishing "onboarding steps",
// confetti only for concrete wins like "first mention in ChatGPT".
//
// Idempotency: every celebration writes a `celebrated_*` sentinel in
// activation_events. `evaluate()` never returns the same tier twice
// for the same brand/user pair.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { hasEvent, logActivationEvent, type ActivationEvent } from "@/lib/activation-events";

export type CelebrationTier =
  | "report_rendered" // subtle motion — no confetti
  | "first_draft_saved" // toast — no confetti
  | "first_draft_published" // toast — no confetti
  | "first_mention" // full-screen modal + confetti + share card
  | "first_competitor_beat" // full-screen modal + share card
  | "score_50" // full-screen modal + share card
  | "score_75"; // certificate PDF

export type Celebration = {
  tier: CelebrationTier;
  headline: string;
  detail: string;
  shareTitle: string;
  shareSubtitle: string;
  shareable: boolean; // tiers ≥ first_mention are shareable
  sentinelEvent: ActivationEvent;
};

const SENTINEL: Record<CelebrationTier, ActivationEvent> = {
  report_rendered: "celebrated_report_rendered",
  first_draft_saved: "celebrated_first_draft_saved",
  first_draft_published: "celebrated_first_draft_published",
  first_mention: "celebrated_first_mention",
  first_competitor_beat: "celebrated_first_competitor_beat",
  score_50: "celebrated_score_50",
  score_75: "celebrated_score_75",
};

// Build the display copy for a tier. All copy is grounded — no hyperbole,
// no "amazing!" — just the fact and its implication.
export function describeCelebration(params: {
  tier: CelebrationTier;
  brandName: string;
  engine?: string;
  competitorName?: string;
  score?: number;
}): Celebration {
  const { tier, brandName, engine, competitorName, score } = params;
  switch (tier) {
    case "report_rendered":
      return {
        tier,
        headline: `${brandName}, meet your AI Visibility score.`,
        detail: "This is your baseline. It'll move with every draft you ship.",
        shareTitle: brandName,
        shareSubtitle: "AI Visibility scan complete",
        shareable: false,
        sentinelEvent: SENTINEL[tier],
      };
    case "first_draft_saved":
      return {
        tier,
        headline: "Draft saved.",
        detail: "Fill in the [ADD …] facts and Copilot will queue it for a citability check.",
        shareTitle: brandName,
        shareSubtitle: "First draft in progress",
        shareable: false,
        sentinelEvent: SENTINEL[tier],
      };
    case "first_draft_published":
      return {
        tier,
        headline: "Published. We'll retest in 48h.",
        detail: "If ChatGPT, Perplexity, or Gemini picks it up, you'll get an alert.",
        shareTitle: brandName,
        shareSubtitle: "First page live",
        shareable: false,
        sentinelEvent: SENTINEL[tier],
      };
    case "first_mention":
      return {
        tier,
        headline: `${brandName} just appeared in ${engine ?? "an AI answer"}.`,
        detail: "This is the moment. Double down on the angle that worked.",
        shareTitle: `${brandName} is being recommended by AI.`,
        shareSubtitle: engine ? `Now appearing in ${engine}` : "First mention detected",
        shareable: true,
        sentinelEvent: SENTINEL[tier],
      };
    case "first_competitor_beat":
      return {
        tier,
        headline: `You beat ${competitorName ?? "your competitor"} on a prompt.`,
        detail: "First time. Keep the pressure on.",
        shareTitle: `${brandName} > ${competitorName ?? "the competition"}`,
        shareSubtitle: "AI is recommending us now",
        shareable: true,
        sentinelEvent: SENTINEL[tier],
      };
    case "score_50":
      return {
        tier,
        headline: `${brandName} crossed a 50 visibility score.`,
        detail: "You're now above the average brand we track.",
        shareTitle: `${brandName}: 50+ AI Visibility`,
        shareSubtitle: "Recommended by AI more often than not",
        shareable: true,
        sentinelEvent: SENTINEL[tier],
      };
    case "score_75":
      return {
        tier,
        headline: `${brandName} crossed a 75 visibility score.`,
        detail: `Top tier — score ${score ?? 75}. Certificate PDF is in your inbox.`,
        shareTitle: `${brandName}: 75+ AI Visibility`,
        shareSubtitle: "Top-tier presence across AI search",
        shareable: true,
        sentinelEvent: SENTINEL[tier],
      };
  }
}

// Given the freshly-recorded events, decide if any celebration should
// fire. Returns null if none is due. Small, dependency-injectable so
// callers can pre-load state and avoid redundant queries.
export function selectCelebration(input: {
  events: Set<string>;
  brandScore: number;
  firstMentionEngine: string | null;
  firstCompetitorBeat: string | null;
}): CelebrationTier | null {
  const { events, brandScore, firstMentionEngine, firstCompetitorBeat } = input;

  if (brandScore >= 75 && !events.has(SENTINEL.score_75)) return "score_75";
  if (brandScore >= 50 && !events.has(SENTINEL.score_50)) return "score_50";
  if (firstCompetitorBeat && !events.has(SENTINEL.first_competitor_beat)) return "first_competitor_beat";
  if (firstMentionEngine && !events.has(SENTINEL.first_mention)) return "first_mention";
  if (events.has("first_draft_saved") && !events.has(SENTINEL.first_draft_saved)) return "first_draft_saved";
  if (events.has("scan_completed") && !events.has(SENTINEL.report_rendered)) return "report_rendered";
  return null;
}

// Persist the sentinel so the same modal never fires twice.
export async function markCelebrated(params: {
  userId: string;
  brandId: string;
  tier: CelebrationTier;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await logActivationEvent({
    event: SENTINEL[params.tier],
    userId: params.userId,
    brandId: params.brandId,
    payload: params.payload,
  });
}

// End-to-end: evaluate for a brand+user pair and return the celebration
// to render (if any). Used by the celebrations client hook — kept out of
// hot paths so a slow query never blocks the primary render.
export async function evaluateCelebration(params: {
  userId: string;
  brandId: string;
}): Promise<Celebration | null> {
  const { userId, brandId } = params;
  const svc = createServiceClient();
  const [{ data: brand }, { data: eventsRows }, { data: runs }] = await Promise.all([
    svc.from("brands").select("name").eq("id", brandId).single(),
    svc.from("activation_events").select("event").eq("user_id", userId),
    svc
      .from("visibility_runs")
      .select("brand_mentioned, competitor_mentions, engine_id, engines!inner(name)")
      .in(
        "prompt_id",
        (
          await svc.from("prompts").select("id").eq("brand_id", brandId)
        ).data?.map((r) => r.id) ?? [],
      ),
  ]);

  const events = new Set((eventsRows ?? []).map((e) => e.event));
  const totalAnswers = runs?.length ?? 0;
  const mentioned = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const brandScore = totalAnswers ? Math.round((mentioned / totalAnswers) * 100) : 0;

  const firstMentionRun = (runs ?? []).find((r) => r.brand_mentioned);
  const firstMentionEngine = firstMentionRun
    ? ((Array.isArray(firstMentionRun.engines) ? firstMentionRun.engines[0] : firstMentionRun.engines) as { name?: string })?.name ?? null
    : null;

  // "Beat a competitor" = a run where our brand is mentioned and at
  // least one tracked competitor is present but NOT mentioned.
  const beatRun = (runs ?? []).find((r) => {
    if (!r.brand_mentioned) return false;
    const cm = Array.isArray(r.competitor_mentions) ? r.competitor_mentions : [];
    return cm.some((c: { mentioned?: boolean }) => c.mentioned === false);
  });
  let firstCompetitorBeat: string | null = null;
  if (beatRun) {
    const cm = Array.isArray(beatRun.competitor_mentions) ? beatRun.competitor_mentions : [];
    const missed = cm.find((c: { name?: string; mentioned?: boolean }) => c.mentioned === false);
    firstCompetitorBeat = (missed as { name?: string } | undefined)?.name ?? null;
  }

  const tier = selectCelebration({ events, brandScore, firstMentionEngine, firstCompetitorBeat });
  if (!tier) return null;

  const brandName = brand?.name ?? "Your brand";
  return describeCelebration({
    tier,
    brandName,
    engine: firstMentionEngine ?? undefined,
    competitorName: firstCompetitorBeat ?? undefined,
    score: brandScore,
  });
}

// Delegates to hasEvent for one-shot guards on the client (via an API route).
export async function isTierCelebrated(params: {
  userId: string;
  brandId: string;
  tier: CelebrationTier;
}): Promise<boolean> {
  return hasEvent(params.userId, params.brandId, SENTINEL[params.tier]);
}
