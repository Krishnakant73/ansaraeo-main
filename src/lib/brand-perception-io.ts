// IO layer for Brand Positioning / AI Perception.
// Imports the Supabase service client + the pure logic from brand-perception.
// Kept separate so the pure functions stay unit-testable under vitest (no `@/`).
import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";
import {
  parseBrandPerception,
  aggregatePerceptions,
  type AggregatePerception,
  type BrandPerception,
  type Tone,
} from "@/lib/brand-perception";

export type { BrandPerception, Tone, AggregatePerception } from "@/lib/brand-perception";
export {
  parseBrandPerception,
  aggregatePerceptions,
  judgePositioningGap,
  type IntendedPositioning,
  type PositioningGap,
} from "@/lib/brand-perception";

/**
 * LLM extraction of how a single AI answer positions the brand.
 * Degrades to an empty perception (never throws) when OPENAI_API_KEY is absent.
 * Only call this when the brand was actually mentioned in `responseText`.
 */
export async function extractBrandPerception(
  responseText: string,
  brandName: string,
): Promise<BrandPerception> {
  if (!process.env.OPENAI_API_KEY) {
    return { perceived_category: null, strengths: [], weaknesses: [], recommended_for: [], tone: "neutral" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract how an AI answer POSITIONS a specific brand. Respond ONLY with JSON: " +
              '{"perceived_category": string|null, "strengths": string[], "weaknesses": string[], ' +
              '"recommended_for": string[], "tone": "positive"|"neutral"|"negative"}. ' +
              "perceived_category = the category the answer places the brand in (e.g. 'AI search optimization tool'). " +
              "strengths/weaknesses = concrete attributes the answer attributes to the brand, in the answer's own words. " +
              "recommended_for = the use cases or audiences the answer says the brand is best for. " +
              "tone = overall sentiment toward the brand. Output the brand's ACTUAL words, do not invent.",
          },
          {
            role: "user",
            content: `Brand to analyze: "${brandName}"\n\nAI answer text:\n${responseText}`,
          },
        ],
      }),
    });
    if (!res.ok) return { perceived_category: null, strengths: [], weaknesses: [], recommended_for: [], tone: "neutral" };
    const data = await res.json();
    return parseBrandPerception(JSON.parse(data.choices[0].message.content));
  } catch {
    return { perceived_category: null, strengths: [], weaknesses: [], recommended_for: [], tone: "neutral" };
  }
}

/**
 * Store a perception row for one run. Failure-isolated: a perception failure
 * must never break the visibility run. Uses the service client (background write).
 */
export async function storePerceptionForRun(params: {
  brandId: string;
  runId: string;
  engineId: string | null;
  responseText: string;
  brandName: string;
  tone: Tone;
}): Promise<void> {
  try {
    const perception = await extractBrandPerception(params.responseText, params.brandName);
    const supabase = createServiceClient();
    await supabase.from("brand_perception").insert({
      brand_id: params.brandId,
      run_id: params.runId,
      engine_id: params.engineId,
      perceived_category: perception.perceived_category,
      strengths: perception.strengths,
      weaknesses: perception.weaknesses,
      recommended_for: perception.recommended_for,
      tone: params.tone,
    });
  } catch (err) {
    reportError(err, { module: "brand-perception", stage: "storePerceptionForRun", brandId: params.brandId });
  }
}

/** Read + aggregate recent perceptions for a brand (cookie/RLS client). */
export async function getAggregatePerception(
  supabase: { from: (t: string) => any },
  brandId: string,
  limit = 200,
): Promise<AggregatePerception> {
  const { data, error } = await supabase
    .from("brand_perception")
    .select("perceived_category, strengths, weaknesses, recommended_for, tone")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    return {
      perceived_categories: [],
      strengths: [],
      weaknesses: [],
      recommended_for: [],
      tone_mix: { positive: 0, neutral: 0, negative: 0 },
    };
  }
  return aggregatePerceptions(data as BrandPerception[]);
}
