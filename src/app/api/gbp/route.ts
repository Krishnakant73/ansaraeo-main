import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditGBP } from "@/lib/gbp-audit";

// POST /api/gbp — looks up a Google Business Profile and classifies its
// claimed/maintained status. Requires GOOGLE_PLACES_API_KEY (optional integration).
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to enable GBP audit." },
        { status: 400 }
      );
    }

    const { businessName, location } = await request.json();
    if (!businessName) return NextResponse.json({ error: "businessName is required" }, { status: 400 });

    const result = await auditGBP(businessName, location ?? "", apiKey);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("gbp audit error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error running GBP audit" }, { status: 500 });
  }
}
