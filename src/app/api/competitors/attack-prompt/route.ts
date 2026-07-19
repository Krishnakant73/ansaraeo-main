import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/competitors/attack-prompt
// Body: { competitorId: string, promptId: string }
//
// Creates an opportunity_recommendations row tying the specific
// prompt + competitor. Idempotent per (brand_id, type, prompt_id,
// competitor_id) triple — if one already exists we return that
// instead of inserting a duplicate. RLS enforces org access.
//
// Called from the "Attack this" button on Prompt Dominance rows.
// ============================================================

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { competitorId?: string; promptId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const competitorId = String(body.competitorId ?? "").trim();
  const promptId = String(body.promptId ?? "").trim();
  if (!competitorId || !promptId) {
    return NextResponse.json({ error: "missing_ids" }, { status: 400 });
  }

  // Resolve brand_id via the competitor (RLS gates the read).
  const { data: comp } = await supabase
    .from("competitors")
    .select("id, brand_id, name")
    .eq("id", competitorId)
    .maybeSingle();
  if (!comp) return NextResponse.json({ error: "competitor_not_found" }, { status: 404 });

  const { data: prompt } = await supabase
    .from("prompts")
    .select("id, text, brand_id")
    .eq("id", promptId)
    .maybeSingle();
  if (!prompt) return NextResponse.json({ error: "prompt_not_found" }, { status: 404 });
  const compRow = comp as { id: string; brand_id: string; name: string };
  const promptRow = prompt as { id: string; text: string; brand_id: string };

  if (promptRow.brand_id !== compRow.brand_id) {
    return NextResponse.json({ error: "brand_mismatch" }, { status: 400 });
  }

  // Idempotency: return existing row if one already exists for this triple.
  const { data: existing } = await supabase
    .from("opportunity_recommendations")
    .select("id")
    .eq("brand_id", compRow.brand_id)
    .eq("competitor_id", compRow.id)
    .eq("prompt_id", promptRow.id)
    .eq("type", "prompt_attack")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, id: (existing as { id: string }).id, existed: true });
  }

  const { data: inserted, error } = await supabase
    .from("opportunity_recommendations")
    .insert({
      brand_id: compRow.brand_id,
      competitor_id: compRow.id,
      prompt_id: promptRow.id,
      type: "prompt_attack",
      title: `Attack: ${(promptRow.text ?? "").slice(0, 120)}`,
      detail: {
        rationale: `Close the gap where ${compRow.name} outperforms you on this prompt.`,
        prompt_text: promptRow.text,
        competitor_name: compRow.name,
      },
      estimated_impact: {
        surface: "answer-engine",
        signal: "prompt-gap",
      },
      priority_score: 75,
      status: "open",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (inserted as { id: string }).id, existed: false });
}
