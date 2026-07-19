import { createServiceClient } from "@/lib/supabase/server";
import { reconcileMentionSignal } from "@/lib/mention-matcher";
import { fetchGoogleAIOverview } from "@/lib/google-ai-overview";
import { computeSourceQuality, normalizeDomain } from "@/lib/citation-quality";
import { AUTHORITY_SOURCE } from "@/lib/domain-authority";
import { storePerceptionForRun } from "@/lib/brand-perception-io";
import { safeRecordRunHistory, safeRecordSkippedHistory } from "@/lib/history-engine";
import { safeMarkBenchmarkDirty } from "@/lib/benchmark-engine";
import { bucketMonth } from "@/lib/benchmark-metrics";

type EngineResult = { content: string; citedUrls: string[]; skipped?: boolean; skipReason?: string };

async function callChatGPT(promptText: string): Promise<EngineResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: promptText }] }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.choices[0].message.content as string, citedUrls: [] };
}

async function callPerplexity(promptText: string): Promise<EngineResult> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
    body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: promptText }] }),
  });
  if (!res.ok) throw new Error(`Perplexity error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.choices[0].message.content as string, citedUrls: (data.citations as string[]) ?? [] };
}

async function callGemini(promptText: string): Promise<EngineResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.candidates[0].content.parts[0].text as string, citedUrls: [] };
}

// NEW — genuinely distinct from callGemini(). See migration_009's comment
// for why conflating these two was a real mislabeling in earlier batches.
async function callGoogleAIOverview(promptText: string): Promise<EngineResult> {
  const { content, hasAIOverview } = await fetchGoogleAIOverview(promptText);
  if (!hasAIOverview) {
    // Not every search query triggers an AI Overview — this is expected,
    // honest behavior, not an error. Skip creating a misleading "0%
    // mentioned" run for a query that never had an AI Overview to check.
    return { content: "", citedUrls: [], skipped: true, skipReason: "No AI Overview shown for this query" };
  }
  return { content, citedUrls: [] };
}

// Grok (xAI) — OpenAI-compatible chat completions. With web search enabled
// the response carries a top-level `citations` array we surface as cited URLs.
async function callGrok(promptText: string): Promise<EngineResult> {
  if (!process.env.GROK_API_KEY) {
    return { content: "", citedUrls: [], skipped: true, skipReason: "GROK_API_KEY not configured" };
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROK_API_KEY}` },
    body: JSON.stringify({
      model: "grok-2-latest",
      messages: [{ role: "user", content: promptText }],
      search_parameters: { mode: "on" },
    }),
  });
  if (!res.ok) throw new Error(`Grok error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  const citedUrls: string[] = Array.isArray(data.citations)
    ? data.citations
    : Array.isArray(msg.citations)
      ? msg.citations
      : [];
  return { content: msg.content as string, citedUrls };
}

// Microsoft Copilot has NO official public chat-completions API, so we do
// not pretend to call one. If the operator has stood up an OpenAI-compatible
// proxy (e.g. an internal gateway) and pointed COPILOT_API_URL + COPILOT_API_KEY
// at it, we use it; otherwise we skip honestly rather than fabricate a result.
async function callCopilot(promptText: string): Promise<EngineResult> {
  const url = process.env.COPILOT_API_URL;
  const key = process.env.COPILOT_API_KEY;
  if (!url || !key) {
    return {
      content: "",
      citedUrls: [],
      skipped: true,
      skipReason: "Copilot has no public API; set COPILOT_API_URL + COPILOT_API_KEY to enable a proxy",
    };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.COPILOT_MODEL ?? "gpt-4o-mini", messages: [{ role: "user", content: promptText }] }),
  });
  if (!res.ok) throw new Error(`Copilot proxy error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content as string, citedUrls: [] };
}

const ENGINE_CALLERS: Record<string, (promptText: string) => Promise<EngineResult>> = {
  chatgpt: callChatGPT,
  perplexity: callPerplexity,
  gemini: callGemini,
  google_ai_overview: callGoogleAIOverview,
  grok: callGrok,
  copilot: callCopilot,
};

type CompetitorMention = { name: string; mentioned: boolean; position: number | null };

type ClassificationResult = {
  brand_mentioned: boolean;
  brand_position: number | null;
  sentiment: "positive" | "neutral" | "negative";
  cited_urls: string[];
  competitor_mentions: CompetitorMention[];
  // LLM-judged proxy: is the brand described correctly AND recommended for the
  // use case implied by the prompt? Honestly labeled as a proxy, not ground truth.
  recommendation_alignment: "aligned" | "misaligned" | "neutral";
};

