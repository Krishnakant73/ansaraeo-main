import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getInsights } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";

// ============================================================
// GET /api/history/insights
// Summary of the brand's historical record over a window (default 365d):
// first-mention dates per engine, competitor movers, citation changes,
// prompts that improved after content activity, engine-change signals.
// Read-only; scoped to the selected brand via the auth cookie.
// ============================================================

const MAX_WINDOW_MS = 5 * 365 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const now = Date.now();
  let to = now;
  let from = now - 365 * 24 * 60 * 60 * 1000;

  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  if (toParam) {
    const t = Date.parse(toParam);
    if (!Number.isNaN(t)) to = Math.min(t, now);
  }
  if (fromParam) {
    const f = Date.parse(fromParam);
    if (!Number.isNaN(f)) from = Math.min(f, to);
  }
  // Clamp absurdly large windows so a bad query can't scan the whole table.
  if (to - from > MAX_WINDOW_MS) from = to - MAX_WINDOW_MS;

  const { data: insights } = await cachedHistory(
    historyCacheKey("insights", brand.id, from, to),
    undefined,
    () => getInsights(brand.id, { from: new Date(from).toISOString(), to: new Date(to).toISOString() }),
  );

  return NextResponse.json(
    { insights },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
