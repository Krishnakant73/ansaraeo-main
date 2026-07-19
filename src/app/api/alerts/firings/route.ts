import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listFirings } from "@/lib/alerts";

// GET /api/alerts/firings?brandId= — recent alert firings for a brand
// Cookie/RLS client — user-scoped.

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  const firings = await listFirings(supabase, brandId, 20);
  return NextResponse.json({ firings });
}
