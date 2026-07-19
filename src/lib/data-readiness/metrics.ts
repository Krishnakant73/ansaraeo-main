// ============================================================
// data-readiness/metrics.ts — Observes the real signals the
// readiness engine reasons about, from existing tables only.
//
// FAILURE-ISOLATED: every query is independently wrapped so a single
// failing read degrades ONE metric to its default rather than throwing.
// The gather as a whole also cannot throw (callers rely on that). It
// reads only data the platform already collects via background scans —
// no new LLM/API calls, no new tables.
//
// Cohort scoping:
//   - "brand"  → metrics scoped to one brand's runs/snapshots.
//   - "platform" → cross-brand aggregate signals (benchmark cohort size,
//                  graph edges, ecosystem coverage). Used by anonymous
//                  features (benchmarks, market share, rankings, graph).
//
// ============================================================
// PERFORMANCE OPTIMIZATION TODO  (DOCUMENTATION ONLY — DO NOT IMPLEMENT YET)
// ------------------------------------------------------------
// The readiness gather intentionally stays SIMPLE: every read below is a
// `count: "exact", head: true` or a `limit: 1` lookup against small/aggregate
// tables, executed only on a dashboard page load. We deliberately DO NOT add
// caching or new indexes yet. Premature optimization is explicitly out of
// scope until real production metrics justify it. This section is the plan for
// *when* to optimize, so a future developer can act on evidence, not guesses.
//
// ── 1. Aggregate queries that should eventually be INDEXED ────────────────
// Below are the exact table/column access patterns to index once row counts
// grow large. All are currently served fine by existing PK/scan behavior.
//
//   BRAND cohort (opts.brandId set):
//     • prompts.id                         WHERE brand_id = $1
//         → already PK-scoped; no action.
//     • visibility_runs                    WHERE skipped = false
//                                          AND prompt_id IN (...promptIds)
//         → SUGGESTED:  index on (prompt_id)  and/or  composite (skipped, prompt_id)
//     • visibility_runs.run_at             WHERE skipped = false
//                                          ORDER BY run_at ASC LIMIT 1   (earliest-run fallback)
//         → SUGGESTED:  index on (run_at)  or  composite (skipped, run_at)
//     • visibility_runs.engine_id          WHERE skipped = false
//                                          AND prompt_id IN (...promptIds)
//         → SUGGESTED:  index on (prompt_id, engine_id)  (powers distinct-engines)
//     • benchmark_brand_snapshots          WHERE brand_id = $1
//                                          ORDER BY period_start ASC LIMIT 1
//         → SUGGESTED:  index on (brand_id, period_start)
//     • benchmark_brand_snapshots          WHERE brand_id = $1
//                                          AND engine = '*' AND intent = '*'
//                                          AND language = '*' AND run_count > 0
//         → SUGGESTED:  index on (brand_id, engine, intent, language)
//
//   PLATFORM cohort (no brandId — anonymous/anonymous features):
//     • discovery_edges                    COUNT(*)   (full-table count)
//         → SUGGESTED (only if > ~100k rows): replace with a maintained
//           counter row or a partial/materialized aggregate; do NOT add a raw
//           count index — it won't help a full scan.
//     • brands                             COUNT(*)   (small table; no action)
//
// ── 2. Recommended CACHE TTL values (apply ONLY when section 4 triggers) ───
//   • /api/readiness (brand-scoped module)   → TTL 5 min   (background scans
//                                                run hourly/nightly; 5 min
//                                                hides latency without
//                                                showing stale activation states)
//   • /api/readiness (platform module)       → TTL 30 min  (cohort size, graph
//                                                edges change very slowly)
//   • Page-render call `getReadiness(...)`    → inline the same TTL via a
//                                                per-(module,brandId) memo key
//   Cache key shape: `readiness:{module}:{brandId ?? "platform"}`.
//
// ── 3. Expected performance THRESHOLDS (current target, not yet measured) ──
//   • Readiness gather (all queries) p95  < 200 ms   at current data volumes.
//   • /api/readiness response p95         < 300 ms   under normal load.
//   • Added page TTFB regression from the gather  < 100 ms.
//   These are design targets; treat them as the baseline to compare real
//   production metrics against — not as pass/fail gates today.
//
// ── 4. WHEN TO ENABLE CACHING / INDEXES (the trigger conditions) ──────────
//   Enable the caching layer (section 2) when ANY of:
//     a) /api/readiness p95 exceeds 300 ms in production, OR
//     b) the readiness gather adds > 100 ms to dashboard page TTFB, OR
//     c) a single brand exceeds ~1M visibility_runs rows and the brand-scoped
//        count query degrades noticeably.
//   Add the indexes (section 1) when query plans show sequential scans on the
//   above tables at production row counts, or when (c) is reached.
//   Until a trigger fires, KEEP THIS SIMPLE — no cache, no new migration.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { clamp, daysSince } from "./util";
import type { ReadinessMetrics } from "./types";
import { READINESS_TUNING } from "./requirements";

function emptyMetrics(): ReadinessMetrics {
  return {
    daysCollected: 0,
    observations: 0,
    brands: 0,
    prompts: 0,
    engines: 0,
    trendLength: 0,
    trendStability: 0.5,
    edges: 0,
    graphDensity: 0,
    benchmarkConfidence: 0,
    ecosystemCoverage: 0,
  };
}

