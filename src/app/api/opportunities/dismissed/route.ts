import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/opportunities/dismissed?brandId=<uuid>
// Returns { ids: string[] } — the opportunity ids the current user has
// dismissed for the given brand.
//
// Consumed by mission-control widgets and scan-classifier fallback UIs
// to filter out already-skipped missions before rendering.
// ============================================================

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ids: [] });

  const brandId = new URL(req.url).searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ ids: [] });

  const { data, error } = await supabase
    .from("opportunity_dismissals")
    .select("opportunity_id")
    .eq("brand_id", brandId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ ids: [], error: error.message }, { status: 500 });
  return NextResponse.json({ ids: (data ?? []).map((r) => r.opportunity_id) });
}
