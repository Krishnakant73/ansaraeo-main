import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeAndStoreSnapshot, type SnapshotWindow } from "@/lib/snapshots";

// ============================================================
// POST /api/metrics/snapshot?brandId=...&window=7d|30d
//
// Forces a geo_metric_snapshots recompute for a brand. Protected by CRON_SECRET
// (used internally by the nightly cron and admin tooling). Uses the service
// client because it writes across RLS.
// ============================================================

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });

  const windowParam = request.nextUrl.searchParams.get("window");
  const window: SnapshotWindow = windowParam === "30d" ? "30d" : "7d";

  const supabase = createServiceClient();
  const metrics = await computeAndStoreSnapshot(brandId, window, supabase);

  return NextResponse.json({ success: true, brandId, window, metrics });
}
