// ============================================================
// benchmark-engine.ts — IO layer for the AI Industry Benchmark warehouse.
//
// SERVICE client only (trusted, background work: snapshot compute, cron
// aggregation). User-facing "your position" reads are authorized by the API
// route resolving the user's selected brandId and passing it here — the
// engine never reads customer data for a brand it wasn't given.
//
// Pipeline: visibility_runs → benchmark_brand_snapshots (attributed, per-brand)
// → benchmark_aggregates (anonymous, cross-brand, k-anon gated).
//
// All math lives in benchmark-metrics.ts (pure, tested). All normalization in
// industry-taxonomy.ts. All privacy gating in benchmark-privacy.ts. This file
// is IO + orchestration only.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";
import {
  normalizeIndustry,
  countryToRegion,
  coerceEnum,
  COMPANY_SIZES,
  TRAFFIC_BANDS,
  REVENUE_BANDS,
  type IndustryKey,
  type RegionKey,
  type CompanySize,
  type TrafficBand,
  type RevenueBand,
} from "@/lib/industry-taxonomy";
import { inferIntentFromText } from "@/lib/intent";
import {
  mean,
  stddev,
  percentile,
  min,
  max,
  recommendationRate,
  citationRate,
  trustScore,
  visibilityScore,
  type RunRecord,
} from "@/lib/benchmark-metrics";
import { isCellPublishable } from "@/lib/benchmark-privacy";

const ALL = "*";
export const BENCHMARK_METRICS = [
  "mention_rate",
  "citation_rate",
  "avg_position",
  "avg_trust",
  "avg_visibility",
] as const;
export type BenchmarkMetric = (typeof BENCHMARK_METRICS)[number];

export type PeriodType = "month";

type SnapshotMetrics = {
  mention_rate: number | null;
  citation_rate: number | null;
  avg_position: number | null;
  avg_trust: number | null;
  avg_visibility: number | null;
  run_count: number;
  prompt_count: number;
};

type RunRec = RunRecord & { engine_name: string; intent: string; language: string; prompt_id: string };

// ---------- helpers ----------

function svc() {
  return createServiceClient();
}

/** First day of the month following `periodStart` (a YYYY-MM-01 string). */
function nextMonth(periodStart: string): string {
  const [y, m] = periodStart.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m is 1-based month → next month
  return d.toISOString().slice(0, 10);
}

function metricsFor(runs: RunRec[]): SnapshotMetrics {
  const total = runs.length;
  if (total === 0) {
    return {
      mention_rate: null,
      citation_rate: null,
      avg_position: null,
      avg_trust: null,
      avg_visibility: null,
      run_count: 0,
      prompt_count: 0,
    };
  }
  const mentioned = runs.filter((r) => r.brand_mentioned === true).length;
  const cited = runs.filter((r) => r.has_own_citation).length;
  const positions = runs
    .filter((r) => r.brand_mentioned)
    .map((r) => r.brand_position)
    .filter((p): p is number => p != null);
  const trustVals = runs.map(trustScore);
  const visVals = runs.map(visibilityScore);
  return {
    mention_rate: recommendationRate(mentioned, total),
    citation_rate: citationRate(cited, total),
    avg_position: positions.length ? mean(positions) : null,
    avg_trust: mean(trustVals),
    avg_visibility: mean(visVals),
    run_count: total,
    prompt_count: new Set(runs.map((r) => r.prompt_id)).size,
  };
}

type SnapshotRow = {
  brand_id: string;
  period_start: string;
  period_type: PeriodType;
  engine: string;
  intent: string;
  language: string;
  industry_category: IndustryKey;
  region: RegionKey;
  country: string | null;
  company_size: CompanySize | null;
  traffic_band: TrafficBand | null;
  revenue_band: RevenueBand | null;
} & SnapshotMetrics;

// ---------- write path: per-brand snapshot ----------

