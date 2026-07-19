// ============================================================
// forecast-engine.ts — L1 AI Recommendation Forecast (pure + IO).
//
// Forecasts a monthly metric series forward `horizon` months using additive
// Holt smoothing (level + trend). Prediction intervals come from the residual
// std-dev scaled by sqrt(forecast step) — honest bands, never a bare point.
// Empirical uncertainty is also informed by the stored aggregate p10/p90 when
// available (the warehouse already carries percentile bands).
//
// Honesty gate: series shorter than MIN_HISTORY months → insufficient_history
// = true, confidence = 'low', and we still return a flat-ish projection but
// label it as low-confidence. We never fabricate precision we don't have.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";
import { bucketMonth } from "@/lib/benchmark-metrics";

export const MIN_HISTORY = 6;
export const Z = 1.96; // ~95% interval

export type ForecastPoint = { period: string; value: number };
export type ForecastResult = {
  point: ForecastPoint[];
  lower: ForecastPoint[];
  upper: ForecastPoint[];
  confidence: "low" | "medium" | "high";
  insufficient_history: boolean;
};

/** Advance a Date by `months` months, return YYYY-MM-01 string. */
function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1 + months).padStart(2, "0")}-01`;
}

/**
 * Pure additive Holt forecast. alpha=level smoothing, beta=trend smoothing.
 * Returns level/trend state + fitted residuals so callers can build bands.
 */
export function holtForecast(
  series: number[],
  horizon: number,
  alpha = 0.4,
  beta = 0.2,
): { forecast: number[]; level: number; trend: number; residuals: number[] } {
  if (series.length === 0) return { forecast: [], level: 0, trend: 0, residuals: [] };
  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;
  const residuals: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const predicted = level + trend;
    residuals.push(series[i] - predicted);
    const prevLevel = level;
    level = alpha * series[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    forecast.push(level + h * trend);
  }
  return { forecast, level, trend, residuals };
}

/** Residual standard deviation (sample). Null if <2 residuals. */
export function residualStd(residuals: number[]): number | null {
  if (residuals.length < 2) return null;
  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const variance = residuals.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (residuals.length - 1);
  return Math.sqrt(variance);
}

/** Clamp a forecast value into a plausible [0,1] metric range when requested. */
function clamp(v: number, bounds: { min?: number; max?: number } | undefined): number {
  let out = v;
  if (bounds?.min != null) out = Math.max(bounds.min, out);
  if (bounds?.max != null) out = Math.min(bounds.max, out);
  return out;
}

/**
 * Pure top-level forecast. `series` = chronological numeric values (oldest→
 * newest) with their period starts. Produces point + 95% lower/upper bands.
 * `bounds` clamps to metric domain (e.g. mention_rate is 0..1).
 */
export function etsForecast(
  series: { period: string; value: number }[],
  horizon: number,
  opts: { bounds?: { min?: number; max?: number }; empiricalP10P90?: { p10: number; p90: number } | null } = {},
): ForecastResult {
  const values = series.map((s) => s.value);
  const lastPeriod = series.length ? series[series.length - 1].period : bucketMonth(new Date());
  const insufficient = values.length < MIN_HISTORY;

  const { forecast, residuals } = holtForecast(values, horizon);
  const sd = residualStd(residuals);

  const point: ForecastPoint[] = [];
  const lower: ForecastPoint[] = [];
  const upper: ForecastPoint[] = [];

  for (let h = 1; h <= horizon; h++) {
    const raw = forecast[h - 1] ?? (values[values.length - 1] ?? 0);
    const period = addMonths(lastPeriod, h);
    const v = clamp(raw, opts.bounds);
    let halfWidth = 0;
    if (sd != null) halfWidth = Z * sd * Math.sqrt(h);
    // If the warehouse already carries empirical spread, widen to the larger
    // of model residual and empirical (p90-p10)/2 — honest about uncertainty.
    if (opts.empiricalP10P90) {
      const empHalf = (opts.empiricalP10P90.p90 - opts.empiricalP10P90.p10) / 2;
      halfWidth = Math.max(halfWidth, empHalf);
    }
    point.push({ period, value: v });
    lower.push({ period, value: clamp(v - halfWidth, opts.bounds) });
    upper.push({ period, value: clamp(v + halfWidth, opts.bounds) });
  }

  const confidence: ForecastResult["confidence"] = insufficient
    ? "low"
    : values.length >= 12
      ? "high"
      : "medium";

  return { point, lower, upper, confidence, insufficient_history: insufficient };
}

// ---------- IO ----------

function svc() {
  return createServiceClient();
}

export type ForecastTarget = {
  scope: "brand" | "anonymous";
  brandId?: string | null;
  dimensionType: string;
  dimensionValue: string;
  engine?: string | null;
  metric: string;
  horizonMonths?: number;
};

/**
 * Generate a forecast for a brand-level snapshot series or an anonymous
 * aggregate series; persist in forecast_runs. Honest: even with insufficient
 * history we store the projection but leave insufficient_history=true.
 */
export async function generateForecast(target: ForecastTarget): Promise<ForecastResult> {
  const supabase = svc();
  const horizon = target.horizonMonths ?? 6;

  let series: { period: string; value: number }[] = [];
  if (target.scope === "brand" && target.brandId) {
    const { data } = await supabase
      .from("benchmark_brand_snapshots")
      .select("period_start, mention_rate, citation_rate, avg_position, avg_trust, avg_visibility")
      .eq("brand_id", target.brandId)
      .eq("engine", target.engine ?? "*")
      .eq("intent", "*")
      .eq("language", "*")
      .gt("run_count", 0)
      .order("period_start", { ascending: true });
    series = ((data ?? []) as any[])
      .map((r) => ({ period: r.period_start, value: r[target.metric] }))
      .filter((s) => typeof s.value === "number");
  } else {
    const { data } = await supabase
      .from("benchmark_aggregates")
      .select("period_start, avg, p10, p90")
      .eq("dimension_type", target.dimensionType)
      .eq("dimension_value", target.dimensionValue)
      .eq("metric", target.metric)
      .eq("published", true)
      .order("period_start", { ascending: true });
    const rows = (data ?? []) as any[];
    series = rows.map((r) => ({ period: r.period_start, value: r.avg })).filter((s) => typeof s.value === "number");
    const last = rows[rows.length - 1];
    const result = etsForecast(series, horizon, {
      bounds: target.metric === "avg_position" ? { min: 1 } : { min: 0, max: 1 },
      empiricalP10P90: last ? { p10: last.p10 ?? 0, p90: last.p90 ?? 1 } : null,
    });
    await supabase.from("forecast_runs").upsert(
      {
        scope: "anonymous",
        brand_id: null,
        dimension_type: target.dimensionType,
        dimension_value: target.dimensionValue,
        engine: target.engine ?? null,
        metric: target.metric,
        horizon_months: horizon,
        point_forecast: JSON.stringify(result.point),
        lower_band: JSON.stringify(result.lower),
        upper_band: JSON.stringify(result.upper),
        confidence: result.confidence,
        insufficient_history: result.insufficient_history,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "scope,brand_id,dimension_type,dimension_value,engine,metric,horizon_months" },
    );
    return result;
  }

  const result = etsForecast(series, horizon, {
    bounds: target.metric === "avg_position" ? { min: 1 } : { min: 0, max: 1 },
  });
  await supabase.from("forecast_runs").upsert(
    {
      scope: "brand",
      brand_id: target.brandId ?? null,
      dimension_type: target.dimensionType,
      dimension_value: target.dimensionValue,
      engine: target.engine ?? null,
      metric: target.metric,
      horizon_months: horizon,
      point_forecast: JSON.stringify(result.point),
      lower_band: JSON.stringify(result.lower),
      upper_band: JSON.stringify(result.upper),
      confidence: result.confidence,
      insufficient_history: result.insufficient_history,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "scope,brand_id,dimension_type,dimension_value,engine,metric,horizon_months" },
  );
  return result;
}

export async function safeGenerateForecast(target: ForecastTarget): Promise<void> {
  try {
    await generateForecast(target);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("forecast failed"), { context: "generateForecast" });
  }
}
