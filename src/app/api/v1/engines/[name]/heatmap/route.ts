import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";

// ============================================================
// GET /api/v1/engines/[name]/heatmap
//
// Returns `{promptId, promptText, weekStart, rate}[]` for the last
// 8 weeks. Powers the Prompt Heatmap toggle on the Prompt Coverage
// tab. Deterministic aggregation from visibility_runs; RLS scoped.
// ============================================================

type RunRow = {
  prompt_id: string;
  run_at: string;
  brand_mentioned: boolean | null;
};

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

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", brand.id)
    .limit(500);
  const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
  if (promptList.length === 0) return NextResponse.json({ cells: [] });

  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 86_400_000).toISOString();
  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("prompt_id, run_at, brand_mentioned")
    .eq("engine_id", (engine as { id: string }).id)
    .in(
      "prompt_id",
      promptList.map((p) => p.id),
    )
    .gte("run_at", eightWeeksAgo);

  const rows = (runs as RunRow[] | null) ?? [];
  // Bucket by (promptId, ISO week-start Monday).
  const bucket = new Map<string, { hits: number; total: number }>();
  for (const r of rows) {
    if (r.brand_mentioned === null) continue;
    const week = isoWeekStart(new Date(r.run_at));
    const key = `${r.prompt_id}::${week}`;
    const cur = bucket.get(key) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (r.brand_mentioned === true) cur.hits += 1;
    bucket.set(key, cur);
  }

  const promptText = new Map(promptList.map((p) => [p.id, p.text]));
  const cells = Array.from(bucket.entries()).map(([k, v]) => {
    const [promptId, weekStart] = k.split("::");
    return {
      promptId,
      promptText: promptText.get(promptId) ?? "prompt",
      weekStart,
      rate: v.total > 0 ? Math.round((v.hits / v.total) * 100) : null,
      runs: v.total,
    };
  });

  return NextResponse.json({ cells });
}

function isoWeekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}
