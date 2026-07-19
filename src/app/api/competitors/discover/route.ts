import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInternalLLM } from "@/lib/llm";

// ============================================================
// POST /api/competitors/discover — Body: { brandId }
//
// Auto-suggests 3-5 real, named competitors based on the brand's name,
// domain, and industry, using a web-search-grounded LLM call. Suggestions
// are inserted with confirmed=false (a "suggested" state) so the user
// reviews and confirms them rather than instantly starting to track
// unverified competitor names — same human-in-the-loop principle used
// for Content Studio's E-E-A-T gate.
// ============================================================

async function findCompetitors(brandName: string, domain: string, industry: string | null): Promise<string[]> {
  const raw = await getInternalLLM().generate({
    system: `You identify real, well-known market competitors for a given brand. Respond ONLY as JSON: {"competitors": string[]}. List 3-5 real, specific competitor brand/company names — never invent fictional companies, and never include the brand itself. If you are not confident about real competitors for this brand, return fewer results rather than guessing.`,
    prompt: `Brand: "${brandName}" (${domain})${industry ? `, industry: ${industry}` : ""}. Who are its real, direct market competitors?`,
    json: true,
  });
  const parsed = JSON.parse(raw ?? "{}");
  return (parsed.competitors as string[]) ?? [];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const { data: brand } = await supabase.from("brands").select("name, domain, industry").eq("id", brandId).single();
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const { data: existing } = await supabase.from("competitors").select("name").eq("brand_id", brandId);
    const existingNames = new Set((existing ?? []).map((c) => c.name.toLowerCase()));

    const suggested = await findCompetitors(brand.name, brand.domain, brand.industry);
    const newOnes = suggested.filter((name) => !existingNames.has(name.toLowerCase()));

    if (newOnes.length === 0) {
      return NextResponse.json({ success: true, added: [] });
    }

    const { data: inserted, error } = await supabase
      .from("competitors")
      .insert(newOnes.map((name) => ({ brand_id: brandId, name, source: "ai_suggested", confirmed: false })))
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, added: inserted });
  } catch (err) {
    console.error("competitor discovery error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error discovering competitors" },
      { status: 500 }
    );
  }
}
