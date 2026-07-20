// VisibilityAnalyzer — synthesizes an AI Visibility brief from persisted
// visibility_runs data. Uses PromptLibrary + ModelRouter.
//
// This is the SYNTHESIS step, not the measurement step. Answer-engine
// callers (chatgpt/perplexity/gemini/…) stay in src/lib/visibility-engine.ts
// as direct-provider measurement targets — see the constitution comment at
// the top of that file.

import { getPromptLibrary } from "@/services/prompt-library";
import { getModelRouter } from "@/services/model-router";

export type VisibilitySynthesis = {
  score: number;
  signals: Record<string, number>;
  topWins: Array<{ engine: string; prompt: string; why: string }>;
  topLosses: Array<{ engine: string; prompt: string; competitor: string; why: string }>;
  recommendedAction: string;
  model: string;
  latencyMs: number;
  costMicroUsd: number;
};

export type VisibilityInput = {
  brand: string;
  domain: string;
  runsSummary: string; // Pre-flattened, per-engine summary
  competitorScores: string; // Pre-flattened competitor mention counts
  orgId?: string | null;
};

export interface VisibilityAnalyzer {
  synthesize(input: VisibilityInput): Promise<VisibilitySynthesis>;
}

class VisibilityAnalyzerImpl implements VisibilityAnalyzer {
  async synthesize(input: VisibilityInput): Promise<VisibilitySynthesis> {
    const rendered = await getPromptLibrary().render("visibility", {
      brand: input.brand,
      domain: input.domain,
      runs_summary: input.runsSummary,
      competitor_scores: input.competitorScores,
    });
    const response = await getModelRouter().complete({
      capability: rendered.capability,
      system: rendered.system,
      prompt: rendered.user,
      json: rendered.json,
      orgId: input.orgId,
      caller: "visibility-analyzer",
      cacheTtlSeconds: 60 * 60, // 1h — visibility_runs change hourly
    });
    let parsed: {
      score?: number;
      signals?: Record<string, number>;
      top_wins?: Array<{ engine: string; prompt: string; why: string }>;
      top_losses?: Array<{ engine: string; prompt: string; competitor: string; why: string }>;
      recommended_action?: string;
    } = {};
    try {
      parsed = JSON.parse(response.content);
    } catch {
      /* fall through with empty parsed */
    }
    return {
      score: clampScore(parsed.score),
      signals: parsed.signals ?? {},
      topWins: parsed.top_wins ?? [],
      topLosses: parsed.top_losses ?? [],
      recommendedAction: parsed.recommended_action ?? "",
      model: response.model,
      latencyMs: response.latencyMs,
      costMicroUsd: response.costMicroUsd,
    };
  }
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
}

let _instance: VisibilityAnalyzer | null = null;
export function getVisibilityAnalyzer(): VisibilityAnalyzer {
  if (!_instance) _instance = new VisibilityAnalyzerImpl();
  return _instance;
}
