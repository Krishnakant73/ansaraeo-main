import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { computeOnDemandMetrics, type SnapshotWindow } from "@/lib/snapshots";

// ============================================================
// GET /api/metrics?window=7d|30d
//
// On-demand geo-metrics for the selected brand, computed from recorded
// visibility_runs + citations via the cookie/RLS client (no new table needed
// for ad-hoc views; the persisted geo_metric_snapshots backs trend history).
// ============================================================

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand" }, { status: 404 });

  const windowParam = request.nextUrl.searchParams.get("window");
  const window: SnapshotWindow = windowParam === "30d" ? "30d" : "7d";
  const priority = request.nextUrl.searchParams.get("priority") === "1";

  const metrics = await computeOnDemandMetrics(brand.id, window, supabase, { priorityOnly: priority });
  if (!metrics) {
    return NextResponse.json({
      window,
      priority,
      metrics: null,
      message: priority ? "No priority prompts tracked yet" : "No runs yet for this window",
    });
  }

  return NextResponse.json({ window, priority, metrics });
  if (!metrics) {
    return NextResponse.json({ window, metrics: null, message: "No runs yet for this window" });
  }

  return NextResponse.json({ window, metrics });
}