export async function computeBrandSnapshot(
  brandId: string,
  periodStart: string,
  periodType: PeriodType = "month",
): Promise<{ computed: number; skipped: boolean }> {
  const supabase = svc();

  const { data: brand } = await supabase
    .from("brands")
    .select("industry, country, company_size, traffic_band, revenue_band, benchmark_opt_in")
    .eq("id", brandId)
    .single();

  if (!brand) return { computed: 0, skipped: true };
  if (brand.benchmark_opt_in === false) return { computed: 0, skipped: true };

  const industry_category = normalizeIndustry(brand.industry);
  const region = countryToRegion(brand.country);
  const country = brand.country ?? null;
  const companySize = coerceEnum(COMPANY_SIZES, brand.company_size);
  const trafficBand = coerceEnum(TRAFFIC_BANDS, brand.traffic_band);
  const revenueBand = coerceEnum(REVENUE_BANDS, brand.revenue_band);

  // Cache normalized industry on the brand row for convenience.
  await supabase.from("brands").update({ industry_category }).eq("id", brandId);

  // Prompts for this brand (to scope runs).
  const { data: promptRows } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", brandId);
  const promptIds = (promptRows ?? []).map((p: any) => p.id);
  if (promptIds.length === 0) return { computed: 0, skipped: false };

  const periodEnd = nextMonth(periodStart);
  const { data: runs } = await supabase
    .from("visibility_runs")
    .select(
      "id, brand_mentioned, brand_position, sentiment, recommendation_alignment, engine_id, engines(name), prompt_id, prompts(language, text)",
    )
    .in("prompt_id", promptIds)
    .gte("run_at", periodStart)
    .lt("run_at", periodEnd);

  if (!runs || runs.length === 0) return { computed: 0, skipped: false };

  const runIds = (runs as any[]).map((r) => r.id);
  const { data: cites } = await supabase
    .from("citations")
    .select("run_id, is_own_domain")
    .in("run_id", runIds);

  const ownCitationByRun = new Map<string, boolean>();
  for (const c of cites ?? []) {
    if (c.is_own_domain === true) ownCitationByRun.set(c.run_id, true);
  }

  const recs: RunRec[] = (runs as any[]).map((r) => {
    const engineName = Array.isArray(r.engines) ? r.engines[0]?.name : r.engines?.name ?? "unknown";
    const prompt = Array.isArray(r.prompts) ? r.prompts[0] : r.prompts;
    const text: string = prompt?.text ?? "";
    const language: string = prompt?.language ?? "en";
    return {
      engine_name: engineName,
      intent: inferIntentFromText(text),
      language,
      prompt_id: r.prompt_id,
      brand_mentioned: r.brand_mentioned,
      brand_position: r.brand_position,
      sentiment: r.sentiment,
      recommendation_alignment: r.recommendation_alignment,
      has_own_citation: ownCitationByRun.get(r.id) === true,
    };
  });

  const base = {
    brand_id: brandId,
    period_start: periodStart,
    period_type: periodType,
    industry_category,
    region,
    country,
    company_size: companySize,
    traffic_band: trafficBand,
    revenue_band: revenueBand,
  };

  const rows: SnapshotRow[] = [];

  // Overall (across all axes).
  rows.push({ ...base, engine: ALL, intent: ALL, language: ALL, ...metricsFor(recs) });

  // Per engine.
  for (const engine of Array.from(new Set(recs.map((r) => r.engine_name)))) {
    rows.push({ ...base, engine, intent: ALL, language: ALL, ...metricsFor(recs.filter((r) => r.engine_name === engine)) });
  }
  // Per intent.
  for (const intent of Array.from(new Set(recs.map((r) => r.intent)))) {
    rows.push({ ...base, engine: ALL, intent, language: ALL, ...metricsFor(recs.filter((r) => r.intent === intent)) });
  }
  // Per language.
  for (const language of Array.from(new Set(recs.map((r) => r.language)))) {
    rows.push({ ...base, engine: ALL, intent: ALL, language, ...metricsFor(recs.filter((r) => r.language === language)) });
  }

  const { error } = await supabase.from("benchmark_brand_snapshots").upsert(
    rows.map((r) => ({ ...r })),
    { onConflict: "brand_id,period_start,period_type,engine,intent,language" },
  );
  if (error) throw error;

  return { computed: rows.length, skipped: false };
}

// ---------- write path: cross-brand aggregation ----------

type AggInput = {
  brand_id: string;
  engine: string;
  intent: string;
  language: string;
  industry_category: string;
  region: string;
  country: string | null;
  company_size: string | null;
  traffic_band: string | null;
  revenue_band: string | null;
  mention_rate: number | null;
  citation_rate: number | null;
  avg_position: number | null;
  avg_trust: number | null;
  avg_visibility: number | null;
  run_count: number;
};

