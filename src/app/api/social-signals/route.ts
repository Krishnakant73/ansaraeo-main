import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSocialSignals } from "@/lib/social-signals";

// POST /api/social-signals — Body: { brandId }
// Surfaces Reddit (+ optional YouTube) mentions of the brand and a
// sentiment breakdown. Read-only; nothing is persisted.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const { data: brand } = await supabase.from("brands").select("name").eq("id", brandId).single();
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const result = await getSocialSignals(brand.name);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("social-signals error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error fetching brand signals" },
      { status: 500 }
    );
  }
}
