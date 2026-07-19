// ============================================================
// data-readiness/service.ts — PURE readiness evaluation.
//
// No I/O, no @/ imports. Given a module config + observed metrics, it
// deterministically resolves the readiness state. This is the single
// source of truth for "is this feature ready?" and is exhaustively
// unit-tested (see data-readiness.test.ts).
//
// HONESTY BY CONSTRUCTION: the engine never invents insight values. It
// only ever reports how much real data exists and whether that is enough
// to safely show an insight. Features stay hidden (behind <DataReadinessCard/>)
// until thresholds are met — no fake benchmarks, ranks, or shares.
// ============================================================

import { clamp, formatNumber } from "./util";
import type {
  ModuleReadinessConfig,
  ReadinessMetrics,
  ReadinessRequirement,
  ReadinessRequirementView,
  ReadinessState,
  ReadinessStatus,
} from "./types";

const ZERO_METRICS: ReadinessMetrics = {
  daysCollected: 0,
  observations: 0,
  brands: 0,
  prompts: 0,
  engines: 0,
  trendLength: 0,
  trendStability: 0.5,
  edges: 0,
  graphDensity: 0,
  benchmarkConfidence: 0,
  ecosystemCoverage: 0,
};

export function emptyMetrics(): ReadinessMetrics {
  return { ...ZERO_METRICS };
}

export function isRequirementMet(metrics: ReadinessMetrics, req: ReadinessRequirement): boolean {
  return (metrics[req.metric] ?? 0) >= req.target;
}

/**
 * Confidence in the reliability of this module's insights, 0..100.
 *
 * Blends three honest signals:
 *   - observation volume (log-scaled toward the module's target)
 *   - trend stability (1 = very stable month-over-month)
 *   - requirement completion (how many thresholds are already met)
 * A module with almost no data and a jittery trend correctly scores low.
 */
export function computeConfidence(metrics: ReadinessMetrics, config: ModuleReadinessConfig): number {
  const obsTarget = Math.max(1, config.observationTarget);
  const obsScore = clamp(
    Math.log10((metrics.observations ?? 0) + 1) / Math.log10(obsTarget + 1),
    0,
    1,
  );
  const stability = clamp(metrics.trendStability ?? 0.5, 0, 1);
  const reqs = config.requirements;
  const completion = reqs.length
    ? reqs.filter((r) => isRequirementMet(metrics, r)).length / reqs.length
    : 1;
  const conf = Math.round((0.5 * obsScore + 0.3 * stability + 0.2 * completion) * 100);
  return clamp(conf, 0, 100);
}

/** Map a 0..100 confidence value to a human label. */
export function confidenceLevel(value: number): "Low" | "Medium" | "High" {
  if (value < 40) return "Low";
  if (value < 75) return "Medium";
  return "High";
}

function buildRequirements(metrics: ReadinessMetrics, config: ModuleReadinessConfig): ReadinessRequirementView[] {
  return config.requirements.map((req) => ({
    ...req,
    current: metrics[req.metric] ?? 0,
    met: isRequirementMet(metrics, req),
  }));
}

function buildMessage(
  config: ModuleReadinessConfig,
  status: ReadinessStatus,
  metrics: ReadinessMetrics,
  views: ReadinessRequirementView[],
): string {
  const title = config.title;
  const obs = formatNumber(metrics.observations ?? 0);
  const days = formatNumber(metrics.daysCollected ?? 0);
  const unmet = views.filter((v) => !v.met).map((v) => v.label.toLowerCase());

  switch (status) {
    case "COLLECTING":
      return `We're collecting the first ${title} observations from your background AI-engine scans. Statistically reliable insights will appear automatically once enough historical data has accumulated.`;
    case "BUILDING":
      return `We're building your ${title} dataset — ${obs} observations collected over ${days} days so far. We're still gathering additional historical data before generating statistically reliable ${title}.`;
    case "PARTIAL":
      return `Your ${title} is partially ready. Most thresholds are met, but we're still collecting ${unmet.join(", ")} to reach full statistical reliability.`;
    case "READY":
      return `${title} is now available. We've collected enough historical data to generate statistically reliable insights.`;
    case "HIGH_CONFIDENCE":
      return `${title} is fully ready with high confidence. Insights are based on a statistically reliable, well-populated dataset.`;
  }
}

function buildNextStep(status: ReadinessStatus, views: ReadinessRequirementView[]): string {
  switch (status) {
    case "COLLECTING":
      return "No action is required — background scans are collecting data.";
    case "BUILDING":
      return "Keep your prompts active so background scans keep running.";
    case "PARTIAL": {
      const unmet = views.filter((v) => !v.met).map((v) => v.label.toLowerCase());
      return `Continue collecting: ${unmet.join(", ")}.`;
    }
    case "READY":
    case "HIGH_CONFIDENCE":
      return "Feature is active and updating automatically.";
  }
}

/**
 * Resolve a module's full readiness state from observed metrics.
 * Pure and deterministic — same inputs always yield the same state.
 */
export function evaluate(config: ModuleReadinessConfig, inputMetrics?: ReadinessMetrics): ReadinessState {
  const metrics = inputMetrics ?? emptyMetrics();
  const views = buildRequirements(metrics, config);
  const total = views.length;
  const metCount = views.filter((v) => v.met).length;
  const allMet = total > 0 && metCount === total;
  const completion = total ? metCount / total : 1;

  const progress = total
    ? Math.round(
        (views.reduce((sum, v) => sum + Math.min(v.current / (v.target || 1), 1), 0) / total) * 100,
      )
    : 100;

  const observations = metrics.observations ?? 0;
  const confidence = computeConfidence(metrics, config);

  let status: ReadinessStatus;
  if (observations === 0 && metCount === 0) {
    status = "COLLECTING";
  } else if (!allMet) {
    status = completion >= 0.5 ? "PARTIAL" : "BUILDING";
  } else {
    status = confidence >= config.highConfidenceThreshold ? "HIGH_CONFIDENCE" : "READY";
  }

  const message = buildMessage(config, status, metrics, views);
  const nextStep = buildNextStep(status, views);
  const estimatedCompletion = allMet
    ? "Active now — insights are available."
    : "Auto-activates when all thresholds are met. No action is required.";

  return {
    status,
    percentage: clamp(progress, 0, 100),
    confidence,
    message,
    nextStep,
    requirements: views,
    estimatedCompletion,
    justActivated: status === "READY" || status === "HIGH_CONFIDENCE",
  };
}

/** Success copy shown (e.g. as a toast) the moment a module activates. */
export function activationMessage(config: ModuleReadinessConfig): string {
  return `🎉 Your ${config.title} is now available. We've collected enough historical data to generate statistically reliable insights.`;
}
