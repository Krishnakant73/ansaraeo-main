// ============================================================
// data-readiness/types.ts — Shared types for the Adaptive Data
// Readiness & Progressive Feature Activation engine.
//
// PURE: this file has zero runtime imports (no @/ aliases) so it
// can be consumed by tests and by both server and client code
// without pulling in any database/client code.
// ============================================================

/**
 * The five readiness states a feature transitions through as data
 * accumulates in the background.
 *
 *   COLLECTING       → no observations yet; scans are warming up.
 *   BUILDING         → some observations, but most thresholds unmet.
 *   PARTIAL          → >=50% of thresholds met; insights would be unreliable.
 *   READY            → all thresholds met; confidence below high bar.
 *   HIGH_CONFIDENCE  → all thresholds met AND confidence >= module's high bar.
 */
export type ReadinessStatus =
  | "COLLECTING"
  | "BUILDING"
  | "PARTIAL"
  | "READY"
  | "HIGH_CONFIDENCE";

/** Every raw signal the metrics layer can observe. All values are numbers. */
export type ReadinessMetricKey =
  | "daysCollected"
  | "observations"
  | "brands"
  | "prompts"
  | "engines"
  | "trendLength"
  | "trendStability"
  | "edges"
  | "graphDensity"
  | "benchmarkConfidence"
  | "ecosystemCoverage";

export type ReadinessMetrics = Record<ReadinessMetricKey, number>;

/** Whether a module's data is collected per-brand or platform-wide. */
export type ReadinessCohort = "platform" | "brand";

/**
 * A single configurable threshold a module must satisfy before it can
 * produce statistically reliable insights.
 */
export type ReadinessRequirement = {
  id: string;
  label: string;
  metric: ReadinessMetricKey;
  target: number;
  /** Optional unit suffix for human display, e.g. "days", "brands". */
  unit?: string;
};

/** A requirement enriched with its current observed value + met flag (for UI). */
export type ReadinessRequirementView = ReadinessRequirement & {
  current: number;
  met: boolean;
};

/** The fully-resolved state a module is in, ready for the UI. */
export type ReadinessState = {
  status: ReadinessStatus;
  /** 0..100 — overall progress toward all thresholds. */
  percentage: number;
  /** 0..100 — how reliable the insight would be right now. */
  confidence: number;
  message: string;
  nextStep: string;
  requirements: ReadinessRequirementView[];
  estimatedCompletion: string;
  /** True when the feature is active (READY or HIGH_CONFIDENCE). */
  justActivated: boolean;
};

/**
 * Result of a readiness lookup. `available: false` means the metrics
 * could not be gathered (e.g. a transient DB error) — callers MUST treat
 * this as "show the feature anyway" so a readiness hiccup never hides a
 * working feature or falsely claims the data is insufficient.
 */
export type ReadinessResult =
  | { available: true; state: ReadinessState }
  | { available: false; reason: string };

/** A registered module that participates in progressive activation. */
export type ModuleReadinessConfig = {
  key: ReadinessModuleKey;
  title: string;
  description: string;
  cohort: ReadinessCohort;
  /** Observations at which confidence saturates to 100%. */
  observationTarget: number;
  /** Confidence >= this upgrades READY → HIGH_CONFIDENCE. */
  highConfidenceThreshold: number;
  requirements: ReadinessRequirement[];
};

/**
 * Every current and future module that should inherit progressive
 * activation. Adding a new analytics module = adding one entry here.
 */
export type ReadinessModuleKey =
  | "mission-control"
  | "brand-workspace"
  | "prompt-workspace"
  | "competitor-workspace"
  | "ai-engine-workspace"
  | "benchmark"
  | "history"
  | "trend"
  | "forecast"
  | "citation-graph"
  | "ai-rankings"
  | "market-share"
  | "consumer-insights"
  | "public-benchmark-portal"
  | "competitor-topics"
  | "intelligence";
