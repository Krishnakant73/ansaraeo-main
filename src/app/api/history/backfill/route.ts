import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { backfillBrand } from "@/lib/history-engine";
import { createRateLimiter } from "@/lib/rate-limit";
import { invalidateHistoryCache } from "@/lib/history-cache";
import { reportError } from "@/lib/monitoring";

// ============================================================
// POST /api/history/backfill
// One-time (and safely re-runnable) replay of a brand's existing
// visibility_runs into the immutable history tables. Idempotent via
// INSERT ... ON CONFLICT (run_id). Honest: only real recorded runs are
// replayed; pre-migration runs get engine_id=null (derivation falls back to
// engine_name). Failure-isolated — partial progress is preserved.
// =============================================================

const backfillLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anon";
  const rl = backfillLimiter(ip);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many backfill requests — please wait a minute." }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  try {
    const result = await backfillBrand(brand.id);
    invalidateHistoryCache(brand.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("history backfill failed"), {
      context: "backfillBrand",
      brandId: brand.id,
    });
    return NextResponse.json({ error: "Backfill failed — check the server logs." }, { status: 500 });
  }
}
