import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateContentDraft } from "@/lib/content-engine";
import { logActivationEvent } from "@/lib/activation-events";

// ============================================================
// POST /api/onboarding/first-task  { brandId, goal }
//
// Drafts the first Copilot task for the user. Reuses generateContentDraft
// so the honesty rules (leaves `[ADD ...]` placeholders for owner-only
// facts) apply here too. Persists as a `content_items` row so the user
// can review it in the existing content editor.
// ============================================================

const VALID_GOALS = new Set(["chatgpt_mentions", "beat_competitor", "fix_site"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { brandId?: unknown; goal?: unknown };
  const brandId = typeof body.brandId === "string" ? body.brandId : null;
  const goal = typeof body.goal === "string" ? body.goal : null;
  if (!brandId || !goal || !VALID_GOALS.has(goal)) {
    return NextResponse.json({ error: "brandId and a valid goal are required" }, { status: 400 });
  }

  // RLS-scoped read of the brand.
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, domain, industry")
    .eq("id", brandId)
    .single();
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  // Pick the most-invisible prompt (same rule as the intro page).
  const svc = createServiceClient();
  const { data: prompts } = await svc.from("prompts").select("id, text").eq("brand_id", brandId);
  if (!prompts?.length) {
    return NextResponse.json({ error: "no prompts on this brand yet" }, { status: 400 });
  }
  const promptIds = prompts.map((p) => p.id);
  const { data: runs } = await svc
    .from("visibility_runs")
    .select("prompt_id, brand_mentioned")
    .in("prompt_id", promptIds);

  const missedByPrompt = new Map<string, number>();
  for (const p of prompts) missedByPrompt.set(p.id, 0);
  for (const r of runs ?? []) {
    if (!r.brand_mentioned) missedByPrompt.set(r.prompt_id, (missedByPrompt.get(r.prompt_id) ?? 0) + 1);
  }
  const target = [...prompts]
    .map((p) => ({ ...p, missed: missedByPrompt.get(p.id) ?? 0 }))
    .sort((a, b) => b.missed - a.missed || a.text.length - b.text.length)[0];

  let draft: { title: string; contentMarkdown: string };
  try {
    draft = await generateContentDraft({
      brandName: brand.name,
      promptText: target.text,
      industry: brand.industry,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Draft generation failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // Persist as a content_items row (existing table from migration 005).
  const { data: item, error: insertErr } = await supabase
    .from("content_items")
    .insert({
      brand_id: brandId,
      prompt_id: target.id,
      title: draft.title,
      content_markdown: draft.contentMarkdown,
      status: "draft",
      target_engine: "chatgpt",
    })
    .select("id")
    .single();

  if (insertErr || !item) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to save draft" },
      { status: 500 },
    );
  }

  await logActivationEvent({
    event: "first_draft_generated",
    userId: user.id,
    brandId,
    payload: { contentItemId: item.id, promptText: target.text, goal },
  });

  return NextResponse.json({ ok: true, contentItemId: item.id });
}
