// ============================================================
// Blind Discovery / Organic Recall (Batch 28 harvest:
// WannabDad/aeo-brand-scan)
//
// Runs an UNBRANDED category question ("What are the best X in India?")
// N times against a chosen AI engine and measures ORGANIC RECALL: does
// the brand surface when it is NOT named in the prompt? This is a
// different KPI from ordinary brand-named prompt tracking — it tells you
// whether the engine recommends you unprompted.
//
// For each run it also checks (deterministically) which of the brand's
// CONFIRMED competitors appear, so you see who the engine recommends
// instead of you.
//
// Stateless: NO DB writes (mirrors visibility-consistency). Brand and
// competitor presence use the deterministic substring/fuzzy check from
// mention-matcher — NOT an LLM self-report — so recall is honest and
// reproducible. Reuses the engine caller from visibility-consistency.
// ============================================================

import { deterministicMentionCheck } from "@/lib/mention-matcher";
import { callEngine } from "@/lib/visibility-consistency";

export type BlindRun = {
  run: number;
  brandFound: boolean;
  competitorsFound: string[];
  snippet: string;
  error?: string;
};

export type BlindDiscoveryResult = {
  question: string;
  engine: string;
  brandName: string;
  runs: number;
  brandRecallRuns: number;
  recallPercent: number; // brandRecallRuns ÷ runs
  competitorTally: { name: string; runs: number }[]; // sorted desc
  perRun: BlindRun[];
  notes: string[];
};

const missingKeyMessage: Record<string, string> = {
  chatgpt: "OPENAI_API_KEY not set — add it to run blind discovery on ChatGPT.",
  perplexity: "PERPLEXITY_API_KEY not set — add it to run blind discovery on Perplexity.",
  gemini: "GOOGLE_AI_API_KEY not set — add it to run blind discovery on Gemini.",
  grok: "GROK_API_KEY not set — add it to run blind discovery on Grok.",
  copilot: "COPILOT_API_URL/COPILOT_API_KEY not set — add them to run blind discovery on Copilot (a proxy).",
};

function keyMissing(engine: string): boolean {
  switch (engine) {
    case "chatgpt":
      return !process.env.OPENAI_API_KEY;
    case "perplexity":
      return !process.env.PERPLEXITY_API_KEY;
    case "gemini":
      return !process.env.GOOGLE_AI_API_KEY;
    case "grok":
      return !process.env.GROK_API_KEY;
    case "copilot":
      return !process.env.COPILOT_API_URL || !process.env.COPILOT_API_KEY;
    default:
      return false;
  }
}

function buildSnippet(text: string, len = 200): string {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length <= len ? trimmed : trimmed.slice(0, len) + "…";
}

export async function runBlindDiscovery(params: {
  question: string;
  engine: string;
  brandName: string;
  competitors: string[];
  runs?: number;
}): Promise<BlindDiscoveryResult> {
  const { question, engine, brandName, competitors } = params;
  const runs = Math.min(5, Math.max(2, Math.floor(params.runs ?? 3)));

  const baseNotes = [
    "Blind discovery uses a category question that does NOT name your brand — it measures whether AI recommends you unprompted (organic recall), not brand-name lookups.",
  ];

  // google_ai_overview is a SERP scrape, not a repeated-prompt chat engine.
  if (engine === "google_ai_overview") {
    return {
      question,
      engine,
      brandName,
      runs: 0,
      brandRecallRuns: 0,
      recallPercent: 0,
      competitorTally: [],
      perRun: [],
      notes: ["google_ai_overview is a SERP scrape, not suited to repeated-prompt sampling. Choose chatgpt/perplexity/gemini/grok/copilot."],
    };
  }

  if (keyMissing(engine)) {
    return {
      question,
      engine,
      brandName,
      runs: 0,
      brandRecallRuns: 0,
      recallPercent: 0,
      competitorTally: [],
      perRun: [],
      notes: [missingKeyMessage[engine] ?? `No API key configured for "${engine}".`, ...baseNotes],
    };
  }

  const perRun: BlindRun[] = [];
  const tally = new Map<string, number>();
  let brandRecallRuns = 0;

  for (let i = 1; i <= runs; i++) {
    let content = "";
    try {
      content = await callEngine(engine, question);
    } catch (err) {
      perRun.push({
        run: i,
        brandFound: false,
        competitorsFound: [],
        snippet: "",
        error: `Error during run ${i}: ${(err as Error).message}`,
      });
      continue;
    }

    const brandFound = deterministicMentionCheck(content, brandName);
    if (brandFound) brandRecallRuns += 1;

    const competitorsFound = competitors.filter((c) => c.trim() && deterministicMentionCheck(content, c));
    for (const c of competitorsFound) tally.set(c, (tally.get(c) ?? 0) + 1);

    perRun.push({ run: i, brandFound, competitorsFound, snippet: buildSnippet(content) });
  }

  const recallPercent = runs > 0 ? Math.round((brandRecallRuns / runs) * 100) : 0;
  const competitorTally = Array.from(tally.entries())
    .map(([name, r]) => ({ name, runs: r }))
    .sort((a, b) => b.runs - a.runs);

  const notes = [...baseNotes];
  if (competitors.length === 0) {
    notes.push("No confirmed competitors on file — add competitors to see who the engine recommends instead of you.");
  }

  return {
    question,
    engine,
    brandName,
    runs,
    brandRecallRuns,
    recallPercent,
    competitorTally,
    perRun,
    notes,
  };
}
