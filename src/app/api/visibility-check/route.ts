import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/visibility-check   (v2 — multi-engine)
// Body: { promptId: string }
//
// UPGRADE from v1: this now runs the prompt against every ACTIVE row in
// the `engines` table (ChatGPT, Perplexity, Gemini by default — see
// supabase/schema.sql seed data) instead of just ChatGPT, and stores one
// visibility_runs row per engine. This is Part 3, Section 4's Phase 1
// target ("ChatGPT, Perplexity, Gemini — Must-have").
//
// If an engine's API key isn't set yet (e.g. you haven't added
// GOOGLE_AI_API_KEY), that single engine fails gracefully and the others
// still run — you get partial results instead of the whole call failing.
// ============================================================

type EngineResult = {
  content: string;
  citedUrls: string[];
};

async function callChatGPT(promptText: string): Promise<EngineResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: promptText }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.choices[0].message.content as string, citedUrls: [] };
}

async function callPerplexity(promptText: string): Promise<EngineResult> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: promptText }],
    }),
  });
  if (!res.ok) throw new Error(`Perplexity error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices[0].message.content as string,
    citedUrls: (data.citations as string[]) ?? [], // Perplexity returns real citations natively
  };
}

async function callGemini(promptText: string): Promise<EngineResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.candidates[0].content.parts[0].text as string, citedUrls: [] };
}

// Registry mapping engine name (must match the `engines.name` column in
// Supabase) to its calling function. Add DeepSeek/Claude/Grok here later
// by adding one row (Part 3, Section 4's Phase 2/3 rollout).
const ENGINE_CALLERS: Record<string, (promptText: string) => Promise<EngineResult>> = {
  chatgpt: callChatGPT,
  perplexity: callPerplexity,
  gemini: callGemini,
};

// Cheap classification pass (Part 3, Section 3A) — same small model used
// for every engine's response, since this is a simple extraction task,
// not the "real" answer generation.
async function classifyResponse(responseText: string, brandName: string) {
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
            "You extract structured facts from an AI answer. Respond ONLY with JSON: " +
            '{"brand_mentioned": boolean, "brand_position": number|null, "sentiment": "positive"|"neutral"|"negative", "cited_urls": string[]}. ' +
            "brand_position is the 1-based rank if the answer lists multiple brands/products, else null. " +
            "cited_urls is every URL/domain explicitly named in the text, else [].",
        },
        { role: "user", content: `Brand to check for: "${brandName}"\n\nAI answer text:\n${responseText}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Classification error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as {
    brand_mentioned: boolean;
    brand_position: number | null;
    sentiment: "positive" | "neutral" | "negative";
    cited_urls: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const { promptId } = await request.json();
    if (!promptId) {
      return NextResponse.json({ error: "promptId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: prompt, error: promptError } = await supabase
      .from("prompts")
      .select("id, text, brand_id, brands(name, domain)")
      .eq("id", promptId)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    const brand = Array.isArray(prompt.brands) ? prompt.brands[0] : prompt.brands;
    const brandName = brand?.name ?? "";
    const brandDomain: string = brand?.domain ?? "";

    const { data: engines } = await supabase.from("engines").select("id, name").eq("is_active", true);

    const results = await Promise.allSettled(
      (engines ?? []).map(async (engine) => {
        const caller = ENGINE_CALLERS[engine.name];
        if (!caller) throw new Error(`No caller implemented for engine "${engine.name}"`);

        const { content, citedUrls } = await caller(prompt.text);
        const classification = await classifyResponse(content, brandName);

        // Merge URLs the engine returned natively (e.g. Perplexity) with
        // URLs our classifier extracted from the text itself
        const allCitedUrls = Array.from(new Set([...citedUrls, ...classification.cited_urls]));

        const { data: run, error: runError } = await supabase
          .from("visibility_runs")
          .insert({
            prompt_id: promptId,
            engine_id: engine.id,
            raw_response: content,
            brand_mentioned: classification.brand_mentioned,
            brand_position: classification.brand_position,
            sentiment: classification.sentiment,
          })
          .select()
          .single();

        if (runError) throw runError;

        if (allCitedUrls.length > 0) {
          await supabase.from("citations").insert(
            allCitedUrls.map((url) => ({
              run_id: run.id,
              cited_domain: url,
              cited_url: url,
              is_own_domain: brandDomain ? url.includes(brandDomain) : false,
              is_competitor_domain: false,
            }))
          );
        }

        return { engine: engine.name, ...classification };
      })
    );

    // Report per-engine success/failure instead of failing the whole
    // request if e.g. only GOOGLE_AI_API_KEY is missing
    const summary = results.map((r, i) => {
      const engineName = engines?.[i]?.name ?? "unknown";
      return r.status === "fulfilled"
        ? { ...r.value, engine: engineName, success: true }
        : { engine: engineName, success: false, error: (r.reason as Error).message };
    });

    return NextResponse.json({ success: true, results: summary });
  } catch (err) {
    console.error("visibility-check error:", err);
    return NextResponse.json({ error: "Internal error running visibility check" }, { status: 500 });
  }
}