async function classifyResponse(
  responseText: string,
  brandName: string,
  competitorNames: string[],
  promptText: string
): Promise<ClassificationResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured facts from an AI answer, checking for one main brand AND a list of " +
            "named competitors. Respond ONLY with JSON: " +
            '{"brand_mentioned": boolean, "brand_position": number|null, "sentiment": "positive"|"neutral"|"negative", ' +
            '"cited_urls": string[], "competitor_mentions": [{"name": string, "mentioned": boolean, "position": number|null}], ' +
            '"recommendation_alignment": "aligned"|"misaligned"|"neutral"}. ' +
            "Include EVERY competitor from the provided list in competitor_mentions, even if mentioned=false. " +
            'recommendation_alignment: "aligned" if the brand is described correctly and recommended for the ' +
            'use case implied by the prompt, "misaligned" if described incorrectly or for the wrong use case, ' +
            '"neutral" if not applicable (brand not mentioned).',
        },
        {
          role: "user",
          content: `Main brand to check for: "${brandName}"\nCompetitors to also check for: ${
            competitorNames.length > 0 ? competitorNames.join(", ") : "(none provided)"
          }\n\nOriginal prompt / question:\n${promptText}\n\nAI answer text:\n${responseText}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Classification error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content) as Partial<ClassificationResult>;
  // Defensive default: if the model omits the field, treat as neutral.
  const alignment = parsed.recommendation_alignment;
  const safeAlignment: ClassificationResult["recommendation_alignment"] =
    alignment === "aligned" || alignment === "misaligned" ? alignment : "neutral";
  return { ...(parsed as ClassificationResult), recommendation_alignment: safeAlignment };
}

export type EngineOutcome =
  | { engine: string; success: true; brand_mentioned: boolean; sentiment: string; competitor_mentions: CompetitorMention[] }
  | { engine: string; success: true; skipped: true; reason: string }
  | { engine: string; success: false; error: string };

export async function runVisibilityCheck(promptId: string): Promise<EngineOutcome[]> {
  const supabase = createServiceClient();

  const { data: prompt, error: promptError } = await supabase
    .from("prompts")
    .select("id, text, brand_id, brands(name, domain)")
    .eq("id", promptId)
    .single();

  if (promptError || !prompt) throw new Error("Prompt not found");

  const brand = Array.isArray(prompt.brands) ? prompt.brands[0] : prompt.brands;
  const brandName = brand?.name ?? "";
  const brandDomain: string = brand?.domain ?? "";

  const { data: competitors } = await supabase
    .from("competitors")
    .select("name, domain")
    .eq("brand_id", prompt.brand_id)
    .eq("confirmed", true);
  const competitorNames = (competitors ?? []).map((c) => c.name);
  const competitorDomains = (competitors ?? [])
    .map((c) => c.domain)
    .filter((d): d is string => typeof d === "string" && d.length > 0);

  const { data: engines } = await supabase
    .from("engines")
    .select("id, name")
    .eq("is_active", true)
    .returns<{ id: string; name: string }[]>();

  type InnerResult =
    | { engine: string; success: true; skipped: true; reason: string }
    | { engine: string; success: true; brand_mentioned: boolean; sentiment: string; competitor_mentions: CompetitorMention[] };

  const results = await Promise.allSettled(
    (engines ?? []).map(async (engine): Promise<InnerResult> => {
      const caller = ENGINE_CALLERS[engine.name];
      if (!caller) throw new Error(`No caller implemented for engine "${engine.name}"`);

      const { content, citedUrls, skipped, skipReason } = await caller(prompt.text);

      if (skipped) {
        // Record "we checked, engine returned nothing" as immutable history
        // (excluded from mention-rate denominators). Never breaks the run.
        void safeRecordSkippedHistory({
          brandId: prompt.brand_id,
          promptId: promptId,
          engineId: engine.id,
          engineName: engine.name,
          promptText: prompt.text,
          skipReason: skipReason ?? "skipped",
        });
        return { engine: engine.name, success: true, skipped: true, reason: skipReason ?? "skipped" };
      }

      const classification = await classifyResponse(content, brandName, competitorNames, prompt.text);

      // Deterministic verification pass (NEW) — cross-check the LLM's
      // self-reported brand_mentioned against literal text matching.
      const brandReconciliation = reconcileMentionSignal(classification.brand_mentioned, content, brandName);
      const competitorReconciliations = classification.competitor_mentions.map((cm) => ({
        name: cm.name,
        ...reconcileMentionSignal(cm.mentioned, content, cm.name),
      }));

      const finalCompetitorMentions = classification.competitor_mentions.map((cm, i) => ({
        ...cm,
        mentioned: competitorReconciliations[i].finalVerdict,
      }));

      const allCitedUrls = Array.from(new Set([...citedUrls, ...classification.cited_urls]));

      const { data: run, error: runError } = await supabase
        .from("visibility_runs")
        .insert({
          prompt_id: promptId,
          engine_id: engine.id,
          raw_response: content,
          brand_mentioned: brandReconciliation.finalVerdict,
          brand_position: classification.brand_position,
          sentiment: classification.sentiment,
          competitor_mentions: finalCompetitorMentions,
          recommendation_alignment: classification.recommendation_alignment,
          mention_verification: {
            brand: { agreed: brandReconciliation.agreed, llmSaid: classification.brand_mentioned, textMatchSaid: brandReconciliation.deterministicResult },
            competitors: competitorReconciliations.map((r) => ({ name: r.name, agreed: r.agreed })),
            recommendation_alignment: classification.recommendation_alignment,
          },
        })
        .select()
        .single();

      if (runError) throw runError;

      // Track B: capture how this AI answer perceived the brand — but only when
      // the brand was deterministically mentioned (never fabricate perception
      // for an answer that didn't surface the brand). Failure-isolated so a
      // perception error can never break the visibility run.
      if (brandReconciliation.finalVerdict) {
        void storePerceptionForRun({
          brandId: prompt.brand_id,
          runId: run.id,
          engineId: engine.id,
          responseText: content,
          brandName,
          tone: (classification.sentiment as "positive" | "neutral" | "negative") ?? "neutral",
        });
      }

      if (allCitedUrls.length > 0) {
        // Carry any cached real authority (DataForSEO) onto new citations. The
        // table may not exist pre-migration; degrade to the proxy default.
        const citedDomains = Array.from(
          new Set(allCitedUrls.map((u) => normalizeDomain(u)).filter(Boolean)),
        ) as string[];
        const authorityByDomain = new Map<string, number>();
        try {
          if (citedDomains.length) {
            const { data: da } = await supabase
              .from("domain_authority")
              .select("domain, authority_score")
              .in("domain", citedDomains);
            for (const r of da ?? []) if (r.authority_score != null) authorityByDomain.set(r.domain, r.authority_score);
          }
        } catch {
          /* domain_authority not yet migrated — source_quality proxy remains */
        }

        const citeRows = allCitedUrls.map((url) => {
          const norm = normalizeDomain(url);
          const isOwnDomain = brandDomain ? url.includes(brandDomain) : false;
          const isCompetitorDomain = competitorDomains.some((d) => url.includes(d));
          const quality = computeSourceQuality(url, {
            isOwnDomain,
            isCompetitorDomain,
          });
          const authority = norm ? authorityByDomain.get(norm) ?? null : null;
          return {
            run_id: run.id,
            cited_domain: norm ?? url,
            cited_url: url,
            is_own_domain: isOwnDomain,
            is_competitor_domain: isCompetitorDomain,
            source_quality: quality.score,
            is_trusted_source: quality.is_trusted_source,
            authority_score: authority,
            authority_source: authority != null ? AUTHORITY_SOURCE : null,
          };
        });
        await supabase.from("citations").insert(citeRows);
      }

      // Record this run as immutable history + derive timeline events.
      // Failure-isolated: a history error must never break the visibility run.
      void safeRecordRunHistory({
        runId: run.id,
        brandId: prompt.brand_id,
        promptId: promptId,
        engineId: engine.id,
        engineName: engine.name,
        promptText: prompt.text,
        run: run,
      });

      // Contribute this run to the anonymous industry benchmark warehouse.
      // Failure-isolated (same pattern): a benchmark error must never break the
      // visibility run. Heavy aggregation happens in the daily cron; this just
      // keeps the per-brand snapshot in sync for the brand's own "Your Position".
      void safeMarkBenchmarkDirty(prompt.brand_id, bucketMonth(new Date()));

      return {
        engine: engine.name,
        success: true as const,
        brand_mentioned: brandReconciliation.finalVerdict,
        sentiment: classification.sentiment,
        competitor_mentions: finalCompetitorMentions,
      };
    })
  );

  return results.map((r, i) => {
    const engineName = engines?.[i]?.name ?? "unknown";
    if (r.status !== "fulfilled") return { engine: engineName, success: false, error: (r.reason as Error).message };
    if ("skipped" in r.value) return { engine: engineName, success: true, skipped: true, reason: r.value.reason };
    return {
      engine: engineName,
      success: true,
      brand_mentioned: r.value.brand_mentioned,
      sentiment: r.value.sentiment,
      competitor_mentions: r.value.competitor_mentions,
    };
  });
}
