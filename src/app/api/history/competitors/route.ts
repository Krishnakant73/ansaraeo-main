import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getInsights } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";

// ============================================================
// GET /api/history/competitors
// Per-competitor monthly mention series + the net movers (gaining / losing
// visibility vs the brand) over the window. Read-only; scoped to brand.
// =============================================================

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const now = Date.now();
  let to = now;
  let from = now - 365 * 24 * 60 * 60 * 1000;
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  if (toParam) { const t = Date.parse(toParam); if (!Number.isNaN(t)) to = Math.min(t, now); }
  if (fromParam) { const f = Date.parse(fromParam); if (!Number.isNaN(f)) from = Math.min(f, to); }

  const { data: insights } = await cachedHistory(
    historyCacheKey("competitors", brand.id, from, to),
    undefined,
    () => getInsights(brand.id, { from: new Date(from).toISOString(), to: new Date(to).toISOString() }),
  );

  return NextResponse.json(
    { trend: insights.competitorTrend, movers: insights.competitorMovers },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
