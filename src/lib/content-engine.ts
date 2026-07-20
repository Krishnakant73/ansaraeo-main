// ============================================================
// Content Studio generation logic (Part 4, Tier 1 & Tier 4 / Part 7)
//
// Deliberately generates a DRAFT, never a finished, publish-ready
// article. The system prompt explicitly asks the model to leave
// placeholder markers for things only the brand owner can truthfully
// fill in (real examples, real data, author identity) — this is what
// makes the E-E-A-T checklist in the UI meaningful rather than
// decorative, and it's a direct implementation of the Google-safe
// content strategy from 07-agentic-automation-integrations.md, Section 5.
//
// LLM transport migration (2026-07-20): This file was the FIRST caller
// rewired through the constitution's ModelRouter. It now routes through
// OpenRouter with the DEFAULT capability instead of hitting the OpenAI
// provider directly. The system prompt still lives here (rather than
// /prompts/*.md) because buildShapeRail() computes it dynamically from
// engine personality — a static template can't express that logic. Same
// JSON contract, same [ADD …] honesty behavior; the shape-rail
// deterministic path is still fully unit-tested in content-engine.test.ts.
// Falls back to getInternalLLM() when OPENROUTER_API_KEY is unset so this
// change is safe to deploy before the router is fully provisioned.
// ============================================================

import { getInternalLLM } from "./llm";
import { getModelRouter } from "@/services/model-router";
import type { EnginePersonality } from "./engine-personality";

// ============================================================
// Engine-tuned drafting.
// When a `targetEngine` + `enginePersonality` is passed, the system
// prompt gains a "shape rail" block that steers voice / structure /
// citation appetite toward what THIS engine actually quotes. The
// [ADD …] honesty rules stay identical — this file never fabricates
// owner-only facts regardless of target.
// ============================================================

export type EngineShapeRail = {
  engineName: string;
  engineDisplay: string;
  personality: EnginePersonality;
};

export async function generateContentDraft(params: {
  brandName: string;
  promptText: string;
  industry: string | null;
  target?: EngineShapeRail;
}): Promise<{ title: string; contentMarkdown: string }> {
  const shapeRail = params.target ? buildShapeRail(params.target) : "";

  const system = `You write DRAFT content briefs for a human marketer to review and finish — never a
finished, ready-to-publish article. The brand is "${params.brandName}"${
    params.industry ? `, in the ${params.industry} industry` : ""
  }.

The goal is to close a visibility gap: this brand is currently NOT mentioned when AI
assistants are asked a specific question. Write content genuinely useful for a human
reader that would also give an AI assistant good reason to cite this brand for that
question.

CRITICAL — insert these exact placeholder markers wherever they apply, do not invent
specifics on the brand's behalf:
- [ADD REAL EXAMPLE: ...] where a genuine customer example or use case would help
- [ADD ORIGINAL DATA POINT: ...] where a real statistic specific to this brand would help
- [ADD AUTHOR NAME/CREDENTIALS] near the top
${shapeRail}
Respond ONLY as JSON: {"title": string, "contentMarkdown": string}. Keep it to roughly
400-600 words, in Markdown with a few headers.`;

  const prompt = `Write a draft aimed at this exact question a customer might ask an AI assistant: "${params.promptText}"`;

  const raw = await callLlm({ system, prompt });
  return JSON.parse(raw) as { title: string; contentMarkdown: string };
}

// Transport indirection so the migration is one place, not scattered inside
// every generation function. Prefers ModelRouter → OpenRouter; falls back to
// the legacy internal LLM provider when OPENROUTER_API_KEY is unset. Both
// paths honor the same JSON-mode contract.
async function callLlm(params: { system: string; prompt: string }): Promise<string> {
  if (process.env.OPENROUTER_API_KEY) {
    const response = await getModelRouter().complete({
      capability: "DEFAULT",
      system: params.system,
      prompt: params.prompt,
      json: true,
      caller: "content-engine",
      // Content drafts are per-prompt unique; 5-minute cache dedupes
      // accidental double-clicks without staling useful variation.
      cacheTtlSeconds: 5 * 60,
    });
    return response.content;
  }
  return getInternalLLM().generate({
    system: params.system,
    prompt: params.prompt,
    json: true,
  });
}

