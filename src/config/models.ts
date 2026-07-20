// ============================================================
// models — capability → model ID mapping consumed by ModelRouter (Module 9).
//
// Constitution rule: NEVER hardcode model IDs. Router selects by capability;
// mapping is env-driven so operations can flip a model per capability without
// a redeploy.
//
// Capability set is closed (typed union). Adding a new capability = update
// this file + env schema + PromptLibrary uses.
// ============================================================

import { getEnv } from "./env";

export type ModelCapability =
  | "DEFAULT"
  | "SCORING"
  | "LONG_CONTEXT"
  | "RESEARCH"
  | "REASONING"
  | "REPORT"
  | "SOCIAL"
  | "CLASSIFICATION"
  | "UTILITY"
  | "FALLBACK";

export function getModelForCapability(capability: ModelCapability): string {
  const env = getEnv();
  switch (capability) {
    case "DEFAULT":
      return env.DEFAULT_MODEL;
    case "SCORING":
      return env.SCORING_MODEL;
    case "LONG_CONTEXT":
      return env.LONG_CONTEXT_MODEL;
    case "RESEARCH":
      return env.RESEARCH_MODEL;
    case "REASONING":
      return env.REASONING_MODEL;
    case "REPORT":
      return env.REPORT_MODEL;
    case "SOCIAL":
      return env.SOCIAL_MODEL;
    case "CLASSIFICATION":
      return env.CLASSIFICATION_MODEL;
    case "UTILITY":
      return env.UTILITY_MODEL;
    case "FALLBACK":
      return env.FALLBACK_MODEL;
  }
}

// Human-readable list for admin/debug UI + logs. Ordered by expected usage.
export const MODEL_CAPABILITY_LABELS: Record<ModelCapability, string> = {
  DEFAULT: "Default (general purpose)",
  SCORING: "Scoring (SEO/GEO/AEO score generation)",
  LONG_CONTEXT: "Long context (multi-page site audits)",
  RESEARCH: "Research (fresh web search + citations)",
  REASONING: "Reasoning (multi-step planning)",
  REPORT: "Report (long-form narrative)",
  SOCIAL: "Social (short-form + real-time signal)",
  CLASSIFICATION: "Classification (structured JSON extraction)",
  UTILITY: "Utility (batch, cheap)",
  FALLBACK: "Fallback (when primary fails)",
};
