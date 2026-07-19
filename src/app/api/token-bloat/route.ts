import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeTokenBloat } from "@/lib/token-bloat";

// POST /api/token-bloat — Body: { url } | { brandId }
// Deterministic AI-crawler token/efficiency measurement for a page.
// Analysis only, no LLM, no DB writes.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { url, brandId } = await request.json();
    let targetUrl = url as string | undefined;

    if (!targetUrl && brandId) {
      const { data: brand } = await supabase
        .from("brands")
        .select("domain")
        .eq("id", brandId)
        .single();
      if (!brand?.domain) {
        return NextResponse.json({ error: "Brand has no domain to analyze." }, { status: 400 });
      }
      targetUrl = brand.domain.startsWith("http") ? brand.domain : `https://${brand.domain}`;
    }

    if (!targetUrl) return NextResponse.json({ error: "url or brandId is required" }, { status: 400 });

    const result = await analyzeTokenBloat({ url: targetUrl });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("token-bloat error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error analyzing page" },
      { status: 500 }
    );
  }
}
