// Shared LLM dispatch for the analyzer suite. All three (SEO/GEO/AEO) render
// their prompt via PromptLibrary and go through ModelRouter — never any
// direct provider call. JSON output is validated at parse time; a malformed
// response is a caller-visible error, not a silent zero score.

import { getPromptLibrary } from "@/services/prompt-library";
import { getModelRouter } from "@/services/model-router";
import type { AnalyzerFinding, AnalyzerScore } from "./types";

type LlmScoreShape = {
  score?: unknown;
  signals?: Record<string, unknown>;
  findings?: unknown[];
};

// Coerces the JSON that came back from the LLM into our AnalyzerScore
// shape, dropping unknown fields, clamping numeric ranges. Never throws;
// returns a degraded score with a "parse_error" finding if the shape
// diverged too much.
function coerce(
  raw: LlmScoreShape,
  meta: { model: string; latencyMs: number; costMicroUsd: number },
): AnalyzerScore {
  const findings: AnalyzerFinding[] = [];
  if (Array.isArray(raw.findings)) {
    for (const f of raw.findings) {
      if (!f || typeof f !== "object") continue;
      const item = f as Record<string, unknown>;
      const sev = String(item.severity ?? "low");
      findings.push({
        signal: String(item.signal ?? ""),
        severity: sev === "high" || sev === "medium" ? sev : "low",
        evidence: String(item.evidence ?? ""),
        recommendation: String(item.recommendation ?? ""),
      });
    }
  }

  const signals: Record<string, number> = {};
  if (raw.signals && typeof raw.signals === "object") {
    for (const [k, v] of Object.entries(raw.signals)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) signals[k] = Math.max(0, Math.min(100, n));
    }
  }

  const rawScore = typeof raw.score === "number" ? raw.score : Number(raw.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : 0;

  return { score, signals, findings, ...meta };
}

export async function runAnalyzerPrompt(
  promptId: "seo" | "geo" | "aeo",
  variables: Record<string, unknown>,
  opts?: { orgId?: string | null; cacheTtlSeconds?: number },
): Promise<AnalyzerScore> {
  const rendered = await getPromptLibrary().render(promptId, variables);
  const response = await getModelRouter().complete({
    capability: rendered.capability,
    system: rendered.system,
    prompt: rendered.user,
    json: rendered.json,
    orgId: opts?.orgId,
    caller: `analyzer:${promptId}`,
    cacheTtlSeconds: opts?.cacheTtlSeconds ?? 6 * 60 * 60, // 6h default
  });
  let parsed: LlmScoreShape = {};
  try {
    parsed = JSON.parse(response.content) as LlmScoreShape;
  } catch {
    return {
      score: 0,
      signals: {},
      findings: [
        {
          signal: "parse_error",
          severity: "high",
          evidence: `Model returned non-JSON output (${response.content.length} chars). First 200: ${response.content.slice(0, 200)}`,
          recommendation: "Re-run the analyzer. If it recurs, the prompt or model needs adjustment.",
        },
      ],
      model: response.model,
      latencyMs: response.latencyMs,
      costMicroUsd: response.costMicroUsd,
    };
  }
  return coerce(parsed, {
    model: response.model,
    latencyMs: response.latencyMs,
    costMicroUsd: response.costMicroUsd,
  });
}
