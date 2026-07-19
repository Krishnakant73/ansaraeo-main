// ============================================================
// data-readiness/index.ts — Public entry point for the Adaptive
// Data Readiness & Progressive Feature Activation engine.
//
// Server-only: this module pulls in the Supabase service client via
// metrics.ts. Use it from Server Components, Route Handlers and cron —
// never from a client component. For the client, use <DataReadinessCard />.
// ============================================================

import { getModuleConfig } from "./requirements";
import { evaluate } from "./service";
import { gatherReadinessMetrics } from "./metrics";
import type { ReadinessModuleKey, ReadinessResult } from "./types";

/**
 * Resolve a module's readiness. NEVER throws: on any failure it returns
 * `{ available: false }` so callers can safely skip the readiness card and
 * show the feature as-is (a readiness hiccup must never hide a working
 * feature or falsely claim data is insufficient).
 */
export async function getReadiness(
  module: ReadinessModuleKey,
  opts: { brandId?: string } = {},
): Promise<ReadinessResult> {
  try {
    const config = getModuleConfig(module);
    const metrics = await gatherReadinessMetrics(config.cohort === "brand" ? opts : {});
    const state = evaluate(config, metrics);
    return { available: true, state };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : "readiness unavailable" };
  }
}

export * from "./types";
export * from "./requirements";
export * from "./service";
export { gatherReadinessMetrics } from "./metrics";