function aggregateCell(
  rows: AggInput[],
  periodStart: string,
  periodType: PeriodType,
  dimensionType: string,
  dimensionValue: string,
  engineScope: string | null,
): any[] {
  const brandCount = new Set(rows.map((r) => r.brand_id)).size;
  const out: any[] = [];
  for (const metric of BENCHMARK_METRICS) {
    const vals = rows
      .map((r) => (r as any)[metric])
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    out.push({
      period_start: periodStart,
      period_type: periodType,
      dimension_type: dimensionType,
      dimension_value: dimensionValue,
      engine: engineScope,
      metric,
      brand_count: brandCount,
      avg: mean(vals),
      p10: percentile(vals, 10),
      p25: percentile(vals, 25),
      p50: percentile(vals, 50),
      p75: percentile(vals, 75),
      p90: percentile(vals, 90),
      min: min(vals),
      max: max(vals),
      stddev: stddev(vals),
      total_observations: rows.reduce((acc, r) => acc + (r.run_count ?? 0), 0),
      published: isCellPublishable(brandCount),
      computed_at: new Date().toISOString(),
    });
  }
  return out;
}

export async function aggregateBenchmarks(
  periodStart: string,
  periodType: PeriodType = "month",
): Promise<{ cells: number }> {
  const supabase = svc();

  const { data: overallRows, error } = await supabase
    .from("benchmark_brand_snapshots")
    .select(
      "brand_id, engine, intent, language, industry_category, region, country, company_size, traffic_band, revenue_band, mention_rate, citation_rate, avg_position, avg_trust, avg_visibility, run_count",
    )
    .eq("period_start", periodStart)
    .eq("period_type", periodType)
    .eq("engine", ALL)
    .eq("intent", ALL)
    .eq("language", ALL)
    .gt("run_count", 0);

  if (error) throw error;
  const rows = (overallRows ?? []) as AggInput[];
  if (rows.length === 0) return { cells: 0 };

  const cells: any[] = [];

  // Overall
  cells.push(...aggregateCell(rows, periodStart, periodType, "overall", "all", null));

  // Single-dimension groupings from brand-level rows.
  const groupBy = (
    key: (r: AggInput) => string | null,
    dimensionType: string,
  ) => {
    const map = new Map<string, AggInput[]>();
    for (const r of rows) {
      const v = key(r);
      if (!v) continue;
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(r);
    }
    for (const [value, group] of map) {
      cells.push(...aggregateCell(group, periodStart, periodType, dimensionType, value, null));
    }
  };

  groupBy((r) => r.industry_category, "industry");
  groupBy((r) => r.region, "region");
  groupBy((r) => r.country, "country");
  groupBy((r) => r.company_size, "company_size");
  groupBy((r) => r.traffic_band, "traffic_band");
  groupBy((r) => r.revenue_band, "revenue_band");

  // Engine (pure) + industry×engine cross-cut, from per-engine rows.
  const { data: engineRows } = await supabase
    .from("benchmark_brand_snapshots")
    .select(
      "brand_id, engine, intent, language, industry_category, region, country, company_size, traffic_band, revenue_band, mention_rate, citation_rate, avg_position, avg_trust, avg_visibility, run_count",
    )
    .eq("period_start", periodStart)
    .eq("period_type", periodType)
    .neq("engine", ALL)
    .eq("intent", ALL)
    .eq("language", ALL)
    .gt("run_count", 0);

  for (const er of (engineRows ?? []) as AggInput[]) {
    // pure engine
    cells.push(...aggregateCell([er], periodStart, periodType, "engine", er.engine, er.engine));
    // industry × engine
    cells.push(...aggregateCell([er], periodStart, periodType, "industry", er.industry_category, er.engine));
  }

  // Intent (pure) + industry×intent.
  const { data: intentRows } = await supabase
    .from("benchmark_brand_snapshots")
    .select(
      "brand_id, engine, intent, language, industry_category, region, country, company_size, traffic_band, revenue_band, mention_rate, citation_rate, avg_position, avg_trust, avg_visibility, run_count",
    )
    .eq("period_start", periodStart)
    .eq("period_type", periodType)
    .eq("engine", ALL)
    .neq("intent", ALL)
    .eq("language", ALL)
    .gt("run_count", 0);

  for (const ir of (intentRows ?? []) as AggInput[]) {
    cells.push(...aggregateCell([ir], periodStart, periodType, "intent", ir.intent, null));
    cells.push(...aggregateCell([ir], periodStart, periodType, "industry", ir.industry_category, null));
    // Note: industry×intent cross-cut intentionally omitted for MVP (kept to single extra axis).
  }

  // Language (pure) + industry×language.
  const { data: langRows } = await supabase
    .from("benchmark_brand_snapshots")
    .select(
      "brand_id, engine, intent, language, industry_category, region, country, company_size, traffic_band, revenue_band, mention_rate, citation_rate, avg_position, avg_trust, avg_visibility, run_count",
    )
    .eq("period_start", periodStart)
    .eq("period_type", periodType)
    .eq("engine", ALL)
    .eq("intent", ALL)
    .neq("language", ALL)
    .gt("run_count", 0);

  for (const lr of (langRows ?? []) as AggInput[]) {
    cells.push(...aggregateCell([lr], periodStart, periodType, "language", lr.language, null));
    cells.push(...aggregateCell([lr], periodStart, periodType, "industry", lr.industry_category, null));
  }

  // Upsert all cells (onConflict preserves idempotency across cron re-runs).
  const { error: upsertErr } = await supabase.from("benchmark_aggregates").upsert(cells, {
    onConflict: "period_start,period_type,dimension_type,dimension_value,engine,metric",
  });
  if (upsertErr) throw upsertErr;

  return { cells: cells.length };
}

