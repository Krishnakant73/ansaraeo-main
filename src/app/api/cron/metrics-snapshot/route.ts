import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeAndStoreSnapshot, type SnapshotWindow } from "@/lib/snapshots";
import { fireAlertsForBrand } from "@/lib/alerts";
import { enrichDomains } from "@/lib/domain-authority";

// ============================================================
// GET /api/cron/metrics-snapshot
//
// Persists a geo_metric_snapshots row (7d + 30d) for every brand and emits
// geo_metric_events for any metric that moved vs the previous snapshot. Runs
// nightly after the visibility runs complete, so trend velocity + anomaly
// flags have a stable baseline for the dashboard and PDF report.
//
// Protected by CRON_SECRET (Vercel injects this header on cron invocations).
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: brands } = await supabase.from("brands").select("id");

  if (!brands || brands.length === 0) {
    return NextResponse.json({ success: true, snapshotted: 0 });
  }

  const windows: SnapshotWindow[] = ["7d", "30d"];
  const results: { brandId: string; success: boolean; error?: string; alertsFired?: number }[] = [];

  for (const brand of brands) {
    try {
      for (const window of windows) {
        await computeAndStoreSnapshot(brand.id, window, supabase);
      }
      // Evaluate alert rules against the freshly-persisted snapshots.
      const fired = await fireAlertsForBrand(supabase, brand.id);
      results.push({ brandId: brand.id, success: true, alertsFired: fired });
    } catch (err) {
      results.push({
        brandId: brand.id,
        success: false,
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  // Incrementally backfill real domain authority (DataForSEO) once per run —
  // the scan is global across all citations, so it runs outside the per-brand
  // loop. Bounded to stay within a sane credit budget; no-op if creds absent.
  let authorityEnriched = 0;
  try {
    const authority = await enrichDomains(supabase, { limit: 30 });
    authorityEnriched = authority.enriched;
  } catch {
    /* authority enrichment is best-effort — never fail the snapshot cron */
  }

  return NextResponse.json({
    success: true,
    snapshotted: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    authorityEnriched,
    results,
  });
}
