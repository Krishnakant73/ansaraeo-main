// DrizzleUsageTracker — records LLM usage into model_usage.
// Failure-isolated: usage tracking MUST NOT break the caller path (matches
// the discipline in src/lib/monitoring.ts and src/lib/mixpanel.ts).

import { getDb } from "@/db/client";
import { modelUsage } from "@/db/schema/model-usage";
import type { UsageRecord, UsageTracker } from "./types";

export class DrizzleUsageTracker implements UsageTracker {
  async record(entry: UsageRecord): Promise<void> {
    const db = getDb();
    if (!db) return; // No DB configured → no-op. Router still functions.
    try {
      await db.insert(modelUsage).values({
        orgId: entry.orgId ?? undefined,
        capability: entry.capability,
        model: entry.model,
        provider: entry.provider,
        promptHash: entry.promptHash ?? undefined,
        tokensIn: entry.tokensIn,
        tokensOut: entry.tokensOut,
        costMicroUsd: entry.costMicroUsd,
        latencyMs: entry.latencyMs,
        cached: entry.cached ? "yes" : "no",
        caller: entry.caller ?? undefined,
        metadata: entry.metadata,
      });
    } catch (err) {
      console.error("[usage] failed to record:", err);
    }
  }
}

let _instance: DrizzleUsageTracker | null = null;
export function getUsageTracker(): UsageTracker {
  if (!_instance) _instance = new DrizzleUsageTracker();
  return _instance;
}
