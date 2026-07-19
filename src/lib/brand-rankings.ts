// ============================================================
// brand-rankings.ts — L3 AI Brand Rankings + Recommendation Market Share.
//
// Rankings are PUBLIC but anonymous: a brand maps to a random uuid token
// (brand_ranking_tokens). The public leaderboard references the token, never
// the brand name. A rankings_monthly cell is only published when it aggregates
// >= K distinct brands (k-anonymity, same gate as benchmark-privacy).
//
// Market Share = a brand's recommendation/citation volume divided by the total
// within a topic/industry cluster. Computed from attributed snapshots but only
// ever REVEALED as anonymous shares in the published warehouse.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";
import { isCellPublishable } from "@/lib/benchmark-privacy";

export const RANK_METRICS = ["mention_rate", "citation_rate", "avg_trust", "avg_visibility"] as const;
export type RankMetric = (typeof RANK_METRICS)[number];

// ---------- PURE math ----------

/**
 * Market share of recommendations for one brand within a cluster. `total` is
 * the cluster sum (Laplace-smoothed so a single brand can't be 100%). Returns
 * 0..1. Null inputs → null (honest: no data, no share).
 */
export function marketShareIndex(brandMentions: number | null, clusterTotal: number | null, smoothing = 1): number | null {
  if (brandMentions == null || clusterTotal == null) return null;
  const denom = clusterTotal + smoothing;
  if (denom <= 0) return 0;
  return brandMentions / denom;
}

/** Mindshare: normalized blend of mentions + citations received within a cluster. */
export function mindshare(
  brandMentions: number,
  brandCitations: number,
  clusterMentions: number,
  clusterCitations: number,
): number {
  const mShare = clusterMentions > 0 ? brandMentions / (clusterMentions + 1) : 0;
  const cShare = clusterCitations > 0 ? brandCitations / (clusterCitations + 1) : 0;
  return 0.6 * mShare + 0.4 * cShare;
}

/** Rank values descending; returns value→rank (1-based). Ties share the lower rank. */
export function rankDescending(values: number[]): Map<number, number> {
  const sorted = [...values].sort((a, b) => b - a);
  const rank = new Map<number, number>();
  sorted.forEach((v, i) => {
    if (!rank.has(v)) rank.set(v, i + 1);
  });
  return rank;
}

/** Percentile rank of `value` within `values` (0..100, higher = better). */
export function percentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  // mid-rank method: (below + 0.5*equal) / n * 100
  return ((below + 0.5 * equal) / values.length) * 100;
}

// ---------- IO ----------

function svc() {
  return createServiceClient();
}

/** Idempotent: ensure a brand has an anonymous ranking token. */
export async function ensureRankingToken(brandId: string): Promise<string> {
  const supabase = svc();
  const { data } = await supabase
    .from("brand_ranking_tokens")
    .select("token")
    .eq("brand_id", brandId)
    .limit(1);
  if (data && data.length > 0) return (data[0] as any).token as string;
  const { data: inserted, error } = await supabase
    .from("brand_ranking_tokens")
    .insert({ brand_id: brandId })
    .select("token")
    .single();
  if (error) throw error;
  return (inserted as any).token as string;
}

/**
 * Compute monthly anonymous rankings per (industry, metric) and publish only
 * k-anon-safe cells. Reads attributed snapshots, joins tokens, writes
 * rankings_monthly with published gated by brand_count >= K.
 */
export async function computeMonthlyRankings(periodStart: string): Promise<{ ranked: number; published: number }> {
  const supabase = svc();
  const { data: snaps, error } = await supabase
    .from("benchmark_brand_snapshots")
    .select(
      "brand_id, industry_category, region, country, mention_rate, citation_rate, avg_trust, avg_visibility, run_count",
    )
    .eq("period_start", periodStart)
    .eq("engine", "*")
    .eq("intent", "*")
    .eq("language", "*")
    .gt("run_count", 0);
  if (error) throw error;
  const rows = (snaps ?? []) as any[];

  // Ensure tokens exist for every brand in this cohort.
  for (const r of rows) {
    try {
      await ensureRankingToken(r.brand_id);
    } catch {
      /* token creation never blocks ranking */
    }
  }
  const tokenMap = new Map<string, string>();
  const { data: tokens } = await supabase.from("brand_ranking_tokens").select("brand_id, token");
  for (const t of (tokens ?? []) as any[]) tokenMap.set(t.brand_id, t.token);

  // Group by industry; rank per metric.
  const byIndustry = new Map<string, any[]>();
  for (const r of rows) {
    if (!byIndustry.has(r.industry_category)) byIndustry.set(r.industry_category, []);
    byIndustry.get(r.industry_category)!.push(r);
  }

  const out: any[] = [];
  let published = 0;
  for (const [industry, group] of byIndustry) {
    const brandCount = new Set(group.map((r) => r.brand_id)).size;
    const safe = isCellPublishable(brandCount);
    for (const metric of RANK_METRICS) {
      const vals = group.map((r) => r[metric]).filter((v): v is number => typeof v === "number");
      for (const r of group) {
        const v = r[metric] as number | null;
        if (v == null) continue;
        out.push({
          period_start: periodStart,
          dimension_type: "industry",
          dimension_value: industry,
          rank_metric: metric,
          brand_token: tokenMap.get(r.brand_id),
          value: v,
          percentile: percentileRank(v, vals),
          rank: rankDescending(vals).get(v) ?? null,
          published: safe,
          computed_at: new Date().toISOString(),
        });
      }
    }
  }
  if (out.length > 0) {
    const { error: upsertErr } = await supabase.from("rankings_monthly").upsert(out, {
      onConflict: "period_start,dimension_type,dimension_value,rank_metric,brand_token",
    });
    if (upsertErr) throw upsertErr;
    published = out.filter((o) => o.published).length;
  }
  return { ranked: out.length, published };
}

/** Public, anonymous market-share leaderboard for a topic/industry (k-anon gated). */
export async function getMarketShare(industry: string, metric: RankMetric = "mention_rate"): Promise<{
  industry: string;
  brand_count: number;
  published: boolean;
  shares: { token: string; share: number; rank: number }[];
}> {
  const supabase = svc();
  const { data: snaps } = await supabase
    .from("benchmark_brand_snapshots")
    .select("brand_id, mention_rate, citation_rate")
    .eq("industry_category", industry)
    .eq("engine", "*")
    .eq("intent", "*")
    .eq("language", "*")
    .gt("run_count", 0);
  const rows = (snaps ?? []) as any[];
  const brandCount = new Set(rows.map((r) => r.brand_id)).size;
  if (!isCellPublishable(brandCount)) {
    return { industry, brand_count: brandCount, published: false, shares: [] };
  }
  const clusterTotal = rows.reduce((acc, r) => acc + (r[metric] ?? 0), 0);
  const tokenMap = new Map<string, string>();
  const { data: tokens } = await supabase.from("brand_ranking_tokens").select("brand_id, token");
  for (const t of (tokens ?? []) as any[]) tokenMap.set(t.brand_id, t.token);

  const shares = rows
    .map((r) => ({
      token: tokenMap.get(r.brand_id) ?? r.brand_id,
      share: marketShareIndex(r[metric] ?? 0, clusterTotal) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.share - a.share);
  shares.forEach((s, i) => (s.rank = i + 1));
  return { industry, brand_count: brandCount, published: true, shares };
}

export async function safeComputeMonthlyRankings(periodStart: string): Promise<void> {
  try {
    await computeMonthlyRankings(periodStart);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("rankings failed"), { context: "computeMonthlyRankings" });
  }
}
