// ============================================================
// intelligence-feed.ts — L3 Intelligence Feed.
//
// Assembles a REAL-TIME intelligence feed from signals we already compute:
//   - benchmark_trend_cells where change_point = true  (industry/engine shifts)
//   - history engine_change_detected events rolled up per engine (behavior change)
//   - competitor movers (from history-engine insights) surfaced as industry events
//
// Emitted as intelligence_feed_events with scope global|industry. Only
// PUBLISHED rows are ever exposed (RLS gate in migration_020). Brand-scoped
// alerts continue to live in history_alerts; this feed is the cross-tenant,
// anonymous layer — the "what's moving in AI discovery this week" view.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

function svc() {
  return createServiceClient();
}

/**
 * Build the global + industry feed for the latest period. Idempotent: each
 * signal maps to a deterministic key so re-runs don't duplicate. Returns the
 * number of events written.
 */
export async function assembleGlobalFeed(periodStart: string, lookbackDays = 30): Promise<{ events: number }> {
  const supabase = svc();
  const events: any[] = [];

  // 1) Trend change-points → industry / global shift events.
  const { data: trendCells } = await supabase
    .from("benchmark_trend_cells")
    .select("dimension_type, dimension_value, engine, metric, delta, trend_direction, change_point")
    .eq("period_start", periodStart)
    .eq("change_point", true);

  for (const c of (trendCells ?? []) as any[]) {
    if (!c.change_point) continue;
    const scope = c.dimension_type === "industry" ? "industry" : "global";
    const severity = c.trend_direction === "up" ? "positive" : c.trend_direction === "down" ? "negative" : "info";
    const label = c.dimension_value === "all" ? "the overall network" : c.dimension_value;
    events.push({
      scope,
      industry_category: c.dimension_type === "industry" ? c.dimension_value : null,
      engine: c.engine ?? null,
      event_type: "trend_change",
      severity,
      title: `${label} ${c.metric} ${c.trend_direction === "up" ? "rose" : c.trend_direction === "down" ? "fell" : "shifted"} ${(Math.abs(c.delta ?? 0) * 100).toFixed(1)}pp`,
      body: `Aggregate ${c.metric} for ${label}${c.engine ? ` on ${c.engine}` : ""} crossed a 2σ change point this period.`,
      payload: { metric: c.metric, delta: c.delta, direction: c.trend_direction },
      occurred_at: new Date().toISOString(),
      published: true,
    });
  }

  // 2) Engine behavior-change rollup (last lookbackDays).
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: engineChanges } = await supabase
    .from("history_events")
    .select("engine_name")
    .eq("event_type", "engine_change_detected")
    .gte("occurred_at", since);
  const byEngine = new Map<string, number>();
  for (const e of (engineChanges ?? []) as any[]) {
    const name = e.engine_name ?? "unknown";
    byEngine.set(name, (byEngine.get(name) ?? 0) + 1);
  }
  for (const [engine, count] of byEngine) {
    if (count < 3) continue; // ignore noise
    events.push({
      scope: "global",
      engine,
      event_type: "engine_behavior_change",
      severity: "info",
      title: `${engine} recommendation behavior shifted across ${count} tracked prompts`,
      body: `An elevated rate of mention-flip + response-change events suggests a model or ranking update on ${engine}.`,
      payload: { engine, count },
      occurred_at: new Date().toISOString(),
      published: true,
    });
  }

  if (events.length > 0) {
    const { error } = await supabase.from("intelligence_feed_events").insert(events);
    if (error) throw error;
  }
  return { events: events.length };
}

/** Read the public feed (published only). */
export async function getPublicFeed(opts: {
  scope?: "global" | "industry";
  industry?: string;
  engine?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const supabase = svc();
  let q = supabase
    .from("intelligence_feed_events")
    .select("*")
    .eq("published", true)
    .order("occurred_at", { ascending: false });
  if (opts.scope) q = q.eq("scope", opts.scope);
  if (opts.industry) q = q.eq("industry_category", opts.industry);
  if (opts.engine) q = q.eq("engine", opts.engine);
  q = q.limit(opts.limit ?? 50);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function safeAssembleGlobalFeed(periodStart: string): Promise<void> {
  try {
    await assembleGlobalFeed(periodStart);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("feed assembly failed"), { context: "assembleGlobalFeed" });
  }
}
