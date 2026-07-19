import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGscRefreshToken, getAccessToken, requestIndexing } from "@/lib/gsc";

// POST /api/gsc/reindex — Body: { brandId, url, siteUrl? }
// Requests reindexing of a single URL via the Indexing API. Explicit
// user action only — we never auto-reindex.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId, url, siteUrl: siteUrlArg } = await request.json();
    if (!brandId || !url) return NextResponse.json({ error: "brandId and url are required" }, { status: 400 });

    const refreshToken = await getGscRefreshToken(supabase, brandId);
    if (!refreshToken) return NextResponse.json({ error: "GSC not connected" }, { status: 400 });

    let siteUrl = siteUrlArg as string | undefined;
    if (!siteUrl) {
      const { data: brand } = await supabase.from("brands").select("domain").eq("id", brandId).single();
      if (brand?.domain) siteUrl = brand.domain.startsWith("http") ? brand.domain : `https://${brand.domain}`;
    }
    if (!siteUrl) return NextResponse.json({ error: "Brand has no domain" }, { status: 400 });

    const accessToken = await getAccessToken(refreshToken);
    const outcome = await requestIndexing(accessToken, url);
    return NextResponse.json({ result: outcome });
  } catch (err) {
    console.error("gsc reindex error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reindex failed" }, { status: 500 });
  }
}
