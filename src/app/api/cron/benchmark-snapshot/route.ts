import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { safeComputeBrandSnapshot } from "@/lib/benchmark-engine";
import { bucketMonth } from "@/lib/benchmark-metrics";

// ============================================================
// GET /api/cron/benchmark-snapshot
//
// Daily (after nightly visibility runs). Recomputes each opt-in brand's
// per-brand benchmark snapshot for the current month. The cross-brand
// aggregation that produces the anonymous, published cells is a separate
// route (benchmark-aggregate) that runs right after this one.
//
// Protected by CRON_SECRET (Bearer header), like the other cron routes.
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id")
    .eq("benchmark_opt_in", true);

  const period = bucketMonth(new Date());
  const results: { brandId: string; success: boolean; error?: string }[] = [];

  for (const brand of brands ?? []) {
    try {
      await safeComputeBrandSnapshot(brand.id, period);
      results.push({ brandId: brand.id, success: true });
    } catch (err) {
      results.push({
        brandId: brand.id,
        success: false,
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return NextResponse.json({
    success: true,
    period,
    computed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
