import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCitationOpportunities, generateOutreachBrief } from "@/lib/competitor-intel";

// GET /api/competitors/opportunities?brandId=... — list domains cited where
// competitors appear but your brand does not (outreach targets).
// POST /api/competitors/opportunities — generate an AI outreach brief for one domain.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const opportunities = await getCitationOpportunities(supabase, brandId);
    return NextResponse.json({ opportunities });
  } catch (err) {
    console.error("opportunities error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId, domain, brandName } = await request.json();
    if (!brandId || !domain) return NextResponse.json({ error: "brandId and domain are required" }, { status: 400 });

    const opportunities = await getCitationOpportunities(supabase, brandId);
    const opp = opportunities.find((o) => o.domain === domain);
    if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    const brief = await generateOutreachBrief(opp, brandName ?? "");
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("opportunities brief error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
