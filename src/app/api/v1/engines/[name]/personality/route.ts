import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { computeEnginePersonality } from "@/lib/engine-personality";

// ============================================================
// GET /api/v1/engines/[name]/personality
//
// Returns the cached engine_personalities row for the current
// brand. When absent, computes it live from visibility_runs. Live
// compute never writes — that's the cron's job.
// ============================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createClient();

  const { data: engine } = await supabase
    .from("engines")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (!engine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand context" }, { status: 400 });

  const engineId = (engine as { id: string }).id;
  const { data: cached } = await supabase
    .from("engine_personalities")
    .select(
      "verbosity, hedging, format_bias, freshness_bias, citation_density, entity_resolution, runs_observed, computed_at",
    )
    .eq("engine_id", engineId)
    .eq("brand_id", brand.id)
    .maybeSingle();

  if (cached) return NextResponse.json({ ...cached, source: "cache" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const live = await computeEnginePersonality(supabase as any, engineId, brand.id);
  return NextResponse.json({ ...live, source: "live" });
}