// ---------- read path: cells / your position / leaderboard / trend ----------

export type BenchmarkCell = {
  period_start: string;
  dimension_type: string;
  dimension_value: string;
  engine: string | null;
  metric: string;
  brand_count: number;
  avg: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
  stddev: number | null;
  total_observations: number;
  published: boolean;
};

/** Read a single published aggregate cell (or null). Privacy-gated. */
export async function getBenchmarkCell(opts: {
  dimensionType: string;
  dimensionValue: string;
  engine?: string | null;
  metric: string;
  periodStart: string;
}): Promise<BenchmarkCell | null> {
  const supabase = svc();
  let q = supabase
    .from("benchmark_aggregates")
    .select("*")
    .eq("dimension_type", opts.dimensionType)
    .eq("dimension_value", opts.dimensionValue)
    .eq("metric", opts.metric)
    .eq("period_start", opts.periodStart)
    .eq("published", true);
  if (opts.engine === null) q = q.is("engine", null);
  else if (opts.engine) q = q.eq("engine", opts.engine);
  const { data } = await q.limit(1);
  return (data && data[0]) || null;
}

/** Approximate a value's percentile rank from the stored p10..p90 bands. */
export function approxPercentileFromBands(
  value: number,
  bands: { p10: number | null; p25: number | null; p50: number | null; p75: number | null; p90: number | null },
): number {
  const marks: [number, number][] = [
    [10, bands.p10 ?? 0],
    [25, bands.p25 ?? bands.p10 ?? 0],
    [50, bands.p50 ?? bands.p25 ?? 0],
    [75, bands.p75 ?? bands.p50 ?? 0],
    [90, bands.p90 ?? bands.p75 ?? 0],
  ];
  if (value <= marks[0][1]) return 10 * (value / (marks[0][1] || 1));
  for (let i = 1; i < marks.length; i++) {
    if (value <= marks[i][1]) {
      const [pLo, vLo] = marks[i - 1];
      const [pHi, vHi] = marks[i];
      if (vHi === vLo) return pHi;
      return pLo + ((value - vLo) / (vHi - vLo)) * (pHi - pLo);
    }
  }
  return 100;
}

export type YourPosition = {
  brandId: string;
  dimensionType: string;
  dimensionValue: string;
  engine: string | null;
  metric: string;
  yourValue: number | null;
  benchmarkAvg: number | null;
  benchmarkMedian: number | null;
  topDecile: number | null;
  percentile: number | null;
  brandCount: number;
  published: boolean;
};

/** Where the brand sits vs the anonymous benchmark for a metric. */
export async function getYourPosition(opts: {
  brandId: string;
  dimensionType: string;
  dimensionValue: string;
  engine?: string | null;
  metric: string;
  periodStart: string;
}): Promise<YourPosition> {
  const supabase = svc();

  // Brand's own metric for the period (overall row).
  const { data: own } = await supabase
    .from("benchmark_brand_snapshots")
    .select("mention_rate, citation_rate, avg_position, avg_trust, avg_visibility")
    .eq("brand_id", opts.brandId)
    .eq("period_start", opts.periodStart)
    .eq("engine", ALL)
    .eq("intent", ALL)
    .eq("language", ALL)
    .limit(1);
  const yourValue = own && own[0] ? ((own[0] as any)[opts.metric] as number | null) ?? null : null;

  const cell = await getBenchmarkCell(opts);
  if (!cell || !cell.published) {
    return {
      brandId: opts.brandId,
      dimensionType: opts.dimensionType,
      dimensionValue: opts.dimensionValue,
      engine: opts.engine ?? null,
      metric: opts.metric,
      yourValue,
      benchmarkAvg: null,
      benchmarkMedian: null,
      topDecile: null,
      percentile: null,
      brandCount: cell?.brand_count ?? 0,
      published: false,
    };
  }

  const percentile =
    yourValue == null ? null : approxPercentileFromBands(yourValue, cell);

  return {
    brandId: opts.brandId,
    dimensionType: opts.dimensionType,
    dimensionValue: opts.dimensionValue,
    engine: opts.engine ?? null,
    metric: opts.metric,
    yourValue,
    benchmarkAvg: cell.avg,
    benchmarkMedian: cell.p50,
    topDecile: cell.p90,
    percentile,
    brandCount: cell.brand_count,
    published: true,
  };
}

