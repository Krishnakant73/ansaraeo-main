import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";

// ============================================================
// GET /api/v1/engines/[name]/compare
//
// Returns per-engine mention rate + citation counts for every
// active engine in the current brand's context. The Engine
// Comparison feature renders this side-by-side.
// ============================================================

type RunRow = {
  id: string;
  engine_id: string;
  brand_mentioned: boolean | null;
};

type CitationRow = {
  run_id: string;
  is_own_domain: boolean | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createClient();

  const [enginesRes, brandCtx] = await Promise.all([
    supabase.from("engines").select("id, name").eq("is_active", true),
    getSelectedBrand(),
  ]);
  const engines = (enginesRes.data as { id: string; name: string }[] | null) ?? [];
  const { brand } = brandCtx;
  if (!brand) return NextResponse.json({ error: "No brand context" }, { status: 400 });

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", brand.id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
  if (promptIds.length === 0) return NextResponse.json({ engines: [], focus: name });

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, engine_id, brand_mentioned")
    .in("prompt_id", promptIds)
    .limit(3000);
  const runsList = (runs as RunRow[] | null) ?? [];
  const runIds = runsList.map((r) => r.id);

  const { data: cits } = runIds.length > 0
    ? await supabase.from("citations").select("run_id, is_own_domain").in("run_id", runIds)
    : { data: [] as CitationRow[] };
  const citList = (cits as CitationRow[] | null) ?? [];

  const byEngine = new Map<string, { runs: number; scored: number; hits: number; cits: number; ownCits: number }>();
  for (const e of engines) {
    byEngine.set(e.id, { runs: 0, scored: 0, hits: 0, cits: 0, ownCits: 0 });
  }
  for (const r of runsList) {
    const bucket = byEngine.get(r.engine_id);
    if (!bucket) continue;
    bucket.runs += 1;
    if (r.brand_mentioned !== null) bucket.scored += 1;
    if (r.brand_mentioned === true) bucket.hits += 1;
  }
  const runEngine = new Map(runsList.map((r) => [r.id, r.engine_id]));
  for (const c of citList) {
    const engId = runEngine.get(c.run_id);
    if (!engId) continue;
    const bucket = byEngine.get(engId);
    if (!bucket) continue;
    bucket.cits += 1;
    if (c.is_own_domain === true) bucket.ownCits += 1;
  }

  const result = engines.map((e) => {
    const b = byEngine.get(e.id)!;
    return {
      engine: e.name,
      is_focus: e.name === name,
      runs: b.runs,
      mention_rate: b.scored > 0 ? Math.round((b.hits / b.scored) * 100) : null,
      citations: b.cits,
      own_citation_share: b.cits > 0 ? Math.round((b.ownCits / b.cits) * 100) : null,
    };
  });

  return NextResponse.json({ engines: result, focus: name });
}
