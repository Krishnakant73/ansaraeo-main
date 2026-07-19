// ============================================================
// Prompt Suite generator (Batch: Prompt Suite feature)
//
// Generates a set of monitoring "prompt suites" for a brand —
// grouped by search intent (recommend / compare / define / tutorial /
// alternative) — phrased for how a user would ask an AI answer engine
// (ChatGPT / Perplexity / Gemini AI Mode) about the brand's space.
//
// Generation-only: no DB writes. The caller/UI lets the user review
// and one-click add any prompt as a tracked prompt via POST /api/prompts.
//
// HONESTY: these are suggestions seeded from real brand info. We never
// pretend they are authoritative; the user reviews them before adding.
// ============================================================

import { mapStarterGroupToIntent, type IntentKey } from "./intent";

export type PromptSuiteIntent =
  | "recommend"
  | "compare"
  | "define"
  | "tutorial"
  | "alternative";

export type PromptSuite = {
  intent: PromptSuiteIntent;
  // Canonical funnel-stage intent (see src/lib/intent.ts) — surfaced to the
  // caller so one-click "add as tracked prompt" can tag it.
  canonicalIntent: IntentKey;
  prompts: string[];
};

export type PromptSuiteResult = {
  suites: PromptSuite[];
  notes: string[];
};

type RawSuite = {
  intent: string;
  prompts: unknown;
};

type RawResponse = {
  suites: unknown;
};

const VALID_INTENTS: PromptSuiteIntent[] = [
  "recommend",
  "compare",
  "define",
  "tutorial",
  "alternative",
];

/**
 * Generate a prompt suite for a brand.
 *
 * Degrades gracefully: if OPENAI_API_KEY is missing, returns empty suites
 * plus a note — it does NOT throw.
 */
export async function generatePromptSuite(params: {
  brandName: string;
  industry: string | null;
  existingPrompts: string[];
}): Promise<PromptSuiteResult> {
  const { brandName, industry, existingPrompts } = params;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      suites: [],
      notes: ["OPENAI_API_KEY not set — add a key to generate a prompt suite."],
    };
  }

  const existingList =
    existingPrompts.length > 0
      ? `\nAvoid duplicating these prompts the user already tracks:\n${existingPrompts
          .map((p) => `- ${p}`)
          .join("\n")}`
      : "";

  const systemPrompt = `You are an AI Search / Answer Engine Optimization (AEO) strategist helping a brand discover which natural-language questions to monitor across AI answer engines (ChatGPT, Perplexity, Gemini AI Mode).

The brand is "${brandName}"${industry ? ` in the ${industry} industry` : ""}.

Generate monitoring prompts grouped by search INTENT. Each intent gets roughly 3 natural-language prompts phrased exactly how a real user would ASK an AI answer engine about this brand's space (recommendations, comparisons, definitions, tutorials, alternatives). Prompts should be specific, realistic, and varied.${existingList}

Return ONLY valid JSON in this exact shape:
{
  "suites": [
    { "intent": "recommend",  "prompts": ["...", "...", "..."] },
    { "intent": "compare",    "prompts": ["...", "...", "..."] },
    { "intent": "define",     "prompts": ["...", "...", "..."] },
    { "intent": "tutorial",   "prompts": ["...", "...", "..."] },
    { "intent": "alternative","prompts": ["...", "...", "..."] }
  ]
}

Use exactly these five intent values: "recommend", "compare", "define", "tutorial", "alternative". Do not add other intents.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      return {
        suites: [],
        notes: [`OpenAI request failed (${res.status}). Try again later.`],
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as RawResponse;

    const rawSuites = Array.isArray(parsed?.suites) ? parsed.suites : [];
    const suites: PromptSuite[] = rawSuites
      .map((s): PromptSuite | null => {
        if (!s || typeof s !== "object") return null;
        const raw = s as RawSuite;
        const intent = VALID_INTENTS.includes(raw.intent as PromptSuiteIntent)
          ? (raw.intent as PromptSuiteIntent)
          : null;
        if (!intent) return null;
        const prompts = Array.isArray(raw.prompts)
          ? raw.prompts.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
          : [];
        if (prompts.length === 0) return null;
        return { intent, canonicalIntent: mapStarterGroupToIntent(intent), prompts };
      })
      .filter((s): s is PromptSuite => s !== null);

    return { suites, notes: [] };
  } catch {
    return {
      suites: [],
      notes: ["Could not parse the generated prompt suite. Try again later."],
    };
  }
}
