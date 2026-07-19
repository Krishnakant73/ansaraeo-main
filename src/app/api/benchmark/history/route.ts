import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import {
  getHistoricalTrend,
  getBrandTrend,
  BENCHMARK_METRICS,
  type BenchmarkMetric,
} from "@/lib/benchmark-engine";

// ============================================================
// GET /api/benchmark/history
//
// Multi-month series for a benchmark cell (industry trend) plus, when a user
// is signed in, that brand's own metric series for the same period. Enables
// the Historical Comparison chart: "how did we move vs the industry?"
// ============================================================

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const metric = (sp.get("metric") || "avg_visibility") as BenchmarkMetric;
  const dimensionType = sp.get("dimension") || "industry";
  const dimensionValue = sp.get("value") || "all";
  const engine = sp.get("engine") || null;
  const months = Number(sp.get("months") || "12");

  if (!BENCHMARK_METRICS.includes(metric)) {
    return NextResponse.json({ error: "invalid metric" }, { status: 400 });
  }

  const industryTrend = await getHistoricalTrend({
    dimensionType,
    dimensionValue,
    metric,
    engine: engine || null,
    months: Number.isFinite(months) ? months : 12,
  });

  let brandTrend: { period_start: string; value: number | null }[] | null = null;
  const selected = await getSelectedBrand();
  if (selected.brand?.id) {
    brandTrend = await getBrandTrend({ brandId: selected.brand.id, metric, months });
  }

  return NextResponse.json({
    dimensionType,
    dimensionValue,
    metric,
    engine,
    industryTrend,
    brandTrend,
  });
}
