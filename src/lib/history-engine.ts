// ============================================================
// history-engine.ts — IO layer for the Historical AI Recommendation
// Database. Uses the SERVICE client (trusted, background work: runs,
// cron, backfill, prune). User-facing reads still go through the route's
// cookie client, which scopes brandId via getSelectedBrand().
//
// Append-only by design: only INSERTs here, plus the single retention
// prune DELETE path. A history failure must NEVER break a visibility run,
// so every public entry point is failure-isolated by the caller.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";
import {
  diffObservation,
  normalizeResponse,
  bucketTrend,
  bucketCompetitorTrend,
  computeRetentionCutoff,
  computeFirstMentionByEngine,
  computeCompetitorMovers,
  computePromptImprovements,
  overallRate,
  diffTrendWindows,
  type DiffObservation,
  type TrendBucket,
  type TrendPoint,
  type CompetitorTrend,
} from "@/lib/history-events";

// ---------- types ----------

type VisibilityRunSnapshot = {
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
  mention_verification: unknown;
  raw_response: string | null;
  tokens_used?: number | null;
  cost_usd?: number | null;
};

export type RecordRunInput = {
  runId: string;
  brandId: string;
  promptId: string;
  engineId: string | null;
  engineName: string;
  promptText: string;
  run: VisibilityRunSnapshot;
};

type RangeOpts = {
  from?: string;
  to?: string;
  engine?: string;
  eventType?: string;
  promptId?: string;
  limit?: number;
};

// ---------- helpers ----------

function svc() {
  return createServiceClient();
}

function obsFromRow(row: any, runId: string | null): DiffObservation {
  return {
    id: row.id,
    observed_at: row.observed_at,
    skipped: row.skipped === true,
    brand_mentioned: row.brand_mentioned,
    brand_position: row.brand_position,
    sentiment: row.sentiment,
    recommendation_alignment: row.recommendation_alignment,
    competitor_mentions: row.competitor_mentions ?? null,
  };
}

// ---------- write path ----------

/** Record one immutable observation for a completed visibility run. */
export async function recordObservationFromRun(input: RecordRunInput): Promise<void> {
  const supabase = svc();
  const { run } = input;

  const { error } = await supabase.from("history_observations").insert({
    brand_id: input.brandId,
    prompt_id: input.promptId,
    engine_id: input.engineId,
    engine_name: input.engineName,
    prompt_text: input.promptText,
    run_id: input.runId,
    skipped: false,
    brand_mentioned: run.brand_mentioned,
    brand_position: run.brand_position,
    sentiment: run.sentiment,
    recommendation_alignment: run.recommendation_alignment,
    competitor_mentions: run.competitor_mentions ?? null,
    mention_verification: run.mention_verification ?? null,
    raw_response: run.raw_response ?? null,
    tokens_used: run.tokens_used ?? null,
    cost_usd: run.cost_usd ?? null,
  });

  if (error) throw error;

  await deriveAndStoreEvents(input.brandId, input.promptId, input.engineId, input.engineName);
}

/** Record a "we checked, engine returned nothing" observation. */
export async function recordSkippedObservation(input: {
  brandId: string;
  promptId: string;
  engineId: string | null;
  engineName: string;
  promptText: string;
  skipReason: string;
  runId?: string | null;
}): Promise<void> {
  const supabase = svc();
  const { error } = await supabase.from("history_observations").insert({
    brand_id: input.brandId,
    prompt_id: input.promptId,
    engine_id: input.engineId,
    engine_name: input.engineName,
    prompt_text: input.promptText,
    run_id: input.runId ?? null,
    skipped: true,
    skip_reason: input.skipReason,
    brand_mentioned: null,
  });
  if (error) throw error;
  // No delta events for skips (skip != not-mentioned).
}

/**
 * Load the last two real observations for (prompt, engine) and derive the
 * timeline events between them. Idempotent: if events already exist for the
 * current observation, we skip (safe to call on backfill re-runs).
 */
