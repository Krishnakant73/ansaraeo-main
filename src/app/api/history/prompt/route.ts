import { NextRequest, NextResponse } from "next/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getPromptObservations, getTimeline } from "@/lib/history-engine";
import { cachedHistory, historyCacheKey } from "@/lib/history-cache";

// ============================================================
// GET /api/history/prompt
// The immutable observation series + derived events for a single prompt.
// Powers the per-prompt drill-down (which prompts improved after a content
// update?). Read-only; brand-scoped. promptId is required.
// =============================================================

export async function GET(request: NextRequest) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const promptId = searchParams.get("promptId");
  if (!promptId) return NextResponse.json({ error: "promptId is required" }, { status: 400 });

  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const engine = searchParams.get("engine") ?? undefined;

  const { data: observations } = await cachedHistory(
    historyCacheKey("prompt-obs", brand.id, promptId, from, to, engine),
    undefined,
    () => getPromptObservations(brand.id, promptId, { from, to, engine }),
  );
  const { data: events } = await cachedHistory(
    historyCacheKey("prompt-events", brand.id, promptId, from, to),
    undefined,
    () => getTimeline(brand.id, { promptId, from, to, limit: 250 }),
  );

  return NextResponse.json(
    { observations, events },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
