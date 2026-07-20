// ReportGenerator — produces the decision-grade brief from a bundle of
// analyzer + visibility outputs. Uses /prompts/report.md through the
// REPORT-capability model (Claude Sonnet by default).
//
// This is the LLM-synthesis step. Turning that JSON into HTML/PDF is done
// by the pre-existing src/lib/report-document.tsx + src/lib/reports.ts.

import { getPromptLibrary } from "@/services/prompt-library";
import { getModelRouter } from "@/services/model-router";

export type Priority = "high" | "medium" | "low";

export type Recommendation = {
  title: string;
  impact: Priority;
  effort: Priority;
  why: string;
  how: string;
};

export type GeneratedReport = {
  executiveSummary: string;
  quickWins: Recommendation[];
  highPriority: Recommendation[];
  mediumPriority: Recommendation[];
  lowPriority: Recommendation[];
  oneThingToDoThisWeek: string;
  model: string;
  latencyMs: number;
  costMicroUsd: number;
};

export type ReportInput = {
  brand: string;
  domain: string;
  period: string;
  seoScore: number;
  geoScore: number;
  aeoScore: number;
  visibilityScore: number;
  topWins: string;
  topLosses: string;
  competitorGap: string;
  orgId?: string | null;
};

export interface ReportGenerator {
  generate(input: ReportInput): Promise<GeneratedReport>;
}

class ReportGeneratorImpl implements ReportGenerator {
  async generate(input: ReportInput): Promise<GeneratedReport> {
    const rendered = await getPromptLibrary().render("report", {
      brand: input.brand,
      domain: input.domain,
      period: input.period,
      seo_score: input.seoScore,
      geo_score: input.geoScore,
      aeo_score: input.aeoScore,
      visibility_score: input.visibilityScore,
      top_wins: input.topWins,
      top_losses: input.topLosses,
      competitor_gap: input.competitorGap,
    });
    const response = await getModelRouter().complete({
      capability: rendered.capability,
      system: rendered.system,
      prompt: rendered.user,
      json: rendered.json,
      orgId: input.orgId,
      caller: "report-generator",
      // Reports are per-period + inputs vary constantly; 24h cache prevents
      // re-billing when the same brand's identical scores are re-generated.
      cacheTtlSeconds: 24 * 60 * 60,
    });
    let parsed: {
      executive_summary?: string;
      quick_wins?: Recommendation[];
      high_priority?: Recommendation[];
      medium_priority?: Recommendation[];
      low_priority?: Recommendation[];
      one_thing_to_do_this_week?: string;
    } = {};
    try {
      parsed = JSON.parse(response.content);
    } catch {
      /* leave parsed empty — caller sees a mostly-empty report + can retry */
    }
    return {
      executiveSummary: parsed.executive_summary ?? "",
      quickWins: cleanRecs(parsed.quick_wins),
      highPriority: cleanRecs(parsed.high_priority),
      mediumPriority: cleanRecs(parsed.medium_priority),
      lowPriority: cleanRecs(parsed.low_priority),
      oneThingToDoThisWeek: parsed.one_thing_to_do_this_week ?? "",
      model: response.model,
      latencyMs: response.latencyMs,
      costMicroUsd: response.costMicroUsd,
    };
  }
}

function cleanRecs(input: unknown): Recommendation[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      title: String(r.title ?? ""),
      impact: normalizePriority(r.impact),
      effort: normalizePriority(r.effort),
      why: String(r.why ?? ""),
      how: String(r.how ?? ""),
    }));
}

function normalizePriority(v: unknown): Priority {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

let _instance: ReportGenerator | null = null;
export function getReportGenerator(): ReportGenerator {
  if (!_instance) _instance = new ReportGeneratorImpl();
  return _instance;
}
