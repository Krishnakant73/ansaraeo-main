// ============================================================
// Shared classifier used by both:
//   1. runVisibilityCheck() (authenticated, persistent — src/lib/visibility-engine.ts)
//   2. The public pre-signup scan (src/app/api/analyze/[scanId]/stream/route.ts)
//
// The two callers share the exact same honesty rules:
//   - Deterministic mention check wins for literal name presence.
//   - LLM stays authoritative for sentiment / position / alignment.
//   - Disagreement is logged in `mention_verification`, never silently
//     resolved.
//
// This module has NO Supabase dependency: it takes a response string
// and returns a fully-classified object. That keeps the public scan
// path free of DB writes (the SSE route persists the aggregate JSON to
// `public_scans` in one shot at the end).
// ============================================================

import { getInternalLLM } from "@/lib/llm";
import { reconcileMentionSignal } from "@/lib/mention-matcher";

export type CompetitorMention = { name: string; mentioned: boolean; position: number | null };

export type ClassifiedAnswer = {
  brand_mentioned: boolean;
  brand_position: number | null;
  sentiment: "positive" | "neutral" | "negative";
  cited_urls: string[];
  competitor_mentions: CompetitorMention[];
  recommendation_alignment: "aligned" | "misaligned" | "neutral";
  mention_verification: {
    brand: { agreed: boolean; llmSaid: boolean; textMatchSaid: boolean };
    competitors: { name: string; agreed: boolean }[];
    recommendation_alignment: "aligned" | "misaligned" | "neutral";
  };
};

type RawLLMResult = {
  brand_mentioned?: boolean;
  brand_position?: number | null;
  sentiment?: "positive" | "neutral" | "negative";
  cited_urls?: string[];
  competitor_mentions?: CompetitorMention[];
  recommendation_alignment?: "aligned" | "misaligned" | "neutral";
};

// LLM-classify a raw answer, then reconcile the mention booleans against
// a deterministic text match. Identical prompt to visibility-engine.ts's
// classifyResponse so the two callers produce comparable output.
export async function classifyAnswer(params: {
  responseText: string;
  brandName: string;
  competitorNames: string[];
  promptText: string;
}): Promise<ClassifiedAnswer> {
  const { responseText, brandName, competitorNames, promptText } = params;

  const raw = await getInternalLLM().generate({
    system: `You extract structured facts from an AI answer, checking for one main brand AND a list of named competitors. Respond ONLY with JSON: {"brand_mentioned": boolean, "brand_position": number|null, "sentiment": "positive"|"neutral"|"negative", "cited_urls": string[], "competitor_mentions": [{"name": string, "mentioned": boolean, "position": number|null}], "recommendation_alignment": "aligned"|"misaligned"|"neutral"}. Include EVERY competitor from the provided list in competitor_mentions, even if mentioned=false. recommendation_alignment: "aligned" if the brand is described correctly and recommended for the use case implied by the prompt, "misaligned" if described incorrectly or for the wrong use case, "neutral" if not applicable (brand not mentioned).`,
    prompt: `Main brand to check for: "${brandName}"\nCompetitors to also check for: ${
      competitorNames.length > 0 ? competitorNames.join(", ") : "(none provided)"
    }\n\nOriginal prompt / question:\n${promptText}\n\nAI answer text:\n${responseText}`,
    json: true,
  });

  let parsed: RawLLMResult = {};
  try {
    parsed = JSON.parse(raw ?? "{}") as RawLLMResult;
  } catch {
    parsed = {};
  }

  const alignment = parsed.recommendation_alignment;
  const safeAlignment: ClassifiedAnswer["recommendation_alignment"] =
    alignment === "aligned" || alignment === "misaligned" ? alignment : "neutral";

  const brandReconciliation = reconcileMentionSignal(
    parsed.brand_mentioned ?? false,
    responseText,
    brandName,
  );

  const rawCompetitors = Array.isArray(parsed.competitor_mentions) ? parsed.competitor_mentions : [];
  // Ensure every competitor from input is represented, even if the LLM
  // omitted it — otherwise brand-vs-competitor comparisons would be
  // silently incomplete.
  const byName = new Map(rawCompetitors.map((c) => [c.name, c]));
  const filledCompetitors = competitorNames.map<CompetitorMention>((name) => {
    const c = byName.get(name);
    return {
      name,
      mentioned: c?.mentioned ?? false,
      position: c?.position ?? null,
    };
  });

  const competitorReconciliations = filledCompetitors.map((cm) => ({
    name: cm.name,
    ...reconcileMentionSignal(cm.mentioned, responseText, cm.name),
  }));

  const finalCompetitorMentions: CompetitorMention[] = filledCompetitors.map((cm, i) => ({
    ...cm,
    mentioned: competitorReconciliations[i].finalVerdict,
  }));

  return {
    brand_mentioned: brandReconciliation.finalVerdict,
    brand_position: parsed.brand_position ?? null,
    sentiment: parsed.sentiment ?? "neutral",
    cited_urls: Array.isArray(parsed.cited_urls) ? parsed.cited_urls : [],
    competitor_mentions: finalCompetitorMentions,
    recommendation_alignment: safeAlignment,
    mention_verification: {
      brand: {
        agreed: brandReconciliation.agreed,
        llmSaid: parsed.brand_mentioned ?? false,
        textMatchSaid: brandReconciliation.deterministicResult,
      },
      competitors: competitorReconciliations.map((r) => ({ name: r.name, agreed: r.agreed })),
      recommendation_alignment: safeAlignment,
    },
  };
}

