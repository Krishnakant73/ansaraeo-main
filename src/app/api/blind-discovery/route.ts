import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runBlindDiscovery } from "@/lib/blind-discovery";

// POST /api/blind-discovery — run an unbranded category question N times
// and measure organic recall for the brand + which competitors surface.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { brandId?: string; question?: string; engine?: string; runs?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brandId, engine } = body;
  const question = (body.question ?? "").trim();
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });
  if (!engine) return NextResponse.json({ error: "engine is required" }, { status: 400 });

  // RLS scopes both queries to brands the user owns.
  const { data: brand } = await supabase.from("brands").select("name").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const { data: competitors } = await supabase
    .from("competitors")
    .select("name")
    .eq("brand_id", brandId)
    .eq("confirmed", true);

  try {
    const result = await runBlindDiscovery({
      question,
      engine,
      brandName: brand.name,
      competitors: (competitors ?? []).map((c) => c.name),
      runs: body.runs,
    });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
