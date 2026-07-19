// ============================================================
// benchmark-trends.ts — L1 Trend Intelligence (pure + IO).
//
// Turns the benchmark_aggregates time-series into delta / change-point cells.
// The pure helpers are deterministic and unit-tested (no IO, no Date.now()).
// IO reads the historical aggregate series per (dimension, metric, engine)
// and writes benchmark_trend_cells (idempotent upsert by period).
//
// Honesty: a cell with a null prior (first month) emits delta=null and is
// never flagged as a change point — we never invent a baseline.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export type TrendDirection = "up" | "down" | "flat";

const FLAT_THRESHOLD = 0.005; // < 0.5pp absolute delta = flat

/** Pure: classify a delta into a direction. Null delta → flat. */
export function trendDirection(delta: number | null): TrendDirection {
  if (delta == null) return "flat";
  if (Math.abs(delta) < FLAT_THRESHOLD) return "flat";
  return delta > 0 ? "up" : "down";
}

/** Pure: standard score of `value` within `values`. Null if <2 samples. */
export function zScore(value: number, values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (value - mean) / sd;
}

export type TrendCell = {
  value: number | null;
  prior_value: number | null;
  delta: number | null;
  delta_pct: number | null;
  trend_direction: TrendDirection;
  change_point: boolean;
  z_score: number | null;
};

/**
 * Pure: compute a single trend cell from a chronologically-ordered series
 * (oldest→newest) for the latest point vs the previous point. Change point =
 * the latest value is >2σ from the preceding window (excluding the latest).
 */
export function computeTrendCell(series: number[]): TrendCell {
  if (series.length === 0) {
    return { value: null, prior_value: null, delta: null, delta_pct: null, trend_direction: "flat", change_point: false, z_score: null };
  }
  const value = series[series.length - 1];
  const prior = series.length > 1 ? series[series.length - 2] : null;
  const delta = prior == null ? null : value - prior;
  const delta_pct = prior != null && prior !== 0 ? (value - prior) / Math.abs(prior) : null;

  // z-score of latest vs the window BEFORE it
  const window = series.slice(0, -1);
  const z = value == null ? null : zScore(value, window.length >= 2 ? window : series);
  const changePoint = z != null && Math.abs(z) >= 2 && series.length >= 4;

  return {
    value,
    prior_value: prior,
    delta,
    delta_pct,
    trend_direction: trendDirection(delta),
    change_point: changePoint,
    z_score: z,
  };
}

// ---------- IO ----------

function svc() {
  return createServiceClient();
}

/**
 * For every published aggregate cell, compute the latest trend cell from its
 * multi-month series and upsert into benchmark_trend_cells. Runs in cron.
 */
export async function computeTrendCells(periodStart: string): Promise<{ cells: number }> {
  const supabase = svc();
  // Pull the metric series for all cells up to `periodStart`.
  const { data, error } = await supabase
    .from("benchmark_aggregates")
    .select("dimension_type, dimension_value, engine, metric, period_start, avg")
    .lte("period_start", periodStart)
    .eq("published", true)
    .order("period_start", { ascending: true });
  if (error) throw error;

  // Group into series by (dimension, value, engine, metric).
  const seriesMap = new Map<string, { period: string; avg: number | null }[]>();
  for (const row of (data ?? []) as any[]) {
    const k = `${row.dimension_type}|${row.dimension_value}|${row.engine ?? "*"}|${row.metric}`;
    if (!seriesMap.has(k)) seriesMap.set(k, []);
    seriesMap.get(k)!.push({ period: row.period_start, avg: row.avg });
  }

  const cells: any[] = [];
  for (const [k, pts] of seriesMap) {
    const [dimensionType, dimensionValue, engine, metric] = k.split("|");
    const numeric = pts.map((p) => p.avg).filter((v): v is number => typeof v === "number");
    const cell = computeTrendCell(numeric);
    cells.push({
      period_start: periodStart,
      period_type: "month",
      dimension_type: dimensionType,
      dimension_value: dimensionValue,
      engine: engine === "*" ? null : engine,
      metric,
      value: cell.value,
      prior_value: cell.prior_value,
      delta: cell.delta,
      delta_pct: cell.delta_pct,
      trend_direction: cell.trend_direction,
      change_point: cell.change_point,
      z_score: cell.z_score,
    });
  }

  if (cells.length > 0) {
    const { error: upsertErr } = await supabase.from("benchmark_trend_cells").upsert(cells, {
      onConflict: "period_start,period_type,dimension_type,dimension_value,engine,metric",
    });
    if (upsertErr) throw upsertErr;
  }
  return { cells: cells.length };
}

export async function safeComputeTrendCells(periodStart: string): Promise<void> {
  try {
    await computeTrendCells(periodStart);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("trend cells failed"), { context: "computeTrendCells" });
  }
}
