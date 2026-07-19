import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePromptSuite } from "@/lib/prompt-suite";

// POST /api/prompt-suite — generate a monitoring prompt suite for a brand.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  let body: { brandId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brandId } = body;
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  // RLS scopes this to brands the user owns.
  const { data: brand } = await supabase
    .from("brands")
    .select("name, industry")
    .eq("id", brandId)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("prompts")
    .select("text")
    .eq("brand_id", brandId);

  try {
    const result = await generatePromptSuite({
      brandName: brand.name,
      industry: brand.industry,
      existingPrompts: (existing ?? []).map((p) => p.text),
    });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