// buildShapeRail — deterministic mapping from engine personality to a
// short "rail" of drafting constraints. NEVER invents facts; only
// changes voice, structure, and citation appetite. Kept pure so tests
// can exercise it without any LLM call.
export function buildShapeRail(target: EngineShapeRail): string {
  const p = target.personality;
  const lines: string[] = [
    "",
    `TARGET ENGINE: ${target.engineDisplay}. Shape the draft so this engine quotes it.`,
  ];

  // Verbosity → length + density.
  if (p.verbosity >= 67) {
    lines.push("- LENGTH: aim for the upper end (550-600 words) with multi-paragraph depth.");
  } else if (p.verbosity < 34) {
    lines.push("- LENGTH: keep it tight (400-450 words). Front-load the answer in the first paragraph.");
  }

  // Hedging → tone.
  if (p.hedging < 34) {
    lines.push("- TONE: prescriptive and definitive. Use imperative verbs. Avoid \"may\", \"could\", \"typically\".");
  } else if (p.hedging >= 67) {
    lines.push("- TONE: mix confident directives with honest qualifiers — this engine cites careful language.");
  }

  // Format bias → structural choice.
  if (p.format_bias >= 67) {
    lines.push("- STRUCTURE: prefer bulleted lists and numbered steps. Include a TL;DR bullet list right after the intro.");
  } else if (p.format_bias < 34) {
    lines.push("- STRUCTURE: prefer flowing prose paragraphs. Bullets only where a genuine list applies.");
  } else {
    lines.push("- STRUCTURE: a bulleted TL;DR at the top, prose below it.");
  }

  // Freshness bias.
  if (p.freshness_bias >= 67) {
    lines.push("- RECENCY: mark this content as recently updated; include a \"Last updated:\" line placeholder near the top.");
  }

  // Citation density → how much the draft should invite external sources.
  if (p.citation_density >= 67) {
    lines.push("- CITATIONS: leave [ADD SOURCE URL: ...] placeholders every 2-3 factual claims. This engine ranks by citation graph.");
  } else if (p.citation_density < 34) {
    lines.push("- CITATIONS: cite sparingly. This engine rarely surfaces links — being IN the answer beats being linked to.");
  }

  // Entity resolution → naming.
  if (p.entity_resolution >= 67) {
    lines.push(
      "- NAMING: this engine names specific brands often. Reference the brand by name in the first paragraph.",
    );
  }

  // Engine-specific overlay — a couple of moves you can't derive from personality alone.
  switch (target.engineName) {
    case "chatgpt":
      lines.push("- MOVE: include one clear \"Recommendation:\" line the model can quote verbatim.");
      break;
    case "perplexity":
      lines.push("- MOVE: end with a \"Sources & further reading\" section that invites external citation.");
      break;
    case "gemini":
      lines.push("- MOVE: include a short FAQ block (2-3 Q&A pairs) — Gemini extracts from structured Q&A.");
      break;
    case "google_ai_overview":
      lines.push("- MOVE: put the definitive answer in a 40-60 word snippet directly under the H1. That's what AI Overview lifts.");
      break;
    case "grok":
      lines.push("- MOVE: cover the topic breadth, not just one angle. Mention 3-4 adjacent sub-topics with brief context.");
      break;
    case "copilot":
      lines.push("- MOVE: include an enterprise-fit signal (compliance, integration, SLA) even if brief.");
      break;
  }

  return lines.join("\n") + "\n";
}

// Loader helper: fetches a cached engine_personalities row (with a live
// fallback via the personality endpoint pattern) for a given engine
// name + brand. Kept here so route handlers stay thin.
 
export async function loadShapeRail(
   
  supabase: any,
  engineName: string,
  brandId: string,
): Promise<EngineShapeRail | null> {
  const { data: engine } = await supabase
    .from("engines")
    .select("id, name")
    .eq("name", engineName)
    .maybeSingle();
  if (!engine) return null;

  const { ENGINE_META_MAP } = await import("./engine-workspace");
  const meta = ENGINE_META_MAP[engineName];
  if (!meta) return null;

  const { data: cached } = await supabase
    .from("engine_personalities")
    .select(
      "verbosity, hedging, format_bias, freshness_bias, citation_density, entity_resolution, runs_observed, sample_run_ids",
    )
    .eq("engine_id", (engine as { id: string }).id)
    .eq("brand_id", brandId)
    .maybeSingle();

  const personality: EnginePersonality = cached
    ? {
        verbosity: Number(cached.verbosity) || 0,
        hedging: Number(cached.hedging) || 0,
        format_bias: Number(cached.format_bias) || 0,
        freshness_bias: Number(cached.freshness_bias) || 0,
        citation_density: Number(cached.citation_density) || 0,
        entity_resolution: Number(cached.entity_resolution) || 0,
        runs_observed: Number(cached.runs_observed) || 0,
        sample_run_ids: (cached.sample_run_ids as string[] | null) ?? [],
      }
    : {
        verbosity: 0,
        hedging: 0,
        format_bias: 0,
        freshness_bias: 0,
        citation_density: 0,
        entity_resolution: 0,
        runs_observed: 0,
        sample_run_ids: [],
      };

  return {
    engineName: (engine as { name: string }).name,
    engineDisplay: meta.displayName,
    personality,
  };
}
