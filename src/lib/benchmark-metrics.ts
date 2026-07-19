// ============================================================
// benchmark-metrics.ts — PURE, deterministic benchmark math.
//
// No IO, no Date.now(), no randomness. Every function takes inputs and
// returns numbers (or null when undefined). Fully unit-tested
// (benchmark-metrics.test.ts). The engine layer feeds real visibility_run
// rows into these; the aggregation layer feeds arrays of brand-level values
// into percentile/mean/stddev. Keeping all math here means we can verify the
// benchmark numbers without a database.
// ============================================================

export type RunRecord = {
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
  has_own_citation: boolean;
};

// ---------- basic stats ----------

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n-1). Returns 0 for n<=1, null for n=0. */
export function stddev(values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.length <= 1) return 0;
  const m = mean(values) as number;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Percentile via linear interpolation between closest ranks (the "R-7" /
 * Excel PERCENTILE.INC method). p in [0,100]. Empty input → null.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.min(100, Math.max(0, p));
  const rank = (clamped / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function min(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}
export function max(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

// ---------- rates ----------

/** mentioned / total. Null when there are no non-skipped runs. */
export function recommendationRate(mentioned: number, total: number): number | null {
  if (total <= 0) return null;
  return mentioned / total;
}

/** cited / total. Null when there are no non-skipped runs. */
export function citationRate(cited: number, total: number): number | null {
  if (total <= 0) return null;
  return cited / total;
}

/** Period-over-period delta in percentage points. Null if either side missing. */
export function growth(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null) return null;
  return current - prior;
}

/** Period-over-period relative growth as a ratio (e.g. 0.2 = +20%). */
export function growthPct(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

// ---------- per-observation scores (0..1) ----------

function scoreFromEnum(
  value: string | null,
  good: string,
  bad: string,
): number {
  if (!value) return 0.5; // neutral / unknown
  const v = value.toLowerCase();
  if (v === good) return 1;
  if (v === bad) return 0;
  return 0.5;
}

/** Position score: rank 1 → 1.0, linearly to 0 by rank 11. Unmentioned → 0. */
export function positionScore(mentioned: boolean | null, position: number | null): number {
  if (!mentioned) return 0;
  if (position == null || position <= 1) return 1;
  return Math.max(0, 1 - (position - 1) / 10);
}

/**
 * AI Trust Score for a single observation, in [0,1].
 * Unmentioned → 0. Mentioned → 0.4 base + 0.3*sentiment + 0.3*alignment.
 *   mentioned & positive & aligned        → 1.0
 *   mentioned & neutral & neutral         → 0.7
 *   mentioned & negative & misaligned     → 0.4
 */
export function trustScore(run: RunRecord): number {
  if (!run.brand_mentioned) return 0;
  const sentiment = scoreFromEnum(run.sentiment, "positive", "negative");
  const alignment = scoreFromEnum(run.recommendation_alignment, "aligned", "misaligned");
  return 0.4 + 0.3 * sentiment + 0.3 * alignment;
}

/**
 * Composite visibility score for a single observation, in [0,1]:
 * mention present (0.6) weighted by how high it ranked (0.4).
 */
export function visibilityScore(run: RunRecord): number {
  if (!run.brand_mentioned) return 0;
  return 0.6 + 0.4 * positionScore(true, run.brand_position);
}

// ---------- period bucketing ----------

/** First day of the month containing `date`, as a YYYY-MM-DD string. */
export function bucketMonth(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export type PeriodType = "month";

export const PERIOD_TYPES: PeriodType[] = ["month"];
