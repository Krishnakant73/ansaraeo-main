import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBattlecardStats, generateBattlecard, type Battlecard } from "@/lib/competitor-intel";

// GET /api/competitors/battlecards?brandId=... — share-of-voice + sentiment
// stats per confirmed competitor (no LLM call).
// POST /api/competitors/battlecards — generate AI battlecards (LLM) for each.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const stats = await getBattlecardStats(supabase, brandId);
    return NextResponse.json({ stats });
  } catch (err) {
    console.error("battlecards error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId, brandName } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const stats = await getBattlecardStats(supabase, brandId);
    if (stats.length === 0) return NextResponse.json({ cards: [] });

    // Gather a few example queries where each competitor appears.
    const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brandId);
    const promptIds = (prompts ?? []).map((p) => p.id);
    const { data: runs } = promptIds.length
      ? await supabase.from("visibility_runs").select("prompt_id, competitor_mentions").in("prompt_id", promptIds)
      : { data: [] };
    const promptTextById = new Map((prompts ?? []).map((p) => [p.id, p.text]));

    const cards: (Battlecard & { stat: (typeof stats)[number] })[] = await Promise.all(
      stats.map(async (stat) => {
        const exampleQueries: string[] = [];
        for (const run of runs ?? []) {
          const mentions = (run.competitor_mentions ?? []) as { name: string; mentioned: boolean }[];
          if (mentions.find((m) => m.name.toLowerCase() === stat.competitor.toLowerCase() && m.mentioned)) {
            const q = promptTextById.get(run.prompt_id);
            if (q && !exampleQueries.includes(q)) exampleQueries.push(q);
          }
        }
        const card = await generateBattlecard(stat, brandName ?? "", exampleQueries.slice(0, 6));
        return { ...card, stat };
      })
    );

    return NextResponse.json({ cards });
  } catch (err) {
    console.error("battlecards generate error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
