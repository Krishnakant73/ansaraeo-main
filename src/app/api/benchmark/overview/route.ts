import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import {
  getBenchmarkCell,
  getYourPosition,
  BENCHMARK_METRICS,
  type BenchmarkMetric,
} from "@/lib/benchmark-engine";
import { bucketMonth } from "@/lib/benchmark-metrics";

// ============================================================
// GET /api/benchmark/overview
//
// Returns the anonymous benchmark for a dimension cell PLUS the requesting
// brand's own position within it. Brand identity is resolved from the session
// (never a query param) so a user can only ever see their own "Your Position".
// ============================================================

const DIMENSION_TYPES = [
  "overall",
  "industry",
  "region",
  "country",
  "language",
  "engine",
  "intent",
  "company_size",
  "traffic_band",
  "revenue_band",
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  // Authenticated users use the cookie session; cron/external callers may pass
  // the CRON_SECRET bearer, but "your position" requires a real user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const metric = (sp.get("metric") || "avg_visibility") as BenchmarkMetric;
  const dimensionType = sp.get("dimension") || "overall";
  const dimensionValue = sp.get("value") || "all";
  const engine = sp.get("engine") || null;
  const period = sp.get("period") || bucketMonth(new Date());

  if (!BENCHMARK_METRICS.includes(metric)) {
    return NextResponse.json({ error: "invalid metric" }, { status: 400 });
  }
  if (!DIMENSION_TYPES.includes(dimensionType)) {
    return NextResponse.json({ error: "invalid dimension" }, { status: 400 });
  }

  const cell = await getBenchmarkCell({
    dimensionType,
    dimensionValue,
    engine: engine || null,
    metric,
    periodStart: period,
  });

  let yourPosition = null;
  const selected = await getSelectedBrand();
  if (selected.brand?.id) {
    yourPosition = await getYourPosition({
      brandId: selected.brand.id,
      dimensionType,
      dimensionValue,
      engine: engine || null,
      metric,
      periodStart: period,
    });
  }

  return NextResponse.json({
    period,
    metric,
    dimensionType,
    dimensionValue,
    engine,
    benchmark: cell,
    yourPosition,
  });
}
