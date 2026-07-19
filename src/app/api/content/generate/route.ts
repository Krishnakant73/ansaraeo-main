import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContentDraft } from "@/lib/content-engine";
import { createRateLimiter } from "@/lib/rate-limit";
import { parseJsonBody, contentGenerateSchema } from "@/lib/validate";

// POST /api/content/generate — Body: { promptId }
// Generates a draft aimed at a specific tracked prompt (typically one
// where the brand is currently NOT mentioned — the "gap" from the Agent
// or Dashboard's Top 5 Opportunities view).
const contentGenerateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const parsed = await parseJsonBody(request, contentGenerateSchema);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { promptId } = parsed.data;

    const { data: prompt } = await supabase
      .from("prompts")
      .select("id, text, brand_id, brands(name, industry)")
      .eq("id", promptId)
      .single();

    if (!prompt) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

    const brand = Array.isArray(prompt.brands) ? prompt.brands[0] : prompt.brands;

    const draft = await generateContentDraft({
      brandName: brand?.name ?? "the brand",
      promptText: prompt.text,
      industry: brand?.industry ?? null,
    });

    const { data: contentItem, error } = await supabase
      .from("content_items")
      .insert({
        brand_id: prompt.brand_id,
        prompt_id: promptId,
        title: draft.title,
        content_markdown: draft.contentMarkdown,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, contentItem });
  } catch (err) {
    console.error("content generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error generating content" },
      { status: 500 }
    );
  }
}
