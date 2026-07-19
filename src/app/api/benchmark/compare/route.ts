import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLeaderboard,
  BENCHMARK_METRICS,
  type BenchmarkMetric,
} from "@/lib/benchmark-engine";
import { bucketMonth } from "@/lib/benchmark-metrics";

// ============================================================
// GET /api/benchmark/compare
//
// Full distribution across a dimension (no limit) for bar-chart comparisons
// (Regional / Language / AI-Engine comparison). Anonymous aggregate values
// only — never brand-level data.
// ============================================================

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const metric = (sp.get("metric") || "avg_visibility") as BenchmarkMetric;
  const dimensionType = sp.get("dimension") || "region";
  const engine = sp.get("engine") || null;

  if (!BENCHMARK_METRICS.includes(metric)) {
    return NextResponse.json({ error: "invalid metric" }, { status: 400 });
  }

  const rows = await getLeaderboard({
    dimensionType,
    metric,
    engine: engine || null,
    periodStart: sp.get("period") || bucketMonth(new Date()),
  });

  return NextResponse.json({ dimensionType, metric, engine, rows });
}