export async function deriveAndStoreEvents(
  brandId: string,
  promptId: string,
  engineId: string | null,
  engineName: string,
): Promise<void> {
  const supabase = svc();

  let q = supabase
    .from("history_observations")
    .select("id, observed_at, skipped, brand_mentioned, brand_position, sentiment, recommendation_alignment, competitor_mentions, raw_response, run_id")
    .eq("brand_id", brandId)
    .eq("prompt_id", promptId);
  // engine_id can be null (backfilled runs have no engine_id captured) — use
  // .is(null) rather than a sentinel so both live and backfilled rows match.
  // For backfilled runs we ALSO constrain by engine_name: backfill writes
  // engine_id=null for every replayed run, so without this two observations
  // from different engines for the same prompt could be diffed against each
  // other and emit wrong first-mention / position / citation events.
  if (engineId == null) {
    q = q.is("engine_id", null);
    if (engineName) q = q.eq("engine_name", engineName);
  } else {
    q = q.eq("engine_id", engineId);
  }

  const { data: rows, error } = await q
    .order("observed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(2);

  if (error) throw error;
  if (!rows || rows.length === 0) return;

  const currRow = rows[0];
  const prevRow = rows.length > 1 ? rows[1] : null;

  // Idempotency guard: events already derived for this observation?
  const { data: existing } = await supabase
    .from("history_events")
    .select("id")
    .eq("observation_id", currRow.id)
    .limit(1);
  if (existing && existing.length > 0) return;

  const [prevCitations, currCitations] = await Promise.all([
    prevRow?.run_id ? citedDomains(prevRow.run_id) : Promise.resolve<string[]>([]),
    currRow.run_id ? citedDomains(currRow.run_id) : Promise.resolve<string[]>([]),
  ]);

  const events = diffObservation({
    prev: prevRow ? obsFromRow(prevRow, prevRow.run_id) : null,
    curr: obsFromRow(currRow, currRow.run_id),
    prevCitations,
    currCitations,
    prevSignature: prevRow ? normalizeResponse(prevRow.raw_response) : null,
    currSignature: normalizeResponse(currRow.raw_response),
  });

  if (events.length === 0) return;

  const { data: inserted, error: evtError } = await supabase
    .from("history_events")
    .insert(
      events.map((e) => ({
        brand_id: brandId,
        prompt_id: promptId,
        engine_id: engineId,
        engine_name: engineName,
        event_type: e.event_type,
        occurred_at: currRow.observed_at,
        prior_observation_id: prevRow?.id ?? null,
        observation_id: currRow.id,
        from_state: e.from_state ?? null,
        to_state: e.to_state ?? null,
        detail: e.detail ?? null,
        severity: e.severity,
      })),
    )
    .select();
  if (evtError) throw evtError;

  // Derive alerts from negative-severity events (mention lost, citation lost,
  // competitor gained, position dropped, recommendation lost) — the brand's
  // most actionable signals. One alert per event (unique event_id) so backfill
  // / retry never duplicates. Failure-isolated: a history/alert error must
  // never break the visibility run.
  const negative = (inserted ?? []).filter((e: any) => e.severity === "negative");
  if (negative.length > 0) {
    try {
      await supabase.from("history_alerts").upsert(
        negative.map((e: any) => ({
          brand_id: brandId,
          prompt_id: promptId,
          engine_id: engineId,
          engine_name: engineName,
          event_id: e.id,
          alert_type: e.event_type,
          severity: "negative",
          occurred_at: currRow.observed_at,
          detail: e.detail ?? null,
        })),
        { onConflict: "event_id", ignoreDuplicates: true },
      );
    } catch {
      /* alert derivation never blocks history */
    }
  }
}

async function citedDomains(runId: string): Promise<string[]> {
  const supabase = svc();
  const { data } = await supabase
    .from("citations")
    .select("cited_domain")
    .eq("run_id", runId);
  return (data ?? []).map((c: any) => c.cited_domain).filter(Boolean) as string[];
}

/**
 * One-time backfill: replay existing visibility_runs into history.
 * Honest — real data only. Idempotent: INSERT ... ON CONFLICT (run_id)
 * skips already-recorded runs; deriveAndStoreEvents re-derives nothing.
 */
export async function backfillBrand(brandId: string): Promise<{ observations: number; events: number }> {
  const supabase = svc();

  const { data: runs, error } = await supabase
    .from("visibility_runs")
    .select(
      "id, brand_mentioned, brand_position, sentiment, recommendation_alignment, competitor_mentions, mention_verification, raw_response, tokens_used, cost_usd, run_at, prompt_id, prompts!inner(text, brand_id), engines(name)",
    )
    .eq("prompts.brand_id", brandId)
    .order("run_at", { ascending: true });

  if (error) throw error;
  if (!runs || runs.length === 0) return { observations: 0, events: 0 };

  // Ensure partitions exist for the FULL month range of the source runs
  // BEFORE replaying. Backfill writes observed_at = run.run_at (the run's real
  // date) so history is dated correctly — but that can fall months/years in
  // the past, well outside the current+3-month window ensure_history_partitions()
  // guarantees for live writes. Without this, old runs would fail to INSERT
  // (no partition for that month). Failure-isolated: an RPC failure still lets
  // the per-row upserts attempt (each is itself failure-isolated).
  const runAts = (runs as any[])
    .map((r) => (typeof r.run_at === "string" ? r.run_at : null))
    .filter((d): d is string => d != null)
    .sort();
  if (runAts.length > 0) {
    try {
      await supabase.rpc("ensure_history_partitions_for_range", {
        from_date: runAts[0].slice(0, 10),
        to_date: runAts[runAts.length - 1].slice(0, 10),
      });
    } catch (rpcErr) {
      reportError(rpcErr instanceof Error ? rpcErr : new Error("ensure_history_partitions_for_range failed"), {
        context: "backfillBrand partition ensure",
        brandId,
      });
    }
  }

  let recorded = 0;
  for (const run of runs as any[]) {
    const prompt = Array.isArray(run.prompts) ? run.prompts[0] : run.prompts;
    const engineName =
      (Array.isArray(run.engines) ? run.engines[0] : run.engines)?.name ?? "unknown";
    if (!prompt || prompt.brand_id !== brandId) continue;

    // Idempotent: ignore a row if its (run_id, observed_at) already exists.
    // upsert with ignoreDuplicates = INSERT ... ON CONFLICT DO NOTHING, which
    // preserves immutability (we never update an existing observation).
    const { error: insErr } = await supabase
      .from("history_observations")
      .upsert(
        {
          brand_id: brandId,
          prompt_id: run.prompt_id,
          engine_id: null,
          engine_name: engineName,
          prompt_text: prompt.text,
          run_id: run.id,
          // Replay the run at its REAL date so the historical timeline
          // ("when was the brand first recommended?") is accurate. Defaults to
          // now() would mis-date every backfilled run to today and break the
          // (run_id, observed_at) idempotency guard on re-runs.
          observed_at: run.run_at ?? new Date().toISOString(),
          skipped: false,
          brand_mentioned: run.brand_mentioned,
          brand_position: run.brand_position,
          sentiment: run.sentiment,
          recommendation_alignment: run.recommendation_alignment,
          competitor_mentions: run.competitor_mentions ?? null,
          mention_verification: run.mention_verification ?? null,
          raw_response: run.raw_response ?? null,
          tokens_used: run.tokens_used ?? null,
          cost_usd: run.cost_usd ?? null,
        },
        { onConflict: "run_id, observed_at", ignoreDuplicates: true },
      );

    if (!insErr) recorded += 1;
    // derive events for this (prompt, engine) sequence
    try {
      await deriveAndStoreEvents(brandId, run.prompt_id, null, engineName);
    } catch {
      /* derive errors never block backfill */
    }
  }

  return { observations: recorded, events: 0 };
}

// ---------- read path (used by API routes / agent) ----------

function applyRange(q: any, from?: string, to?: string) {
  if (from) q = q.gte("observed_at", from);
  if (to) q = q.lte("observed_at", to);
  return q;
}

export async function getTimeline(brandId: string, opts: RangeOpts = {}) {
  const supabase = svc();
  let q = supabase
    .from("history_events")
    .select("*")
    .eq("brand_id", brandId)
    .order("occurred_at", { ascending: false });
  if (opts.from) q = q.gte("occurred_at", opts.from);
  if (opts.to) q = q.lte("occurred_at", opts.to);
  if (opts.engine) q = q.eq("engine_name", opts.engine);
  if (opts.eventType) q = q.eq("event_type", opts.eventType);
  if (opts.promptId) q = q.eq("prompt_id", opts.promptId);
  q = q.limit(opts.limit ?? 100);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getTrends(
  brandId: string,
  opts: { from?: string; to?: string; engine?: string; bucket?: TrendBucket } = {},
): Promise<{ overall: TrendPoint[]; byEngine: Record<string, TrendPoint[]> }> {
  const supabase = svc();
  let q = supabase
    .from("history_observations")
    .select("observed_at, brand_mentioned, skipped, engine_name")
    .eq("brand_id", brandId);
  q = applyRange(q, opts.from, opts.to);
  if (opts.engine) q = q.eq("engine_name", opts.engine);
  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => ({
    observed_at: r.observed_at,
    brand_mentioned: r.brand_mentioned,
    skipped: r.skipped === true,
    engine_name: r.engine_name,
  }));

  const bucket = opts.bucket ?? "month";
  const byEngine: Record<string, TrendPoint[]> = {};
  for (const engine of Array.from(new Set(rows.map((r) => r.engine_name)))) {
    byEngine[engine] = bucketTrend(
      rows.filter((r) => r.engine_name === engine),
      bucket,
    );
  }
  return { overall: bucketTrend(rows, bucket), byEngine };
}

export async function getCompetitorTrend(
  brandId: string,
  opts: { from?: string; to?: string } = {},
): Promise<CompetitorTrend> {
  const supabase = svc();
  let q = supabase
    .from("history_observations")
    .select("observed_at, competitor_mentions")
    .eq("brand_id", brandId)
    .eq("skipped", false);
  q = applyRange(q, opts.from, opts.to);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []).map((r: any) => ({
    observed_at: r.observed_at,
    competitor_mentions: r.competitor_mentions ?? [],
  }));
  return bucketCompetitorTrend(rows);
}

