import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCompetitorWinReasons } from "@/lib/competitor-intel";

// GET /api/competitors/why?brandId=... — per-prompt reasons a competitor beats
// the brand (recommended when absent, outranks you, cited alongside you). Pure
// derived data; no LLM call.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const reasons = await getCompetitorWinReasons(supabase, brandId);
    return NextResponse.json({ reasons });
  } catch (err) {
    console.error("competitor why error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
