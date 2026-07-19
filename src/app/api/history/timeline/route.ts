import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getTimeline } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";

// ============================================================
// GET /api/history/timeline
// The chronological feed of derived timeline events (first mention,
// mention lost, citation gained, competitor gaining ground, ...).
// Query params: from, to, engine, eventType, limit (cap 500, default 100).
// Read-only; scoped to the selected brand.
// ============================================================

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const engine = searchParams.get("engine") ?? undefined;
  const eventType = searchParams.get("eventType") ?? undefined;
  const limitRaw = Number(searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100;

  const { data: events } = await cachedHistory(
    historyCacheKey("timeline", brand.id, from, to, engine, eventType, limit),
    undefined,
    () => getTimeline(brand.id, { from, to, engine, eventType, limit }),
  );

  return NextResponse.json(
    { events },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