export async function getCitationChanges(
  brandId: string,
  opts: { from?: string; to?: string } = {},
): Promise<{ gained: number; lost: number; gainedDomains: string[]; lostDomains: string[] }> {
  const supabase = svc();
  let q = supabase
    .from("history_events")
    .select("event_type, detail")
    .eq("brand_id", brandId)
    .in("event_type", ["citation_gained", "citation_lost"]);
  if (opts.from) q = q.gte("occurred_at", opts.from);
  if (opts.to) q = q.lte("occurred_at", opts.to);
  const { data, error } = await q;
  if (error) throw error;

  let gained = 0;
  let lost = 0;
  const gainedDomains: string[] = [];
  const lostDomains: string[] = [];
  for (const e of data ?? []) {
    const domains = ((e.detail as any)?.domains as string[]) ?? [];
    if (e.event_type === "citation_gained") {
      gained += 1;
      gainedDomains.push(...domains);
    } else {
      lost += 1;
      lostDomains.push(...domains);
    }
  }
  return {
    gained,
    lost,
    gainedDomains: Array.from(new Set(gainedDomains)),
    lostDomains: Array.from(new Set(lostDomains)),
  };
}

export async function getEngineChangeSignals(
  brandId: string,
  opts: { from?: string; to?: string } = {},
): Promise<any[]> {
  const supabase = svc();
  let q = supabase
    .from("history_events")
    .select("*")
    .eq("brand_id", brandId)
    .eq("event_type", "engine_change_detected")
    .order("occurred_at", { ascending: false });
  if (opts.from) q = q.gte("occurred_at", opts.from);
  if (opts.to) q = q.lte("occurred_at", opts.to);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export type HistoryInsights = {
  firstMentionByEngine: { engine: string; observed_at: string }[];
  competitorTrend: CompetitorTrend;
  competitorMovers: { name: string; delta: number; trend: "gaining" | "losing" | "stable" }[];
  promptImprovements: {
    prompt_id: string;
    prompt_text: string;
    recentRate: number | null;
    priorRate: number | null;
    delta: number | null;
  }[];
  citationChanges: { gained: number; lost: number; gainedDomains: string[]; lostDomains: string[] };
  engineChangeSignals: number;
};

export async function getInsights(
  brandId: string,
  opts: { from?: string; to?: string } = {},
): Promise<HistoryInsights> {
  const supabase = svc();
  let q = supabase
    .from("history_observations")
    .select("observed_at, brand_mentioned, skipped, engine_name, competitor_mentions, prompt_id, prompt_text")
    .eq("brand_id", brandId);
  q = applyRange(q, opts.from, opts.to);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as any[];

  // first mention per engine
  const firstMentionByEngine = computeFirstMentionByEngine(
    rows.map((r) => ({
      observed_at: r.observed_at,
      engine_name: r.engine_name,
      skipped: r.skipped === true,
      brand_mentioned: r.brand_mentioned,
    })),
  );

  // competitor trend + movers
  const compTrend = bucketCompetitorTrend(
    rows.map((r) => ({ observed_at: r.observed_at, competitor_mentions: r.competitor_mentions ?? [] })),
  );
  const competitorMovers = computeCompetitorMovers(compTrend);

  // prompt improvements: recent 30d vs prior window
  const toDate = opts.to ? new Date(opts.to) : new Date();
  const promptImprovements = computePromptImprovements(
    rows.map((r) => ({
      observed_at: r.observed_at,
      prompt_id: r.prompt_id,
      prompt_text: r.prompt_text,
      skipped: r.skipped === true,
      brand_mentioned: r.brand_mentioned,
    })),
    toDate,
  );

  const citationChanges = await getCitationChanges(brandId, opts);
  const engineChangeSignals = (await getEngineChangeSignals(brandId, opts)).length;

  return {
    firstMentionByEngine,
    competitorTrend: compTrend,
    competitorMovers,
    promptImprovements,
    citationChanges,
    engineChangeSignals,
  };
}

// ---------- comparison (two windows) ----------

export type HistoryComparison = {
  windowA: { from: string; to: string; overall: number | null; byEngine: Record<string, number | null> };
  windowB: { from: string; to: string; overall: number | null; byEngine: Record<string, number | null> };
  delta: { overall: number | null; byEngine: Record<string, number | null> };
  citations: {
    windowA: { gained: number; lost: number };
    windowB: { gained: number; lost: number };
  };
};

/**
 * Compare two time windows for the brand (optionally one engine / prompt):
 * overall + per-engine mention-rate deltas, plus citation gained/lost per
 * window. Powers "did we improve after the content update?" answers.
 * Honest: an empty window yields rate=null and delta=null (never 0 / never fabricated).
 */
export async function getComparison(
  brandId: string,
  opts: { fromA: string; toA: string; fromB: string; toB: string; engine?: string; promptId?: string },
): Promise<HistoryComparison> {
  const [trendsA, trendsB, citA, citB] = await Promise.all([
    getTrends(brandId, { from: opts.fromA, to: opts.toA, engine: opts.engine }),
    getTrends(brandId, { from: opts.fromB, to: opts.toB, engine: opts.engine }),
    getCitationChanges(brandId, { from: opts.fromA, to: opts.toA }),
    getCitationChanges(brandId, { from: opts.fromB, to: opts.toB }),
  ]);

  const engines = Array.from(
    new Set([...Object.keys(trendsA.byEngine), ...Object.keys(trendsB.byEngine)]),
  );
  const deltaByEngine: Record<string, number | null> = {};
  for (const e of engines) {
    deltaByEngine[e] = diffTrendWindows(trendsA.byEngine[e] ?? [], trendsB.byEngine[e] ?? []).delta;
  }

  const rateOf = (pts: TrendPoint[] | undefined) => overallRate(pts ?? []);

  return {
    windowA: {
      from: opts.fromA,
      to: opts.toA,
      overall: rateOf(trendsA.overall),
      byEngine: Object.fromEntries(Object.entries(trendsA.byEngine).map(([e, pts]) => [e, rateOf(pts)])),
    },
    windowB: {
      from: opts.fromB,
      to: opts.toB,
      overall: rateOf(trendsB.overall),
      byEngine: Object.fromEntries(Object.entries(trendsB.byEngine).map(([e, pts]) => [e, rateOf(pts)])),
    },
    delta: { overall: diffTrendWindows(trendsA.overall, trendsB.overall).delta, byEngine: deltaByEngine },
    citations: {
      windowA: { gained: citA.gained, lost: citA.lost },
      windowB: { gained: citB.gained, lost: citB.lost },
    },
  };
}

// ---------- per-prompt drill-down ----------

export type PromptObservation = {
  observed_at: string;
  engine_name: string | null;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
  skipped: boolean;
};

/** The immutable observation series for a single prompt (newest first). */
export async function getPromptObservations(
  brandId: string,
  promptId: string,
  opts: { from?: string; to?: string; engine?: string } = {},
): Promise<PromptObservation[]> {
  const supabase = svc();
  let q = supabase
    .from("history_observations")
    .select("observed_at, engine_name, brand_mentioned, brand_position, sentiment, recommendation_alignment, skipped")
    .eq("brand_id", brandId)
    .eq("prompt_id", promptId)
    .order("observed_at", { ascending: false });
  if (opts.from) q = q.gte("observed_at", opts.from);
  if (opts.to) q = q.lte("observed_at", opts.to);
  if (opts.engine) q = q.eq("engine_name", opts.engine);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    observed_at: r.observed_at,
    engine_name: r.engine_name ?? null,
    brand_mentioned: r.brand_mentioned,
    brand_position: r.brand_position,
    sentiment: r.sentiment,
    recommendation_alignment: r.recommendation_alignment,
    skipped: r.skipped === true,
  }));
}

