import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getComparison } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";

// ============================================================
// GET /api/history/compare
// Compare two time windows for the brand (optionally one engine / prompt):
// overall + per-engine mention-rate deltas, plus citation gained/lost per
// window. Answers "did we improve after the content update?". Read-only;
// brand-scoped. Honest empty windows yield rate=null / delta=null.
// =============================================================

const MAX_WINDOW_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const now = Date.now();

  const parse = (raw: string | null, fallback: number) =>
    raw ? (Number.isNaN(Date.parse(raw)) ? fallback : Math.min(Date.parse(raw), now)) : fallback;

  // Defaults: windowB = last 90d, windowA = the 90d before that.
  const toB = parse(searchParams.get("toB"), now);
  const fromB = parse(searchParams.get("fromB"), toB - 90 * DAY);
  const toA = parse(searchParams.get("toA"), fromB - DAY);
  const fromA = parse(searchParams.get("fromA"), toA - 90 * DAY);

  // Clamp absurd windows so a bad query can't scan the whole table.
  const clamp = (a: number, b: number) => (b - a > MAX_WINDOW_MS ? b - MAX_WINDOW_MS : a);
  const fA = clamp(fromA, toA);
  const fB = clamp(fromB, toB);

  const engine = searchParams.get("engine") ?? undefined;
  const promptId = searchParams.get("promptId") ?? undefined;

  const { data: comparison } = await cachedHistory(
    historyCacheKey("compare", brand.id, fA, fB, fA, toB, engine, promptId),
    undefined,
    () =>
      getComparison(brand.id, {
        fromA: new Date(fA).toISOString(),
        toA: new Date(toA).toISOString(),
        fromB: new Date(fB).toISOString(),
        toB: new Date(toB).toISOString(),
        engine,
        promptId,
      }),
  );

  return NextResponse.json(
    { comparison },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
