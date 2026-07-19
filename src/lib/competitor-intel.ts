import type { SupabaseClient } from "@supabase/supabase-js";
import { getInternalLLM } from "@/lib/llm";

// ============================================================
// Competitor Intelligence (Batch 24)
//
// Two capabilities the wider GEO field has but AnsarAEO lacked:
//  1. Citation Opportunities — domains that get cited in answers where a
//     competitor is mentioned but YOUR brand is not. These are concrete
//     outreach / "get cited here" targets, with an AI-written brief.
//  2. Competitor Battlecards — per-competitor share-of-voice + sentiment,
//     plus an AI side-by-side strengths/weaknesses/recommendation card.
//
// These read the existing visibility_runs / citations / competitor_mentions
// data — no new tables required. Routes pass in the cookie (RLS-scoped)
// client so user boundaries are always respected.
// ============================================================

export type CitationOpportunity = {
  domain: string;
  timesCitedAgainstYou: number;
  competitorNames: string[];
  exampleQueries: string[];
};

type CompetitorMention = { name: string; mentioned: boolean; position: number | null };

export async function getCitationOpportunities(
  supabase: SupabaseClient,
  brandId: string
): Promise<CitationOpportunity[]> {
  const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brandId);
  const promptIds = (prompts ?? []).map((p) => p.id);
  if (promptIds.length === 0) return [];

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, prompt_id, brand_mentioned, competitor_mentions, prompts(text)")
    .in("prompt_id", promptIds);
  if (!runs || runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const { data: citations } = await supabase
    .from("citations")
    .select("run_id, cited_domain")
    .in("run_id", runIds);

  const citeByRun = new Map<string, string[]>();
  for (const c of citations ?? []) {
    if (!c.cited_domain) continue;
    const list = citeByRun.get(c.run_id) ?? [];
    list.push(c.cited_domain);
    citeByRun.set(c.run_id, list);
  }

  const promptTextById = new Map((prompts ?? []).map((p) => [p.id, p.text]));
  const agg = new Map<string, { count: number; competitors: Set<string>; queries: Set<string> }>();

  for (const run of runs) {
    const mentions = (run.competitor_mentions ?? []) as CompetitorMention[];
    const competitorMentioned = mentions.some((m) => m.mentioned);
    const brandMentioned = run.brand_mentioned === true;

    // Lost opportunity: a competitor showed up, you didn't.
    if (competitorMentioned && !brandMentioned) {
      for (const domain of citeByRun.get(run.id) ?? []) {
        const entry = agg.get(domain) ?? { count: 0, competitors: new Set(), queries: new Set() };
        entry.count += 1;
        for (const m of mentions) if (m.mentioned) entry.competitors.add(m.name);
        const q = promptTextById.get(run.prompt_id);
        if (q) entry.queries.add(q);
        agg.set(domain, entry);
      }
    }
  }

  return Array.from(agg.entries())
    .map(([domain, v]) => ({
      domain,
      timesCitedAgainstYou: v.count,
      competitorNames: Array.from(v.competitors),
      exampleQueries: Array.from(v.queries).slice(0, 5),
    }))
    .sort((a, b) => b.timesCitedAgainstYou - a.timesCitedAgainstYou);
}

// AI-written outreach brief for a single lost-citation domain.
export async function generateOutreachBrief(
  opportunity: CitationOpportunity,
  brandName: string
): Promise<string> {
  const prompt = `You are an AEO (Answer Engine Optimization) outreach strategist.
A brand "${brandName}" is NOT being cited by AI answer engines for queries where its competitors ARE cited,
and the domain "${opportunity.domain}" is being cited in those answers instead.
Competitors showing up: ${opportunity.competitorNames.join(", ") || "unknown"}.
Example queries where this happens:
${opportunity.exampleQueries.map((q) => `- ${q}`).join("\n") || "(none captured)"}

Write a concise, practical outreach/earned-citation brief (max 150 words) for ${brandName}'s team:
how to get "${opportunity.domain}" (or the authors behind it) to cite ${brandName} in future AI answers.
Be specific and actionable. Do not invent partnerships.`;

  const raw = await getInternalLLM().generate({ prompt });
  return raw ?? "";
}

export type BattlecardStat = {
  competitor: string;
  mentionedRuns: number;
  totalRuns: number;
  sharePercent: number;
  sentiment: { positive: number; neutral: number; negative: number };
};

export async function getBattlecardStats(
  supabase: SupabaseClient,
  brandId: string
): Promise<BattlecardStat[]> {
  const { data: prompts } = await supabase.from("prompts").select("id").eq("brand_id", brandId);
  const promptIds = (prompts ?? []).map((p) => p.id);
  if (promptIds.length === 0) return [];

  const { data: competitors } = await supabase
    .from("competitors")
    .select("name")
    .eq("brand_id", brandId)
    .eq("confirmed", true);
  const competitorNames = (competitors ?? []).map((c) => c.name);
  if (competitorNames.length === 0) return [];

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("competitor_mentions, brand_mentioned, sentiment")
    .in("prompt_id", promptIds);
  const totalRuns = runs?.length ?? 0;

  const stats: BattlecardStat[] = competitorNames.map((name) => {
    let mentionedRuns = 0;
    const sentiment = { positive: 0, neutral: 0, negative: 0 };
    for (const run of runs ?? []) {
      const mentions = (run.competitor_mentions ?? []) as CompetitorMention[];
      const hit = mentions.find((m) => m.name.toLowerCase() === name.toLowerCase());
      if (hit?.mentioned) {
        mentionedRuns += 1;
        if (run.sentiment === "positive") sentiment.positive += 1;
        else if (run.sentiment === "negative") sentiment.negative += 1;
        else sentiment.neutral += 1;
      }
    }
    return {
      competitor: name,
      mentionedRuns,
      totalRuns,
      sharePercent: totalRuns > 0 ? Math.round((mentionedRuns / totalRuns) * 100) : 0,
      sentiment,
    };
  });

  return stats.sort((a, b) => b.mentionedRuns - a.mentionedRuns);
}