/** Sample coefficient of variation → 1 = perfectly stable. */
function stabilityFromSeries(values: number[]): number {
  if (values.length < 2) return 0.5;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0.5;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1);
  const sd = Math.sqrt(variance);
  return clamp(1 - sd / Math.abs(mean), 0, 1);
}

type Opts = { brandId?: string };

export async function gatherReadinessMetrics(opts: Opts = {}): Promise<ReadinessMetrics> {
  const supabase = createServiceClient();
  const m = emptyMetrics();
  const isBrand = Boolean(opts.brandId);
  const brandId = opts.brandId;

  try {
    // ---- brand-scoped prompt set + prompt/brand counts ----
    let promptIds: string[] = [];
    if (isBrand && brandId) {
      try {
        const { data } = await supabase.from("prompts").select("id").eq("brand_id", brandId);
        promptIds = ((data ?? []) as { id: string }[]).map((p) => p.id);
        m.prompts = promptIds.length;
        m.brands = 1;
      } catch {
        /* leave prompts/brands at default */
      }
    }

    // ---- observation count (skipped runs are excluded — they carry no signal) ----
    try {
      if (isBrand && promptIds.length === 0) {
        m.observations = 0;
      } else {
        let q = supabase
          .from("visibility_runs")
          .select("*", { count: "exact", head: true })
          .eq("skipped", false);
        if (isBrand && promptIds.length) q = q.in("prompt_id", promptIds);
        const { count } = await q;
        m.observations = count ?? 0;
      }
    } catch {
      /* leave observations at 0 */
    }

    if (m.observations > 0) {
      // ---- days collected: prefer the indexed snapshot tables, fall back to runs ----
      try {
        const { data: snap } = isBrand && brandId
          ? await supabase
              .from("benchmark_brand_snapshots")
              .select("period_start")
              .eq("brand_id", brandId)
              .order("period_start", { ascending: true })
              .limit(1)
          : await supabase
              .from("benchmark_aggregates")
              .select("period_start")
              .order("period_start", { ascending: true })
              .limit(1);
        const snapRow = (snap as { period_start?: string }[] | null)?.[0]?.period_start ?? null;
        let earliest: string | null = snapRow ? String(snapRow) : null;
        if (!earliest) {
          const { data: run } = await supabase
            .from("visibility_runs")
            .select("run_at")
            .eq("skipped", false)
            .order("run_at", { ascending: true })
            .limit(1);
          earliest = (run as { run_at?: string }[] | null)?.[0]?.run_at ?? null;
        }
        m.daysCollected = daysSince(earliest);
      } catch {
        /* leave daysCollected at 0 */
      }

      // ---- engines covered (brand cohort only; platform features key off brand count) ----
      try {
        if (isBrand && promptIds.length) {
          const { data: er } = await supabase
            .from("visibility_runs")
            .select("engine_id")
            .eq("skipped", false)
            .in("prompt_id", promptIds);
          m.engines = new Set(
            ((er ?? []) as { engine_id?: string }[]).map((r) => r.engine_id).filter(Boolean),
          ).size;
        }
      } catch {
        /* leave engines at 0 */
      }

      // ---- trend length + stability from monthly snapshots (brand cohort only) ----
      try {
        if (isBrand && brandId) {
          const { data: snaps } = await supabase
            .from("benchmark_brand_snapshots")
            .select("period_start, avg_visibility")
            .eq("brand_id", brandId)
            .eq("engine", "*")
            .eq("intent", "*")
            .eq("language", "*")
            .gt("run_count", 0)
            .order("period_start", { ascending: true });
          const rows = (snaps ?? []) as { period_start?: string; avg_visibility?: number }[];
          m.trendLength = new Set(rows.map((r) => r.period_start).filter(Boolean)).size;
          m.trendStability = stabilityFromSeries(
            rows.map((r) => Number(r.avg_visibility)).filter((v) => Number.isFinite(v)),
          );
        }
      } catch {
        /* leave trend signals at defaults */
      }
    }

    // ---- platform-wide signals (graph + benchmark confidence + ecosystem) ----
    try {
      const { count: edgeCount } = await supabase
        .from("discovery_edges")
        .select("*", { count: "exact", head: true });
      m.edges = edgeCount ?? 0;
      m.graphDensity = clamp(m.edges / READINESS_TUNING.TARGET_EDGES, 0, 1);
    } catch {
      /* leave edges/graphDensity at 0 */
    }

    try {
      const { count: brandCount } = await supabase
        .from("brands")
        .select("*", { count: "exact", head: true });
      const bc = brandCount ?? 0;
      if (!isBrand) m.brands = bc;
      const coverage = clamp(bc / READINESS_TUNING.TARGET_BRANDS, 0, 1);
      m.ecosystemCoverage = coverage;
      m.benchmarkConfidence = Math.round(coverage * 100);
    } catch {
      /* leave platform signals at defaults */
    }
  } catch {
    // Catastrophic failure (e.g. client construction). Return whatever we
    // gathered; callers treat the result as best-effort and never block a
    // working feature on it.
  }

  return m;
}
