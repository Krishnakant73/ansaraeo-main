import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { crawlInternalLinks } from "@/lib/internal-link-graph";

// POST /api/internal-links — Body: { brandId }
// Crawls the brand's sitemap + pages to build an internal-link graph and a
// keyword-cannibalization audit. Analysis only (nothing persisted). User-facing
// → cookie client + extended maxDuration for the crawl.
export const maxDuration = 60;

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
      .select("name, domain")
      .eq("id", brandId)
      .single();
    if (!brand || !brand.domain) {
      return NextResponse.json({ error: "Brand has no domain to crawl." }, { status: 400 });
    }

    const result = await crawlInternalLinks({ domain: brand.domain });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("internal-links error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error crawling internal links" },
      { status: 500 }
    );
  }
}
