import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContentGaps } from "@/lib/content-gap";

// GET /api/content/gaps?brandId=... — tracked prompts where the brand is not
// mentioned but a competitor is, ranked by loss rate. Cookie (RLS) client.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const brandId = request.nextUrl.searchParams.get("brandId");
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const gaps = await getContentGaps(supabase, brandId);
    return NextResponse.json({ gaps });
  } catch (err) {
    console.error("content gaps error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error computing content gaps" },
      { status: 500 }
    );
  }
}