export type Battlecard = {
  competitor: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
};

// AI side-by-side battlecard. Kept honest: grounded only in the provided
// stats + example queries, not invented market claims.
export async function generateBattlecard(
  stat: BattlecardStat,
  brandName: string,
  exampleQueries: string[]
): Promise<Battlecard> {
  const prompt = `You are building a competitor battlecard for the brand "${brandName}".
Competitor: "${stat.competitor}".
Observed data from AI answer-engine visibility runs:
- Mentioned in ${stat.mentionedRuns} of ${stat.totalRuns} tracked queries (share of voice ${stat.sharePercent}%).
- When mentioned, sentiment was: ${stat.sentiment.positive} positive, ${stat.sentiment.neutral} neutral, ${stat.sentiment.negative} negative.
Example queries where this competitor appears:
${exampleQueries.map((q) => `- ${q}`).join("\n") || "(none captured)"}

Respond ONLY with JSON:
{"competitor": string, "strengths": string[] (2-4, what they do well in AI visibility), "weaknesses": string[] (2-4, gaps ${brandName} can exploit), "recommendation": string (one actionable sentence for ${brandName})}.
Base every point on the data above. Do not invent facts.`;

  const raw = await getInternalLLM().generate({ prompt, json: true });
  return JSON.parse(raw ?? "{}");
}

// ============================================================
// Competitor "why they win" — the gap the brief calls out: not just that a
// competitor beats you, but WHY, per prompt. Deterministic, derived purely from
// recorded visibility_runs + citations. No LLM, no new tables.
// ============================================================

export type CompetitorWinReason = {
  competitor: string;
  promptId: string;
  promptText: string;
  reason: string; // human-readable, e.g. "Recommended when your brand is absent"
  brandMentioned: boolean;
  competitorPosition: number | null;
  brandPosition: number | null;
  competitorCited: boolean; // a competitor-domain citation appeared in the run
};

export async function getCompetitorWinReasons(
  supabase: SupabaseClient,
  brandId: string
): Promise<CompetitorWinReason[]> {
  const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brandId);
  const promptIds = (prompts ?? []).map((p) => p.id);
  if (promptIds.length === 0) return [];

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, prompt_id, brand_mentioned, brand_position, competitor_mentions")
    .in("prompt_id", promptIds);
  if (!runs || runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const { data: citations } = await supabase
    .from("citations")
    .select("run_id, is_competitor_domain")
    .in("run_id", runIds);

  const competitorCitedRuns = new Set(
    (citations ?? []).filter((c) => c.is_competitor_domain).map((c) => c.run_id),
  );
  const promptTextById = new Map((prompts ?? []).map((p) => [p.id, p.text]));

  const out: CompetitorWinReason[] = [];

  for (const run of runs) {
    const mentions = (run.competitor_mentions ?? []) as CompetitorMention[];
    const winners = mentions.filter((m) => m.mentioned);
    if (winners.length === 0) continue;

    const brandMentioned = run.brand_mentioned === true;
    const brandPos = typeof run.brand_position === "number" ? run.brand_position : null;
    const competitorCited = competitorCitedRuns.has(run.id);

    for (const w of winners) {
      let reason: string;
      if (!brandMentioned) {
        reason = competitorCited
          ? "Recommended and cited when your brand is absent"
          : "Recommended when your brand is absent";
      } else {
        const compPos = typeof w.position === "number" ? w.position : null;
        if (compPos !== null && brandPos !== null && compPos < brandPos) {
          reason = `Outranks you (#${compPos} vs #${brandPos})`;
        } else if (compPos !== null && brandPos === null) {
          reason = `Ranked #${compPos} while you have no position`;
        } else if (competitorCited) {
          reason = "Cited alongside you, but you are not the primary pick";
        } else {
          reason = "Appears alongside your brand";
        }
      }

      out.push({
        competitor: w.name,
        promptId: run.prompt_id,
        promptText: promptTextById.get(run.prompt_id) ?? "",
        reason,
        brandMentioned,
        competitorPosition: typeof w.position === "number" ? w.position : null,
        brandPosition: brandPos,
        competitorCited,
      });
    }
  }

  // Most damaging first: brand-absent wins, then outranks.
  const severity = (r: CompetitorWinReason) =>
    !r.brandMentioned ? 0 : r.reason.startsWith("Outranks") ? 1 : 2;
  return out.sort((a, b) => severity(a) - severity(b));
}
