import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/prompts — add one prompt manually to the user's brand
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { brandId, text, language } = await request.json();
  if (!brandId || !text) {
    return NextResponse.json({ error: "brandId and text are required" }, { status: 400 });
  }

  // RLS ensures this insert fails silently-safe if the user doesn't own brandId
  const { data, error } = await supabase
    .from("prompts")
    .insert({ brand_id: brandId, text, language: language ?? "en" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, prompt: data });
}
