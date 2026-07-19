import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAnswerBlocks } from "@/lib/answer-blocks";

// POST /api/answer-blocks — generate AEO answer blocks for a question.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { brandId?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brandId } = body;
  const question = (body.question ?? "").trim();
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  // RLS scopes this to brands the user owns.
  const { data: brand } = await supabase.from("brands").select("name, industry").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  try {
    const result = await generateAnswerBlocks({ question, brandName: brand.name, industry: brand.industry });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
