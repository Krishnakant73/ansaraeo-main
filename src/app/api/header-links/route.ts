import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeHeaderLinks } from "@/lib/header-link-graph";

// POST /api/header-links — Body: { url } | { brandId }
// Reads each crawled page's HTTP response headers to build a header link graph
// and surface per-page AI-discovery signals (canonical, llms.txt/ai.txt
// advertisement, X-Robots-Tag AI blocks). Analysis only (nothing persisted).
export const maxDuration = 60;

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

    const result = await analyzeHeaderLinks({ url: targetUrl });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("header-links error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error analyzing header links" },
      { status: 500 }
    );
  }
}
