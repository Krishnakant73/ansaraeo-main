// ============================================================
// /api/cron/intelligence — nightly Intelligence DAG (Module 7/8/9/2/3/1).
//
// Runs AFTER the benchmark aggregation (benchmark_brand_snapshots →
// benchmark_aggregates). Order matters: the graph + trends + rankings + feed
// all read from the warehouse the benchmark step produced. Every step is
// failure-isolated (safe* wrappers) so one failure can't abort the DAG.
//
// Gated by CRON_SECRET (Bearer ${CRON_SECRET}) like the other cron routes.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { bucketMonth } from "@/lib/benchmark-metrics";
import { createServiceClient } from "@/lib/supabase/server";
import { safeExtractGraph, safeComputeGraphMetrics } from "@/lib/discovery-graph";
import { safeComputeTrendCells } from "@/lib/benchmark-trends";
import { safeGenerateForecast } from "@/lib/forecast-engine";
import { safeComputeMonthlyRankings } from "@/lib/brand-rankings";
import { safeGenerateOpportunities } from "@/lib/opportunity-engine";
import { safeAssembleGlobalFeed } from "@/lib/intelligence-feed";

export const dynamic = "force-dynamic";

function assertCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!assertCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const period = bucketMonth(new Date());
  const svc = createServiceClient();
  const log: Record<string, unknown> = {};

  // 1) Discovery graph (bootstraps free from existing citations/mentions).
  safeExtractGraph({});
  safeComputeGraphMetrics();

  // 2) Trend cells from the published aggregate series.
  safeComputeTrendCells(period);

  // 3) Forecast the top anonymous cells (industry × metric) 6 months out.
  const { data: topCells } = await svc
    .from("benchmark_aggregates")
    .select("dimension_type, dimension_value, metric")
    .eq("dimension_type", "industry")
    .eq("published", true)
    .limit(50);
  for (const c of (topCells ?? []) as any[]) {
    safeGenerateForecast({ scope: "anonymous", dimensionType: c.dimension_type, dimensionValue: c.dimension_value, metric: c.metric, horizonMonths: 6 });
  }

  // 4) Anonymous monthly rankings (k-anon gated on publish).
  safeComputeMonthlyRankings(period);
  log.rankings = "queued";

  // 5) Per-brand opportunities (attributed, RLS-scoped). Loop brands with snapshots.
  const { data: brandRows } = await svc
    .from("benchmark_brand_snapshots")
    .select("brand_id")
    .eq("period_start", period)
    .gt("run_count", 0)
    .limit(200);
  const brandIds = [...new Set(((brandRows ?? []) as any[]).map((b) => b.brand_id))];
  for (const brandId of brandIds) {
    safeGenerateOpportunities(brandId, period);
  }
  log.brands_scanned = brandIds.length;

  // 6) Global + industry feed.
  safeAssembleGlobalFeed(period);
  log.period = period;

  return NextResponse.json({ ok: true, log });
}
