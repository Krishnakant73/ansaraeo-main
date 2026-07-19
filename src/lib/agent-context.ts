import { createServiceClient } from "@/lib/supabase/server";
import { buildHistoryContext } from "@/lib/history-agent-context";

// ============================================================
// This is the "grounding" layer described in Part 4, Tier 2 and
// Part 7's Agent design: the chat agent must answer from the brand's
// REAL data, not a generic LLM response with no connection to reality.
//
// This MVP version does grounding via direct structured SQL queries
// (aggregate counts, recent runs, top citations) rather than full
// vector-search RAG over free-text content. That's a deliberate,
// reasonable simplification for now — 02-tech-stack-architecture.md's
// `knowledge_chunks` + pgvector table is the natural upgrade path once
// you have unstructured content (blog posts, full AI responses) that a
// keyword/structured query can't capture well. For structured metrics
// like "how many runs", "which engine", "what's cited" — direct SQL is
// actually more accurate than RAG would be, since there's no risk of the
// retrieval step missing the right numeric rows.
// ============================================================

export async function buildBrandContext(brandId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("name, domain, industry")
    .eq("id", brandId)
    .single();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, language")
    .eq("brand_id", brandId);

  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("id, prompt_id, engine_id, brand_mentioned, sentiment, run_at, engines(name)")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(200)
    : { data: [] };

  const { data: competitors } = await supabase
    .from("competitors")
    .select("name")
    .eq("brand_id", brandId);

  const totalRuns = runs?.length ?? 0;
  const mentionedRuns = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const visibilityScore = totalRuns > 0 ? Math.round((mentionedRuns / totalRuns) * 100) : null;

  // Historical record (first mentions, competitor movers, lost citations, ...).
  const historyContext = await buildHistoryContext(brandId);

  // Per-engine breakdown
  const engineStats: Record<string, { total: number; mentioned: number }> = {};
  for (const r of runs ?? []) {
    const engineName = (Array.isArray(r.engines) ? r.engines[0] : r.engines)?.name ?? "unknown";
    if (!engineStats[engineName]) engineStats[engineName] = { total: 0, mentioned: 0 };
    engineStats[engineName].total += 1;
    if (r.brand_mentioned) engineStats[engineName].mentioned += 1;
  }

  // Which specific prompts are NOT getting the brand mentioned (the
  // most actionable thing the agent can surface — matches the "Top 5
  // Opportunities" pattern from 05-ui-ux-design-system.md)
  const promptResultMap = new Map<string, { text: string; mentioned: boolean }[]>();
  for (const r of runs ?? []) {
    const prompt = prompts?.find((p) => p.id === r.prompt_id);
    if (!prompt) continue;
    if (!promptResultMap.has(prompt.id)) promptResultMap.set(prompt.id, []);
    promptResultMap.get(prompt.id)!.push({ text: prompt.text, mentioned: r.brand_mentioned ?? false });
  }
  const missedPrompts = Array.from(promptResultMap.values())
    .filter((results) => results.every((r) => !r.mentioned))
    .map((results) => results[0].text)
    .slice(0, 10);

  return `
BRAND: ${brand?.name} (${brand?.domain}), industry: ${brand?.industry ?? "unspecified"}
COMPETITORS TRACKED: ${(competitors ?? []).map((c) => c.name).join(", ") || "none added yet"}

OVERALL VISIBILITY: ${visibilityScore !== null ? `${visibilityScore}% (${mentionedRuns} of ${totalRuns} runs mentioned the brand)` : "No runs yet"}

PER-ENGINE BREAKDOWN:
${
  Object.entries(engineStats)
    .map(([engine, s]) => `- ${engine}: mentioned in ${s.mentioned}/${s.total} runs`)
    .join("\n") || "No engine data yet"
}

TRACKED PROMPTS (${prompts?.length ?? 0} total): ${(prompts ?? []).map((p) => `"${p.text}"`).join("; ") || "none yet"}

PROMPTS WHERE THE BRAND IS NEVER MENTIONED (biggest opportunities):
${missedPrompts.length > 0 ? missedPrompts.map((p) => `- "${p}"`).join("\n") : "None found — either no gaps, or not enough run data yet"}

${historyContext}
`.trim();
}
