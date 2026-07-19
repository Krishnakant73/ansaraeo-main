// ============================================================
// data-readiness/requirements.ts — Central, configurable registry
// of every module's readiness thresholds.
//
// PROGRESSIVE ACTIVATION IS DATA-DRIVEN HERE: to make a new analytics
// module inherit the Data Readiness Engine, add ONE entry to
// READINESS_CONFIG below. Nothing else in the platform needs to change —
// getReadiness() + <DataReadinessCard /> pick it up automatically.
//
// All thresholds are deliberately configurable constants so ops can tune
// activation without code changes. They encode the honesty gates the
// platform already enforces elsewhere (e.g. benchmark k-anonymity needs
// >=5 distinct brands; forecasts need >=6 months of history).
// ============================================================

import type {
  ModuleReadinessConfig,
  ReadinessModuleKey,
} from "./types";

// ---------- global tuning constants (configurable) ----------
export const READINESS_TUNING = {
  /** discovery_edges count at which graph density saturates to 1. */
  TARGET_EDGES: 2000,
  /** distinct platform brands at which ecosystem coverage / benchmark
   *  confidence saturates to 1. */
  TARGET_BRANDS: 50,
  /** confidence value at/below which we label a signal "Low". */
  LOW_CONFIDENCE: 40,
  /** confidence value at/below which we label a signal "Medium". */
  MEDIUM_CONFIDENCE: 75,
} as const;

