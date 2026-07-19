import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getAlerts } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";

// ============================================================
// GET /api/history/alerts
// Recent negative history events as alerts (mention lost, citation lost,
// competitor gained, position dropped, recommendation lost). Read-only;
// brand-scoped. Query params: from, to, onlyUnacked, limit (cap 200).
// =============================================================

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const onlyUnacked = searchParams.get("onlyUnacked") === "true";
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;

  const { data: alerts } = await cachedHistory(
    historyCacheKey("alerts", brand.id, from, to, onlyUnacked ? "unacked" : "all", limit),
    undefined,
    () => getAlerts(brand.id, { from, to, onlyUnacked, limit }),
  );

  return NextResponse.json(
    { alerts },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
