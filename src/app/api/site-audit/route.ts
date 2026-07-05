import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSiteAudit } from "@/lib/site-audit-engine";

// POST /api/site-audit — runs a live audit against the brand's domain and stores it
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const { data: brand } = await supabase.from("brands").select("domain").eq("id", brandId).single();
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const result = await runSiteAudit(brand.domain);

    const { data: audit, error } = await supabase
      .from("site_audits")
      .insert({
        brand_id: brandId,
        overall_score: result.overallScore,
        schema_markup_score: result.schemaMarkupScore,
        crawlability_score: result.crawlabilityScore,
        llms_txt_present: result.llmsTxtPresent,
        issues: result.issues,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, audit });
  } catch (err) {
    console.error("site-audit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error running site audit" },
      { status: 500 }
    );
  }
}
