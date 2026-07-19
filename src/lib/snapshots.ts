// Snapshot persistence for the geo-metrics layer.
//
// computeAndStoreSnapshot reads real visibility_runs + citations for a brand,
// runs computeGeoMetrics, persists a geo_metric_snapshots row, and emits
// geo_metric_events for any metric that moved vs the previous snapshot. The
// nightly cron calls this for every brand so trend velocity + anomaly flags
// have a stable, persisted baseline (used by the dashboard and the PDF report).
//
// Everything is computed from recorded data — never estimated.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeGeoMetrics, splitWindows, type GeoMetrics, type GeoRun, type GeoCitation, type EngineInfo } from "./geo-metrics";
import type { IntentKey } from "./intent";

export type SnapshotWindow = "7d" | "30d";

const WINDOW_DAYS: Record<SnapshotWindow, number> = { "7d": 7, "30d": 30 };

// Metrics we track as events. avg_rank is "higher = worse", so its direction is
// inverted when judging anomalies.
const TRACKED_METRICS: { key: keyof GeoMetrics; higherIsBetter: boolean }[] = [
  { key: "visibility_rate", higherIsBetter: true },
  { key: "citation_rate", higherIsBetter: true },
  { key: "citation_share", higherIsBetter: true },
  { key: "avg_rank", higherIsBetter: false },
  { key: "model_divergence", higherIsBetter: false },
  { key: "trend_velocity", higherIsBetter: true },
  { key: "recommendation_quality", higherIsBetter: true },
];

const ANOMALY_THRESHOLD = 15; // pp or rank points

function asNumber(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

// Loads raw runs/citations/engines for a brand and computes the metric bundle.
// No persistence — safe to call with the cookie/RLS client for ad-hoc views, or
// with the service client before persisting a snapshot.
export async function computeOnDemandMetrics(
  brandId: string,
  window: SnapshotWindow,
  supabase: SupabaseClient,
  opts?: { priorityOnly?: boolean },
): Promise<GeoMetrics | null> {
  const windowDays = WINDOW_DAYS[window];
  const since = new Date(Date.now() - 2 * windowDays * 86_400_000).toISOString();

  const promptQuery = supabase
    .from("prompts")
    .select("id, intent, priority")
    .eq("brand_id", brandId);
  if (opts?.priorityOnly) promptQuery.eq("priority", true);
  const { data: prompts } = await promptQuery;

  const promptIds = (prompts ?? []).map((p) => p.id);
  if (!promptIds.length) return null;

  const promptIntent: Record<string, IntentKey | null> = {};
  for (const p of prompts ?? []) promptIntent[p.id] = (p.intent as IntentKey) || null;

  const { data: runsData } = await supabase
    .from("visibility_runs")
    .select("id, prompt_id, engine_id, run_at, brand_mentioned, brand_position, sentiment, recommendation_alignment")
    .in("prompt_id", promptIds)
    .gte("run_at", since)
    .order("run_at", { ascending: true });

  const runs = (runsData ?? []) as GeoRun[];
  if (!runs.length) return null;

  const runIds = runs.map((r) => r.id);
  const { data: citationsData } = await supabase
    .from("citations")
    .select("id, run_id, cited_domain, cited_url, is_own_domain, is_competitor_domain, is_trusted_source")
    .in("run_id", runIds);
  const citations = (citationsData ?? []) as GeoCitation[];

  const { data: enginesData } = await supabase
    .from("engines")
    .select("id, name")
    .eq("is_active", true);
  const engines = ((enginesData ?? []) as EngineInfo[]).filter((e) =>
    runs.some((r) => r.engine_id === e.id),
  );

  const { current, prior } = splitWindows(runs, windowDays);
  return computeGeoMetrics({
    runs: current,
    citations,
    engines,
    promptIntent,
    priorRuns: prior,
  });
}

export async function computeAndStoreSnapshot(
  brandId: string,
  window: SnapshotWindow,
  supabase: SupabaseClient,
): Promise<GeoMetrics | null> {
  const metrics = await computeOnDemandMetrics(brandId, window, supabase);
  if (!metrics) return null;

  const today = new Date().toISOString().slice(0, 10);

  // Replace any existing snapshot for this brand/window/date (idempotent cron).
  await supabase
    .from("geo_metric_snapshots")
    .delete()
    .eq("brand_id", brandId)
    .eq("window_type", window)
    .eq("snapshot_date", today);

  const { data: inserted } = await supabase
    .from("geo_metric_snapshots")
    .insert({
      brand_id: brandId,
      snapshot_date: today,
      window_type: window,
      metrics,
      per_engine: metrics.per_engine,
      by_intent: metrics.by_intent,
    })
    .select("id")
    .single();

  // Diff vs previous snapshot to emit events.
  const { data: prevRows } = await supabase
    .from("geo_metric_snapshots")
    .select("metrics")
    .eq("brand_id", brandId)
    .eq("window_type", window)
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  const prevMetrics = prevRows?.[0]?.metrics as GeoMetrics | undefined;
  if (prevMetrics && inserted?.id) {
    const events: Record<string, unknown>[] = [];
    for (const { key, higherIsBetter } of TRACKED_METRICS) {
      const cur = asNumber(metrics[key]);
      const prev = asNumber(prevMetrics[key]);
      if (cur === null || prev === null) continue;
      const delta = Math.round((cur - prev) * 100) / 100;
      if (delta === 0) continue;
      const dir = delta > 0 ? "up" : "down";
      const improved = higherIsBetter ? delta > 0 : delta < 0;
      const anomaly = Math.abs(delta) >= ANOMALY_THRESHOLD;
      events.push({
        brand_id: brandId,
        metric: key as string,
        window_type: window,
        delta,
        direction: dir,
        anomaly,
        detail: { previous: prev, current: cur, improved },
      });
    }
    if (events.length) {
      await supabase.from("geo_metric_events").insert(events);
    }
  }

  return metrics;
}

export async function getLatestSnapshot(
  brandId: string,
  window: SnapshotWindow,
  supabase: SupabaseClient,
): Promise<{ metrics: GeoMetrics; per_engine: GeoMetrics["per_engine"]; by_intent: GeoMetrics["by_intent"]; snapshot_date: string } | null> {
  const { data } = await supabase
    .from("geo_metric_snapshots")
    .select("metrics, per_engine, by_intent, snapshot_date")
    .eq("brand_id", brandId)
    .eq("window_type", window)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    metrics: data.metrics as GeoMetrics,
    per_engine: (data.per_engine as GeoMetrics["per_engine"]) ?? {},
    by_intent: (data.by_intent as GeoMetrics["by_intent"]) ?? {},
    snapshot_date: data.snapshot_date as string,
  };
}
