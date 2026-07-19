import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getCitationChanges } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";

// ============================================================
// GET /api/history/citations
// Citation GAINED / LOST counts and the domains involved over the window.
// Built only from real history_events — never estimated. Read-only; brand-scoped.
// =============================================================

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const { data: citations } = await cachedHistory(
    historyCacheKey("citations", brand.id, from, to),
    undefined,
    () => getCitationChanges(brand.id, { from, to }),
  );

  return NextResponse.json(
    { citations },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
