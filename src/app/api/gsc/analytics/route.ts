import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGscRefreshToken, getAccessToken, getSearchAnalytics, getBrandedLift } from "@/lib/gsc";

// POST /api/gsc/analytics — Body: { brandId, siteUrl?, days? }
// Returns top queries by impressions from GSC Search Analytics.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId, siteUrl: siteUrlArg, days } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const refreshToken = await getGscRefreshToken(supabase, brandId);
    if (!refreshToken) return NextResponse.json({ error: "GSC not connected" }, { status: 400 });

    let siteUrl = siteUrlArg as string | undefined;
    if (!siteUrl) {
      const { data: brand } = await supabase.from("brands").select("domain").eq("id", brandId).single();
      if (brand?.domain) siteUrl = brand.domain.startsWith("http") ? brand.domain : `https://${brand.domain}`;
    }
    if (!siteUrl) return NextResponse.json({ error: "Brand has no domain" }, { status: 400 });

    const accessToken = await getAccessToken(refreshToken);
    const rows = await getSearchAnalytics(accessToken, siteUrl, Number(days) || 28);

    const { data: brand } = await supabase.from("brands").select("name").eq("id", brandId).single();
    const brandedLift = brand?.name
      ? await getBrandedLift(accessToken, siteUrl, brand.name, (Number(days) || 28) * 2)
      : null;

    return NextResponse.json({ result: { siteUrl, rows, brandedLift } });
  } catch (err) {
    console.error("gsc analytics error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "GSC analytics failed" }, { status: 500 });
  }
}