// ============================================================
// Sanitize a user-typed domain string. Rejects IPs, localhost, and
// obviously-invalid input. Returns the canonical "example.com" form.
// ============================================================
export function canonicalizeDomain(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  if (!d) return null;
  if (d === "localhost" || d.startsWith("localhost:")) return null;
  // Strip trailing port BEFORE the TLD regex — otherwise a valid host
  // like example.com:8080 fails the "ends with .tld" check.
  d = d.split(":")[0];
  // IP literals: reject to avoid scanning internal networks by mistake.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) return null;
  if (/^\[?[0-9a-f:]+\]?$/.test(d)) return null;
  // Must have at least one dot and a plausible TLD (2+ letters).
  if (!/\.[a-z]{2,}$/i.test(d)) return null;
  return d;
}

// ============================================================
// Build the report_json shape stored in public_scans. Pure — no I/O.
// Consumers: the report SSR page, the hydration step, and the welcome
// screen's goal-picker preselection.
// ============================================================
export type ScanEngineResult = {
  engine: string;
  prompt: string;
  content: string; // raw answer text
  cited_urls: string[];
  classified: ClassifiedAnswer | null; // null = engine skipped/errored
  error?: string;
  skipped?: boolean;
  skip_reason?: string;
};

export type ScanReport = {
  brandName: string;
  domain: string;
  visibilityScore: number; // 0–100, mention rate across non-skipped answers
  totalAnswers: number;
  brandMentionedAnswers: number;
  perEngine: { engine: string; mentioned: number; total: number; rate: number }[];
  competitorScores: { name: string; mentioned: number; total: number; rate: number }[];
  opportunities: {
    prompt: string;
    engine: string;
    competitors_present: string[];
    snippet: string;
  }[];
  sentiment: { positive: number; neutral: number; negative: number };
};

export function buildScanReport(params: {
  brandName: string;
  domain: string;
  competitorNames: string[];
  results: ScanEngineResult[];
}): ScanReport {
  const nonSkipped = params.results.filter((r) => r.classified && !r.skipped);
  const brandMentionedAnswers = nonSkipped.filter((r) => r.classified?.brand_mentioned).length;
  const totalAnswers = nonSkipped.length;
  const visibilityScore = totalAnswers ? Math.round((brandMentionedAnswers / totalAnswers) * 100) : 0;

  // Per-engine
  const engineNames = Array.from(new Set(params.results.map((r) => r.engine)));
  const perEngine = engineNames.map((engine) => {
    const rows = params.results.filter((r) => r.engine === engine && r.classified && !r.skipped);
    const mentioned = rows.filter((r) => r.classified?.brand_mentioned).length;
    const total = rows.length;
    return { engine, mentioned, total, rate: total ? Math.round((mentioned / total) * 100) : 0 };
  });

  // Competitor ranking
  const competitorScores = params.competitorNames.map((name) => {
    let mentioned = 0;
    let total = 0;
    for (const r of nonSkipped) {
      total += 1;
      const hit = r.classified?.competitor_mentions.find((c) => c.name === name);
      if (hit?.mentioned) mentioned += 1;
    }
    return { name, mentioned, total, rate: total ? Math.round((mentioned / total) * 100) : 0 };
  });

  // Opportunities: prompts where the brand is absent but ≥1 competitor is
  // present — the highest-value places to publish first.
  const opportunities = nonSkipped
    .filter((r) => r.classified && !r.classified.brand_mentioned)
    .map((r) => {
      const competitors = r.classified!.competitor_mentions.filter((c) => c.mentioned).map((c) => c.name);
      return {
        prompt: r.prompt,
        engine: r.engine,
        competitors_present: competitors,
        snippet: (r.content ?? "").slice(0, 220),
      };
    })
    .filter((o) => o.competitors_present.length > 0)
    .sort((a, b) => b.competitors_present.length - a.competitors_present.length)
    .slice(0, 3);

  // Sentiment mix
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const r of nonSkipped) {
    const s = r.classified?.sentiment ?? "neutral";
    sentiment[s] += 1;
  }

  return {
    brandName: params.brandName,
    domain: params.domain,
    visibilityScore,
    totalAnswers,
    brandMentionedAnswers,
    perEngine: perEngine.sort((a, b) => b.rate - a.rate),
    competitorScores: competitorScores.sort((a, b) => b.rate - a.rate),
    opportunities,
    sentiment,
  };
}
