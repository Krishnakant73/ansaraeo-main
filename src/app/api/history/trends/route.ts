import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getTrends } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";
import type { TrendBucket } from "@/lib/history-events";

// ============================================================
// GET /api/history/trends
// Time-bucketed mention-rate series for the brand (overall) and per engine,
// for the trends chart. Query params: from, to, engine, bucket (day|week|month).
// Skipped runs and null mentions are excluded from the denominator; buckets
// with no qualifying runs carry rate=null (never a fabricated 0%).
// ============================================================

const BUCKETS: TrendBucket[] = ["day", "week", "month"];

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const engine = searchParams.get("engine") ?? undefined;
  const bucketParam = searchParams.get("bucket") as TrendBucket | null;
  const bucket: TrendBucket = bucketParam && BUCKETS.includes(bucketParam) ? bucketParam : "month";

  const { data: trends } = await cachedHistory(
    historyCacheKey("trends", brand.id, from, to, engine, bucket),
    undefined,
    () => getTrends(brand.id, { from, to, engine, bucket }),
  );

  return NextResponse.json(
    { trends },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
