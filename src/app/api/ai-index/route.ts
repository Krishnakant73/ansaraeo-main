import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAiIndex } from "@/lib/ai-index-generator";

// POST /api/ai-index — Body: { brandId }
// Generates llms.txt, a robots.txt AI-welcome block, and an Organization
// JSON-LD stub for the selected brand's domain. Read-only generation from
// the brand's own live site — nothing is written to the DB.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const { data: brand } = await supabase
      .from("brands")
      .select("name, domain, industry")
      .eq("id", brandId)
      .single();
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const result = await generateAiIndex({
      brandName: brand.name,
      domain: brand.domain,
      industry: brand.industry ?? null,
    });

    return NextResponse.json({ result });
  } catch (err) {
    console.error("ai-index error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error generating AI index files" },
      { status: 500 }
    );
  }
}
