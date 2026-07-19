import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestKeywordPrompts } from "@/lib/content-gap";

// POST /api/content/keywords — Body: { brandId }
// LLM-suggested new question-style prompts the brand should target, seeded
// from its real info + existing prompts. Candidates only — the user adds
// the ones they want via POST /api/prompts.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const { data: brand } = await supabase.from("brands").select("name, industry").eq("id", brandId).single();
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const { data: prompts } = await supabase.from("prompts").select("text").eq("brand_id", brandId);
    const existingPrompts = (prompts ?? []).map((p) => p.text);

    const suggestions = await suggestKeywordPrompts({
      brandName: brand.name,
      industry: brand.industry ?? null,
      existingPrompts,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("content keywords error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error suggesting keywords" },
      { status: 500 }
    );
  }
}