// ---------- history alerts (negative events) ----------

export type HistoryAlert = {
  id: string;
  event_id: string;
  prompt_id: string | null;
  engine_name: string | null;
  alert_type: string;
  severity: string;
  occurred_at: string;
  detail: any;
  acknowledged: boolean;
};

/** Recent negative history events as alerts (most actionable signals). */
export async function getAlerts(
  brandId: string,
  opts: { from?: string; to?: string; onlyUnacked?: boolean; limit?: number } = {},
): Promise<HistoryAlert[]> {
  const supabase = svc();
  let q = supabase
    .from("history_alerts")
    .select("*")
    .eq("brand_id", brandId)
    .order("occurred_at", { ascending: false });
  if (opts.from) q = q.gte("occurred_at", opts.from);
  if (opts.to) q = q.lte("occurred_at", opts.to);
  if (opts.onlyUnacked) q = q.eq("acknowledged", false);
  q = q.limit(opts.limit ?? 100);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HistoryAlert[];
}

export async function getUnackedAlertCount(brandId: string): Promise<number> {
  const supabase = svc();
  const { count, error } = await supabase
    .from("history_alerts")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("acknowledged", false);
  if (error) throw error;
  return count ?? 0;
}

// ---------- retention prune (the ONLY delete path) ----------