/** Ranked dimension values for a metric (anonymous leaderboard / comparison). */
export async function getLeaderboard(opts: {
  dimensionType: string;
  metric?: string;
  engine?: string | null;
  periodStart: string;
  limit?: number;
}): Promise<BenchmarkCell[]> {
  const supabase = svc();
  let q = supabase
    .from("benchmark_aggregates")
    .select("*")
    .eq("dimension_type", opts.dimensionType)
    .eq("metric", opts.metric ?? "avg_visibility")
    .eq("period_start", opts.periodStart)
    .eq("published", true)
    .order("avg", { ascending: false });
  if (opts.engine === null) q = q.is("engine", null);
  else if (opts.engine) q = q.eq("engine", opts.engine);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as BenchmarkCell[];
}

/** Multi-month series for one cell (historical comparison). */
export async function getHistoricalTrend(opts: {
  dimensionType: string;
  dimensionValue: string;
  metric: string;
  engine?: string | null;
  months?: number;
}): Promise<{ period_start: string; avg: number | null; brand_count: number }[]> {
  const supabase = svc();
  let q = supabase
    .from("benchmark_aggregates")
    .select("period_start, avg, brand_count")
    .eq("dimension_type", opts.dimensionType)
    .eq("dimension_value", opts.dimensionValue)
    .eq("metric", opts.metric)
    .eq("published", true)
    .order("period_start", { ascending: true });
  if (opts.engine === null) q = q.is("engine", null);
  else if (opts.engine) q = q.eq("engine", opts.engine);
  if (opts.months) q = q.limit(opts.months);
  const { data } = await q;
  return (data ?? []).map((d: any) => ({
    period_start: d.period_start,
    avg: d.avg,
    brand_count: d.brand_count,
  }));
}

/** The brand's own metric across months (your-position history). */
export async function getBrandTrend(opts: {
  brandId: string;
  metric: string;
  months?: number;
}): Promise<{ period_start: string; value: number | null }[]> {
  const supabase = svc();
  let q = supabase
    .from("benchmark_brand_snapshots")
    .select(`period_start, ${opts.metric}`)
    .eq("brand_id", opts.brandId)
    .eq("engine", ALL)
    .eq("intent", ALL)
    .eq("language", ALL)
    .gt("run_count", 0)
    .order("period_start", { ascending: true });
  if (opts.months) q = q.limit(opts.months);
  const { data } = await q;
  return (data ?? []).map((d: any) => ({ period_start: d.period_start, value: d[opts.metric] ?? null }));
}

// ---------- failure-isolated wrappers (for cron / hot path) ----------

export async function safeComputeBrandSnapshot(
  brandId: string,
  periodStart: string,
  periodType: PeriodType = "month",
): Promise<void> {
  try {
    await computeBrandSnapshot(brandId, periodStart, periodType);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("benchmark snapshot failed"), {
      context: "computeBrandSnapshot",
      brandId,
      periodStart,
    });
  }
}

export async function safeAggregateBenchmarks(
  periodStart: string,
  periodType: PeriodType = "month",
): Promise<void> {
  try {
    await aggregateBenchmarks(periodStart, periodType);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("benchmark aggregation failed"), {
      context: "aggregateBenchmarks",
      periodStart,
    });
  }
}

/**
 * Lightweight hot-path hook: marks the brand's current-month snapshot as
 * stale by simply ensuring the snapshot exists for recompute. The heavy
 * aggregation is owned by the daily cron, so this never does aggregate work
 * inline. Failure-isolated: a benchmark error must never break a visibility run.
 */
export async function safeMarkBenchmarkDirty(brandId: string, periodStart: string): Promise<void> {
  // No-op by design — the daily cron (computeBrandSnapshot + aggregateBenchmarks)
  // is the source of truth. Kept as an explicit, failure-isolated seam so the
  // visibility-engine hook is a deliberate, documented call site.
  void brandId;
  void periodStart;
}