export const READINESS_CONFIG: Record<ReadinessModuleKey, ModuleReadinessConfig> = {
  // ---------- Mission Control (main dashboard) ----------
  "mission-control": {
    key: "mission-control",
    title: "Mission Control",
    description: "Your brand's live AI-search command center.",
    cohort: "brand",
    observationTarget: 2000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "observations", label: "AI scans completed", metric: "observations", target: 50 },
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 3 },
      { id: "engines", label: "AI engines covered", metric: "engines", target: 2 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 7, unit: "days" },
    ],
  },

  // ---------- Brand Workspace ----------
  "brand-workspace": {
    key: "brand-workspace",
    title: "Brand Workspace",
    description: "Unified view of a single brand's AI presence.",
    cohort: "brand",
    observationTarget: 1500,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "observations", label: "AI scans completed", metric: "observations", target: 30 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 14, unit: "days" },
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 3 },
    ],
  },

  // ---------- Prompt Workspace ----------
  "prompt-workspace": {
    key: "prompt-workspace",
    title: "Prompt Workspace",
    description: "Per-prompt mention and citation tracking.",
    cohort: "brand",
    observationTarget: 1500,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 5 },
      { id: "observations", label: "AI scans completed", metric: "observations", target: 30 },
    ],
  },

  // ---------- Competitor Workspace ----------
  "competitor-workspace": {
    key: "competitor-workspace",
    title: "Competitor Workspace",
    description: "Share-of-voice vs tracked competitors.",
    cohort: "brand",
    observationTarget: 2000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "observations", label: "AI scans completed", metric: "observations", target: 50 },
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 5 },
      { id: "engines", label: "AI engines covered", metric: "engines", target: 2 },
    ],
  },

  // ---------- AI Engine Workspace ----------
  "ai-engine-workspace": {
    key: "ai-engine-workspace",
    title: "AI Engine Workspace",
    description: "Per-engine coverage and consistency.",
    cohort: "brand",
    observationTarget: 1500,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "engines", label: "AI engines covered", metric: "engines", target: 2 },
      { id: "observations", label: "AI scans completed", metric: "observations", target: 30 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 7, unit: "days" },
    ],
  },

  // ---------- Benchmark Center (platform-wide, k-anon gated) ----------
  benchmark: {
    key: "benchmark",
    title: "Industry Benchmarks",
    description: "Anonymous, cross-brand industry benchmarks.",
    cohort: "platform",
    observationTarget: 10_000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "daysCollected", label: "Days of history collected", metric: "daysCollected", target: 30, unit: "days" },
      { id: "observations", label: "Observations collected", metric: "observations", target: 1000 },
      { id: "brands", label: "Brands in dataset", metric: "brands", target: 5 },
      { id: "prompts", label: "Prompts tracked", metric: "prompts", target: 20 },
    ],
  },

  // ---------- History Engine ----------
  history: {
    key: "history",
    title: "History Engine",
    description: "Immutable record of every AI-engine recommendation.",
    cohort: "brand",
    observationTarget: 1000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "observations", label: "AI scans completed", metric: "observations", target: 20 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 14, unit: "days" },
    ],
  },

  // ---------- Trend Engine ----------
  trend: {
    key: "trend",
    title: "Trend Engine",
    description: "Month-over-month movement of your AI visibility.",
    cohort: "brand",
    observationTarget: 1000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "trendLength", label: "Months of history", metric: "trendLength", target: 3, unit: "months" },
      { id: "observations", label: "AI scans completed", metric: "observations", target: 20 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 30, unit: "days" },
    ],
  },

  // ---------- Forecast Engine (needs >=6 months: mirrors MIN_HISTORY) ----------
  forecast: {
    key: "forecast",
    title: "Forecast Engine",
    description: "Forward projection of your AI visibility metrics.",
    cohort: "brand",
    observationTarget: 1000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "trendLength", label: "Months of history", metric: "trendLength", target: 6, unit: "months" },
      { id: "observations", label: "AI scans completed", metric: "observations", target: 30 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 60, unit: "days" },
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 3 },
    ],
  },

  // ---------- Citation Graph (platform-wide knowledge graph) ----------
  "citation-graph": {
    key: "citation-graph",
    title: "Citation Graph",
    description: "The AI discovery knowledge graph of brands, sources and topics.",
    cohort: "platform",
    observationTarget: 8000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "edges", label: "Graph edges discovered", metric: "edges", target: 200 },
      { id: "observations", label: "Observations collected", metric: "observations", target: 500 },
      { id: "brands", label: "Brands in dataset", metric: "brands", target: 5 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 30, unit: "days" },
    ],
  },

  // ---------- AI Rankings (k-anon gated, needs a real cohort) ----------
  "ai-rankings": {
    key: "ai-rankings",
    title: "AI Rankings",
    description: "Anonymous, public AI brand rankings.",
    cohort: "platform",
    observationTarget: 10_000,
    highConfidenceThreshold: 88,
    requirements: [
      { id: "brands", label: "Brands in dataset", metric: "brands", target: 10 },
      { id: "benchmarkConfidence", label: "Benchmark confidence", metric: "benchmarkConfidence", target: 20, unit: "%" },
      { id: "observations", label: "Observations collected", metric: "observations", target: 2000 },
    ],
  },

  // ---------- Market Share (needs measurable ecosystem coverage) ----------
  "market-share": {
    key: "market-share",
    title: "Market Share",
    description: "Anonymous recommendation/citation market share by industry.",
    cohort: "platform",
    observationTarget: 10_000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "brands", label: "Brands in dataset", metric: "brands", target: 5 },
      { id: "benchmarkConfidence", label: "Benchmark confidence", metric: "benchmarkConfidence", target: 10, unit: "%" },
      { id: "observations", label: "Observations collected", metric: "observations", target: 1000 },
    ],
  },

  // ---------- Consumer Insights ----------
  "consumer-insights": {
    key: "consumer-insights",
    title: "Consumer Insights",
    description: "What consumers actually ask and how they perceive your brand.",
    cohort: "brand",
    observationTarget: 2000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "observations", label: "AI scans completed", metric: "observations", target: 50 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 30, unit: "days" },
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 5 },
      { id: "engines", label: "AI engines covered", metric: "engines", target: 2 },
    ],
  },

  // ---------- Public Benchmark Portal (needs a robust public cohort) ----------
  "public-benchmark-portal": {
    key: "public-benchmark-portal",
    title: "Public Benchmark Portal",
    description: "Public, anonymous industry benchmark explorer.",
    cohort: "platform",
    observationTarget: 20_000,
    highConfidenceThreshold: 90,
    requirements: [
      { id: "brands", label: "Brands in dataset", metric: "brands", target: 20 },
      { id: "observations", label: "Observations collected", metric: "observations", target: 5000 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 60, unit: "days" },
      { id: "prompts", label: "Prompts tracked", metric: "prompts", target: 50 },
    ],
  },

  // ---------- Competitor Topics ----------
  "competitor-topics": {
    key: "competitor-topics",
    title: "Competitor Topics",
    description: "Topics where competitors are mentioned instead of you.",
    cohort: "brand",
    observationTarget: 2000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "observations", label: "AI scans completed", metric: "observations", target: 50 },
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 5 },
      { id: "engines", label: "AI engines covered", metric: "engines", target: 2 },
    ],
  },

  // ---------- AI Discovery Intelligence (brand command-center view) ----------
  "intelligence": {
    key: "intelligence",
    title: "AI Discovery Intelligence",
    description: "How your brand is discovered, recommended and cited across AI engines vs the benchmark.",
    cohort: "brand",
    observationTarget: 2000,
    highConfidenceThreshold: 85,
    requirements: [
      { id: "observations", label: "AI scans completed", metric: "observations", target: 50 },
      { id: "prompts", label: "Active prompts tracked", metric: "prompts", target: 3 },
      { id: "engines", label: "AI engines covered", metric: "engines", target: 2 },
      { id: "daysCollected", label: "Days of history", metric: "daysCollected", target: 7, unit: "days" },
    ],
  },
};

export function getModuleConfig(key: ReadinessModuleKey): ModuleReadinessConfig {
  const config = READINESS_CONFIG[key];
  if (!config) {
    // Defensive: a typo'd key should never crash a page; fall back to a
    // permissive single-requirement config so the feature simply activates.
    return {
      key,
      title: key,
      description: "",
      cohort: "brand",
      observationTarget: 1,
      highConfidenceThreshold: 0,
      requirements: [{ id: "observations", label: "Observations collected", metric: "observations", target: 1 }],
    };
  }
  return config;
}

export function isKnownModule(key: string): key is ReadinessModuleKey {
  return Object.prototype.hasOwnProperty.call(READINESS_CONFIG, key);
}