export async function pruneByRetention(): Promise<{ brands: number; observations: number; events: number }> {
  const supabase = svc();
  const { data: brands, error } = await supabase
    .from("brands")
    .select("id, history_retention_tier")
    .in("history_retention_tier", ["30d", "365d"]);
  if (error) throw error;
  if (!brands || brands.length === 0) return { brands: 0, observations: 0, events: 0 };

  const now = new Date();
  let obsDeleted = 0;
  let evtDeleted = 0;

  for (const b of brands as any[]) {
    const cutoff = computeRetentionCutoff(b.history_retention_tier, now);
    if (!cutoff) continue;
    const cutoffIso = cutoff.toISOString();

    const { count: eDel } = await supabase
      .from("history_events")
      .delete({ count: "exact" })
      .eq("brand_id", b.id)
      .lt("occurred_at", cutoffIso);
    const { count: oDel } = await supabase
      .from("history_observations")
      .delete({ count: "exact" })
      .eq("brand_id", b.id)
      .lt("observed_at", cutoffIso);

    evtDeleted += eDel ?? 0;
    obsDeleted += oDel ?? 0;
  }

  return { brands: brands.length, observations: obsDeleted, events: evtDeleted };
}

/** Failure-isolated wrapper so calling history from the run path can't throw. */
export async function safeRecordRunHistory(input: RecordRunInput): Promise<void> {
  try {
    await recordObservationFromRun(input);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("history record failed"), {
      context: "recordObservationFromRun",
      brandId: input.brandId,
      runId: input.runId,
    });
  }
}

export async function safeRecordSkippedHistory(input: {
  brandId: string;
  promptId: string;
  engineId: string | null;
  engineName: string;
  promptText: string;
  skipReason: string;
  runId?: string | null;
}): Promise<void> {
  try {
    await recordSkippedObservation(input);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("history skipped record failed"), {
      context: "recordSkippedObservation",
      brandId: input.brandId,
    });
  }
}
