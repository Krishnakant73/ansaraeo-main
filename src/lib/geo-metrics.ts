// Geo-metrics engine — derives normalized, decision-ready scores from raw
// visibility_runs + citations. Pure and deterministic: no DB, no fetch, no LLM.
// This is the single place the product computes "are we cited / recommended /
// growing / beating competitors" so the dashboard, API, snapshots, and PDF all
// agree and can evolve without touching the raw pipeline.
//
// All metrics are computed only from recorded data — missing months/runs are
// never estimated (honesty design).

import type { IntentKey } from "./intent";

export type GeoRun = {
  id: string;
  prompt_id: string;
  engine_id: string | null;
  run_at: string; // ISO timestamp
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null; // 'aligned' | 'misaligned' | 'neutral' | null
};

export type GeoCitation = {
  id: string;
  run_id: string;
  cited_domain: string | null;
  cited_url: string | null;
  is_own_domain: boolean | null;
  is_competitor_domain: boolean | null;
  is_trusted_source: boolean | null;
};

export type EngineInfo = { id: string; name: string };

export type GeoMetricsInput = {
  runs: GeoRun[];
  citations: GeoCitation[];
  engines: EngineInfo[];
  // prompt_id -> canonical intent, so we can bucket by funnel stage
  promptIntent?: Record<string, IntentKey | null>;
  // prior-window runs, used only to derive trend_velocity (current - prior)
  priorRuns?: GeoRun[];
};

export type EngineMetrics = {
  visibility_rate: number | null;
  citation_share: number | null;
  avg_rank: number | null;
};

export type IntentMetrics = {
  visibility_rate: number | null;
  citation_rate: number | null;
};

export type GeoMetrics = {
  visibility_rate: number | null;
  citation_rate: number | null;
  citation_share: number | null;
  avg_rank: number | null;
  sentiment_score: number | null;
  model_divergence: number | null;
  recommendation_quality: number | null;
  trend_velocity: number | null;
  per_engine: Record<string, EngineMetrics>;
  by_intent: Record<string, IntentMetrics>;
  totals: {
    runs: number;
    citations: number;
    own_citations: number;
    competitor_citations: number;
    third_party_citations: number;
  };
};

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 100) : null;

const mean = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;

// Population standard deviation — used for model divergence (how much engines
// disagree about the brand).
function stdDev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

function sentimentComposite(sentiment: string | null | undefined): number {
  const s = (sentiment || "").toLowerCase();
  if (s.includes("pos")) return 1;
  if (s.includes("neg")) return -1;
  return 0;
}

