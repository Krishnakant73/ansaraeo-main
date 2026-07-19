import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { generateEngineStrategy } from "@/lib/engine-optimization";

// ============================================================
// POST /api/v1/engines/[name]/strategy
//
// Generates engine-specific optimization opportunities and persists
// them into opportunity_recommendations idempotently, keyed on
// (brand_id, type='engine_optimization', engine_id, detail.kind).
//
// GET returns the generated set without persisting — used by the
// preview state.
// ============================================================

async function loadEngineAndBrand(name: string) {
  const supabase = await createClient();
  const { data: engine } = await supabase
    .from("engines")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();
  if (!engine) return { error: "Not found", status: 404 as const };

  const { brand } = await getSelectedBrand();
  if (!brand) return { error: "No brand context", status: 400 as const };

  return {
    supabase,
    engine: engine as { id: string; name: string },
    brand,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const ctx = await loadEngineAndBrand(name);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const moves = generateEngineStrategy(ctx.engine.name);
  return NextResponse.json({ engine: ctx.engine.name, moves });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const ctx = await loadEngineAndBrand(name);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const moves = generateEngineStrategy(ctx.engine.name);

  const rows = moves.map((m) => ({
    brand_id: ctx.brand.id,
    engine_id: ctx.engine.id,
    type: "engine_optimization",
    title: m.title,
    detail: {
      rationale: m.rationale,
      kind: m.kind,
      engine: ctx.engine.name,
    },
    estimated_impact: m.impact,
    priority_score: m.priority,
    status: "open",
  }));

  // Upsert on the unique (brand_id, type) constraint added in
  // migration 022 — for engine_optimization rows we still want one
  // slot per (brand, kind, engine), so we manually dedupe on kind
  // before inserting: if a row exists for this brand/engine/kind we
  // update, otherwise we insert.
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const kind = (row.detail as { kind: string }).kind;
    const { data: existing } = await ctx.supabase
      .from("opportunity_recommendations")
      .select("id, status")
      .eq("brand_id", row.brand_id)
      .eq("engine_id", row.engine_id)
      .contains("detail", { kind })
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await ctx.supabase
      .from("opportunity_recommendations")
      .insert(row);
    if (!error) inserted += 1;
  }

  return NextResponse.json({
    engine: ctx.engine.name,
    moves,
    inserted,
    skipped,
  });
}
