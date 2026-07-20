// CompetitorAnalyzer — head-to-head comparison of brand vs one competitor.
// Uses /prompts/competitor.md through ModelRouter.

import { getPromptLibrary } from "@/services/prompt-library";
import { getModelRouter } from "@/services/model-router";

export type DimensionVerdict = {
  winner: "brand" | "competitor" | "tie";
  delta: number;
  why: string;
};

export type CompetitorAnalysis = {
  winnerOverall: "brand" | "competitor" | "tie";
  byDimension: {
    shareOfVoice: DimensionVerdict;
    sentiment: DimensionVerdict;
    citationQuality: DimensionVerdict;
    contentFreshness: DimensionVerdict;
  };
  biggestGap: { dimension: string; whyItMatters: string; action: string };
  unfairAdvantages: string[];
  brandCanWinIn: string[];
  model: string;
  latencyMs: number;
  costMicroUsd: number;
};

export type CompetitorInput = {
  brand: string;
  competitor: string;
  sharedPromptsSummary: string;
  brandPagesSummary: string;
  competitorPagesSummary: string;
  orgId?: string | null;
};

export interface CompetitorAnalyzer {
  analyze(input: CompetitorInput): Promise<CompetitorAnalysis>;
}

class CompetitorAnalyzerImpl implements CompetitorAnalyzer {
  async analyze(input: CompetitorInput): Promise<CompetitorAnalysis> {
    const rendered = await getPromptLibrary().render("competitor", {
      brand: input.brand,
      competitor: input.competitor,
      shared_prompts_summary: input.sharedPromptsSummary,
      brand_pages_summary: input.brandPagesSummary,
      competitor_pages_summary: input.competitorPagesSummary,
    });
    const response = await getModelRouter().complete({
      capability: rendered.capability,
      system: rendered.system,
      prompt: rendered.user,
      json: rendered.json,
      orgId: input.orgId,
      caller: "competitor-analyzer",
      cacheTtlSeconds: 6 * 60 * 60,
    });
    const parsed = safeParse(response.content);
    return {
      winnerOverall: parsed.winner_overall ?? "tie",
      byDimension: {
        shareOfVoice: verdict(parsed.by_dimension?.share_of_voice),
        sentiment: verdict(parsed.by_dimension?.sentiment),
        citationQuality: verdict(parsed.by_dimension?.citation_quality),
        contentFreshness: verdict(parsed.by_dimension?.content_freshness),
      },
      biggestGap: {
        dimension: parsed.biggest_gap?.dimension ?? "",
        whyItMatters: parsed.biggest_gap?.why_it_matters ?? "",
        action: parsed.biggest_gap?.action ?? "",
      },
      unfairAdvantages: Array.isArray(parsed.unfair_advantages_of_competitor)
        ? parsed.unfair_advantages_of_competitor
        : [],
      brandCanWinIn: Array.isArray(parsed.brand_can_win_in) ? parsed.brand_can_win_in : [],
      model: response.model,
      latencyMs: response.latencyMs,
      costMicroUsd: response.costMicroUsd,
    };
  }
}

function verdict(raw: unknown): DimensionVerdict {
  if (!raw || typeof raw !== "object") return { winner: "tie", delta: 0, why: "" };
  const r = raw as Record<string, unknown>;
  const winner = r.winner === "brand" || r.winner === "competitor" ? r.winner : "tie";
  const delta = typeof r.delta === "number" ? r.delta : 0;
  return { winner, delta, why: String(r.why ?? "") };
}

function safeParse(text: string): {
  winner_overall?: "brand" | "competitor" | "tie";
  by_dimension?: Record<string, unknown>;
  biggest_gap?: { dimension?: string; why_it_matters?: string; action?: string };
  unfair_advantages_of_competitor?: string[];
  brand_can_win_in?: string[];
} {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

let _instance: CompetitorAnalyzer | null = null;
export function getCompetitorAnalyzer(): CompetitorAnalyzer {
  if (!_instance) _instance = new CompetitorAnalyzerImpl();
  return _instance;
}
