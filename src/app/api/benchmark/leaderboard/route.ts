import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLeaderboard,
  BENCHMARK_METRICS,
  type BenchmarkMetric,
} from "@/lib/benchmark-engine";
import { bucketMonth } from "@/lib/benchmark-metrics";

// ============================================================
// GET /api/benchmark/leaderboard
//
// Ranked, ANONYMOUS dimension values for a metric (e.g. top industries by AI
// visibility). No brand names are returned — only canonical dimension values
// and their aggregate stats. Names appear ONLY in Phase 2, gated by
// benchmark_public_opt_in.
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
  const engine = sp.get("engine") || null;
  const limit = Number(sp.get("limit") || "10");

  if (!BENCHMARK_METRICS.includes(metric)) {
    return NextResponse.json({ error: "invalid metric" }, { status: 400 });
  }

  const rows = await getLeaderboard({
    dimensionType,
    metric,
    engine: engine || null,
    periodStart: sp.get("period") || bucketMonth(new Date()),
    limit: Number.isFinite(limit) ? limit : 10,
  });

  return NextResponse.json({ dimensionType, metric, engine, rows });
}
