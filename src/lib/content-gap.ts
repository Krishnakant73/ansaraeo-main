import type { SupabaseClient } from "@supabase/supabase-js";
import { getInternalLLM } from "@/lib/llm";

// ============================================================
// Content Gaps + keyword research (Batch 25)
//
// Two capabilities that turn the visibility data into a content plan:
//   1. getContentGaps() — existing tracked prompts where the brand is NOT
//      mentioned but a competitor IS. These are the highest-intent gaps to
//      close with new content, ranked by how badly you're losing them.
//   2. suggestKeywordPrompts() — LLM-generated question-style prompts the
//      brand SHOULD be tracking/answering, seeded from real brand info +
//      existing prompts. Candidates only — the human decides what to add.
//
// Reads existing prompts / visibility_runs — no new tables. Uses the cookie
// (RLS-scoped) client passed in by the route.
// ============================================================

export type ContentGap = {
  promptId: string;
  promptText: string;
  totalRuns: number;
  brandMissedRuns: number;
  competitorsAhead: string[];
  lossRate: number; // % of runs where a competitor beat you (you absent, they present)
};

type CompetitorMention = { name: string; mentioned: boolean; position: number | null };

export async function getContentGaps(supabase: SupabaseClient, brandId: string): Promise<ContentGap[]> {
  const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brandId);
  if (!prompts || prompts.length === 0) return [];
  const promptIds = prompts.map((p) => p.id);

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("prompt_id, brand_mentioned, competitor_mentions")
    .in("prompt_id", promptIds);
  if (!runs || runs.length === 0) return [];

  const byPrompt = new Map<string, { total: number; missed: number; competitors: Map<string, number> }>();
  for (const run of runs) {
    const entry = byPrompt.get(run.prompt_id) ?? { total: 0, missed: 0, competitors: new Map() };
    entry.total += 1;
    const mentions = (run.competitor_mentions ?? []) as CompetitorMention[];
    const competitorPresent = mentions.some((m) => m.mentioned);
    if (run.brand_mentioned !== true && competitorPresent) {
      entry.missed += 1;
      for (const m of mentions) if (m.mentioned) entry.competitors.set(m.name, (entry.competitors.get(m.name) ?? 0) + 1);
    }
    byPrompt.set(run.prompt_id, entry);
  }

  const textById = new Map(prompts.map((p) => [p.id, p.text]));
  return Array.from(byPrompt.entries())
    .filter(([, v]) => v.missed > 0)
    .map(([promptId, v]) => ({
      promptId,
      promptText: textById.get(promptId) ?? "",
      totalRuns: v.total,
      brandMissedRuns: v.missed,
      competitorsAhead: Array.from(v.competitors.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
      lossRate: v.total > 0 ? Math.round((v.missed / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.lossRate - a.lossRate || b.brandMissedRuns - a.brandMissedRuns);
}

export type KeywordSuggestion = { prompt: string; rationale: string };

// LLM keyword/prompt discovery. Grounded in real brand info + existing
// prompts; returns candidate questions the brand could target. It does NOT
// invent facts about the brand — it proposes questions, not claims.
export async function suggestKeywordPrompts(params: {
  brandName: string;
  industry: string | null;
  existingPrompts: string[];
}): Promise<KeywordSuggestion[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  const prompt = `You are an Answer Engine Optimization strategist for the brand "${params.brandName}"${
    params.industry ? ` in the ${params.industry} industry` : ""
  }.

The brand already tracks these questions:
${params.existingPrompts.map((p) => `- ${p}`).join("\n") || "(none yet)"}

Propose 8 NEW, high-intent questions a real customer might ask an AI assistant (ChatGPT, Perplexity, Gemini) where this brand would want to be mentioned. Avoid duplicating the existing ones. Prefer natural, specific, buyer-intent phrasing. For an India-focused brand, include locally relevant phrasing where natural.

Respond ONLY as JSON: {"suggestions": [{"prompt": string, "rationale": string (one short sentence why it matters)}]}.`;

  const raw = await getInternalLLM().generate({
    prompt,
    json: true,
  });
  const parsed = JSON.parse(raw ?? "{}");
  return (parsed.suggestions ?? []) as KeywordSuggestion[];
}
