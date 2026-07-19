// ============================================================
// opportunity-engine.ts — L3 Opportunity Engine.
//
// Detects where a brand lags the anonymous benchmark and turns each gap into a
// prioritized, impact-estimated recommendation. Impact is HONEST: it is derived
// from the brand's own observed run_count and the size of the gap to the
// benchmark p50 — never an invented absolute ("+500 visitors"). The brand's own
// snapshot is compared only against published, k-anon-safe aggregates.
//
// Attributed + RLS org-scoped (opportunity_recommendations carries brand_id).
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export type OpportunityType =
  | "citation_gap"
  | "position_gap"
  | "intent_coverage"
  | "competitor_exposure"
  | "schema_missing";

export type Gap = {
  type: OpportunityType;
  title: string;
  detail: Record<string, unknown>;
  estimated_impact: { mentions_per_month: number; visibility_delta: number };
  priority_score: number;
};

// ---------- PURE math ----------

/** Smaller gap magnitude → higher priority weight; 0 at/above benchmark. */
export function gapMagnitude(brandValue: number | null, benchmarkP50: number | null): number {
  if (brandValue == null || benchmarkP50 == null) return 0;
  if (brandValue >= benchmarkP50) return 0;
  return Math.max(0, benchmarkP50 - brandValue); // 0..1 for rate-like metrics
}

/**
 * Priority = gap magnitude × log-scaled observed volume × type weight. Larger
 * gaps on higher-traffic brands rank first. Deterministic. Bounded 0..1.
 */
export function priorityScore(gap: number, runCount: number, typeWeight: number): number {
  const volume = Math.log10(Math.max(1, runCount) + 1); // 0..~3
  return Math.min(1, gap * (volume / 3) * typeWeight);
}

export const TYPE_WEIGHTS: Record<OpportunityType, number> = {
  citation_gap: 1.0,
  position_gap: 0.9,
  competitor_exposure: 0.8,
  intent_coverage: 0.7,
  schema_missing: 0.6,
};

/** Pure: sort gaps by priority descending and assign the final score. */
export function prioritizeOpportunities(gaps: Gap[]): Gap[] {
  return gaps
    .map((g) => ({ ...g, priority_score: Math.min(1, g.priority_score) }))
    .sort((a, b) => b.priority_score - a.priority_score);
}

// ---------- IO ----------

function svc() {
  return createServiceClient();
}

/**
 * Generate opportunities for a brand by comparing its current-month snapshot
 * to the published industry benchmark p50. Writes opportunity_recommendations
 * (idempotent per brand for the open set). Failure-isolated internally.
 */
export async function generateOpportunities(brandId: string, periodStart: string): Promise<{ opportunities: number }> {
  const supabase = svc();

  const { data: snap } = await supabase
    .from("benchmark_brand_snapshots")
    .select("industry_category, mention_rate, citation_rate, avg_position, avg_trust, avg_visibility, run_count")
    .eq("brand_id", brandId)
    .eq("period_start", periodStart)
    .eq("engine", "*")
    .eq("intent", "*")
    .eq("language", "*")
    .limit(1);
  const s = (snap && (snap as any[])[0]) as any;
  if (!s) return { opportunities: 0 };

  const { data: agg } = await supabase
    .from("benchmark_aggregates")
    .select("metric, p50, avg")
    .eq("dimension_type", "industry")
    .eq("dimension_value", s.industry_category)
    .eq("engine", "*")
    .in("metric", ["mention_rate", "citation_rate", "avg_position", "avg_trust", "avg_visibility"])
    .eq("published", true)
    .limit(20);
  const bench = new Map<string, any>();
  for (const a of (agg ?? []) as any[]) bench.set(a.metric, a);

  const runCount = s.run_count ?? 0;
  const gaps: Gap[] = [];

  const addRateGap = (type: OpportunityType, metric: string, label: string, higherBetter: boolean) => {
    const brand = s[metric] as number | null;
    const b = bench.get(metric);
    if (!brand || !b) return;
    const target = higherBetter ? b.p50 : b.p50; // for position, lower is better but we still measure distance
    const gap = higherBetter ? gapMagnitude(brand, target) : gapMagnitude(target, brand);
    if (gap <= 0) return;
    gaps.push({
      type,
      title: `Close your ${label} gap vs the ${s.industry_category} benchmark`,
      detail: { brand_value: brand, benchmark_p50: target, metric },
      estimated_impact: {
        mentions_per_month: Math.round(gap * runCount),
        visibility_delta: Math.round(gap * 100) / 100,
      },
      priority_score: priorityScore(gap, runCount, TYPE_WEIGHTS[type]),
    });
  };

  addRateGap("citation_gap", "citation_rate", "citation", true);
  addRateGap("position_gap", "avg_position", "avg position", false);
  addRateGap("competitor_exposure", "mention_rate", "mention", true);
  addRateGap("schema_missing", "avg_trust", "trust", true);

  const sorted = prioritizeOpportunities(gaps);
  if (sorted.length > 0) {
    const rows = sorted.map((g) => ({
      brand_id: brandId,
      type: g.type,
      title: g.title,
      detail: g.detail,
      estimated_impact: g.estimated_impact,
      priority_score: g.priority_score,
      status: "open",
      created_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("opportunity_recommendations").upsert(rows, {
      onConflict: "brand_id,type",
    });
    if (error) throw error;
  }
  return { opportunities: sorted.length };
}

export async function safeGenerateOpportunities(brandId: string, periodStart: string): Promise<void> {
  try {
    await generateOpportunities(brandId, periodStart);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("opportunities failed"), { context: "generateOpportunities" });
  }
}