export function computeGeoMetrics(input: GeoMetricsInput): GeoMetrics {
  const { runs, citations, engines, promptIntent = {}, priorRuns = [] } = input;

  const totalRuns = runs.length;
  const mentionedRuns = runs.filter((r) => r.brand_mentioned).length;
  const alignedRuns = runs.filter((r) => r.recommendation_alignment === "aligned").length;

  // --- Citations aggregation ---
  const runIds = new Set(runs.map((r) => r.id));
  const scopedCitations = citations.filter((c) => runIds.has(c.run_id));
  const totalCitations = scopedCitations.length;
  const ownCitations = scopedCitations.filter((c) => c.is_own_domain).length;
  const competitorCitations = scopedCitations.filter((c) => c.is_competitor_domain).length;
  const thirdPartyCitations = totalCitations - ownCitations - competitorCitations;

  // A run "cited" = it produced at least one own-domain citation for the brand.
  const runIdsWithOwnCitation = new Set(
    scopedCitations.filter((c) => c.is_own_domain).map((c) => c.run_id),
  );
  const citedRuns = runs.filter((r) => runIdsWithOwnCitation.has(r.id)).length;

  // --- Rank ---
  const positions = runs
    .filter((r) => r.brand_mentioned && typeof r.brand_position === "number")
    .map((r) => r.brand_position as number);
  const avgRank = mean(positions);

  // --- Sentiment score (0–100; -1..+1 mapped to 0..100) ---
  let sentSum = 0;
  for (const r of runs) sentSum += sentimentComposite(r.sentiment);
  const sentimentScore =
    totalRuns > 0 ? Math.round(((sentSum / totalRuns) + 1) * 50) : null;

  // --- Per-engine breakdown (model benchmarking) ---
  const engineName = new Map(engines.map((e) => [e.id, e.name]));
  const perEngine: Record<string, EngineMetrics> = {};
  const engineRates: number[] = [];
  for (const e of engines) {
    const eRuns = runs.filter((r) => r.engine_id === e.id);
    if (!eRuns.length) continue;
    const eMentioned = eRuns.filter((r) => r.brand_mentioned).length;
    const eRunIds = new Set(eRuns.map((r) => r.id));
    const eCites = scopedCitations.filter((c) => eRunIds.has(c.run_id));
    const eOwn = eCites.filter((c) => c.is_own_domain).length;
    const ePositions = eRuns
      .filter((r) => r.brand_mentioned && typeof r.brand_position === "number")
      .map((r) => r.brand_position as number);
    const visRate = pct(eMentioned, eRuns.length);
    if (visRate !== null) engineRates.push(visRate);
    perEngine[e.name] = {
      visibility_rate: visRate,
      citation_share: pct(eOwn, eCites.length),
      avg_rank: mean(ePositions),
    };
  }
  const modelDivergence = stdDev(engineRates);

  // --- By-intent breakdown (funnel-stage aware) ---
  const byIntent: Record<string, IntentMetrics> = {};
  const intentKeys = new Set(Object.values(promptIntent).filter(Boolean) as IntentKey[]);
  for (const intent of intentKeys) {
    const iPromptIds = new Set(
      Object.entries(promptIntent)
        .filter(([, v]) => v === intent)
        .map(([pid]) => pid),
    );
    const iRuns = runs.filter((r) => iPromptIds.has(r.prompt_id));
    if (!iRuns.length) continue;
    const iMentioned = iRuns.filter((r) => r.brand_mentioned).length;
    const iRunIds = new Set(iRuns.map((r) => r.id));
    const iOwn = scopedCitations.filter((c) => iRunIds.has(c.run_id) && c.is_own_domain).length;
    byIntent[intent] = {
      visibility_rate: pct(iMentioned, iRuns.length),
      citation_rate: pct(iOwn, iRuns.length),
    };
  }

  // --- Trend velocity (current window minus prior window, percentage points) ---
  const currentVisibility = pct(mentionedRuns, totalRuns);
  const priorMentioned = priorRuns.filter((r) => r.brand_mentioned).length;
  const priorVisibility = pct(priorMentioned, priorRuns.length);
  const trendVelocity =
    currentVisibility !== null && priorVisibility !== null
      ? currentVisibility - priorVisibility
      : null;

  return {
    visibility_rate: currentVisibility,
    citation_rate: pct(citedRuns, totalRuns),
    citation_share: pct(ownCitations, totalCitations),
    avg_rank: avgRank,
    sentiment_score: sentimentScore,
    model_divergence: modelDivergence,
    recommendation_quality: pct(alignedRuns, mentionedRuns),
    trend_velocity: trendVelocity,
    per_engine: perEngine,
    by_intent: byIntent,
    totals: {
      runs: totalRuns,
      citations: totalCitations,
      own_citations: ownCitations,
      competitor_citations: competitorCitations,
      third_party_citations: thirdPartyCitations,
    },
  };
}

// Split a flat run list into two adjacent windows for trend velocity.
// `windowDays` defines the current window; the prior window is the equal span
// immediately before it. Only real recorded runs are used — never estimated.
export function splitWindows(
  runs: GeoRun[],
  windowDays: number,
  now: number = Date.now(),
): { current: GeoRun[]; prior: GeoRun[] } {
  const DAY = 86_400_000;
  const currentCutoff = now - windowDays * DAY;
  const priorCutoff = now - 2 * windowDays * DAY;
  const current: GeoRun[] = [];
  const prior: GeoRun[] = [];
  for (const r of runs) {
    const t = new Date(r.run_at).getTime();
    if (t >= currentCutoff) current.push(r);
    else if (t >= priorCutoff) prior.push(r);
  }
  return { current, prior };
}
