// UsageTracker port. Records every LLM call the ModelRouter dispatches
// so ops can attribute cost and enforce per-plan quotas.
//
// Writes to the `model_usage` table (see src/db/schema/model-usage.ts).

export type UsageRecord = {
  orgId: string | null;
  capability: string;
  model: string;
  provider: string;
  promptHash: string | null;
  tokensIn: number;
  tokensOut: number;
  costMicroUsd: number;
  latencyMs: number;
  cached: boolean;
  caller: string | null;
  metadata?: Record<string, unknown>;
};

export interface UsageTracker {
  record(entry: UsageRecord): Promise<void>;
}
