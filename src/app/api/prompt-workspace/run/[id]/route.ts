import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/prompt-workspace/run/[id]
// Returns one visibility_run + its citations for the RunReplayDrawer.
// Cookie-scoped: RLS filters unauthorized reads (returns null → 404).
// ============================================================

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("visibility_runs")
    .select(
      "id, run_at, brand_mentioned, brand_position, sentiment, recommendation_alignment, raw_response, competitor_mentions, mention_verification, engine_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const [engineRes, citationsRes] = await Promise.all([
    supabase.from("engines").select("name").eq("id", (run as { engine_id: string }).engine_id).maybeSingle(),
    supabase
      .from("citations")
      .select("cited_domain, cited_url, is_own_domain, is_competitor_domain")
      .eq("run_id", id)
      .limit(50),
  ]);

  return NextResponse.json({
    ...(run as object),
    engine_name: (engineRes.data as { name: string } | null)?.name ?? "unknown",
    citations: (citationsRes.data as unknown[] | null) ?? [],
  });
}
