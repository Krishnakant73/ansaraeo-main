import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeTopicalCoverage } from "@/lib/topical-coverage";

// POST /api/competitor-topics — Body: { brandId, competitors: string[] }
// Cross-domain topical-coverage comparison (brand sitemap vs competitor
// sitemaps). Deterministic, no LLM, analysis only (nothing persisted).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId, competitors } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    if (!Array.isArray(competitors) || competitors.filter((c) => c?.trim()).length === 0) {
      return NextResponse.json({ error: "At least one competitor domain is required" }, { status: 400 });
    }

    const { data: brand } = await supabase
      .from("brands")
      .select("domain")
      .eq("id", brandId)
      .single();
    if (!brand?.domain) {
      return NextResponse.json({ error: "Brand has no domain to analyze." }, { status: 400 });
    }

    const result = await analyzeTopicalCoverage({
      url: brand.domain.startsWith("http") ? brand.domain : `https://${brand.domain}`,
      competitors: competitors.map((c: string) => c.trim()).filter(Boolean),
    });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("competitor-topics error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error analyzing topical coverage" },
      { status: 500 }
    );
  }
}
