// CostMonitor — aggregates model_usage rows into a per-org spend snapshot.
// Consumed by the /dashboard/settings/billing surface and by ops alerts
// when an org crosses their monthly cap.
//
// Constitution: `Cost monitoring.` under Observability.

import { getDb } from "@/db/client";
import { modelUsage, microUsdToUsd } from "@/db/schema/model-usage";
import { and, eq, gte, sql } from "drizzle-orm";

export type CostSnapshot = {
  orgId: string;
  windowStart: Date;
  totalMicroUsd: number;
  totalUsd: number;
  totalTokens: number;
  callCount: number;
  cachedCallCount: number;
  byModel: Array<{ model: string; costMicroUsd: number; calls: number }>;
};

export interface CostMonitor {
  snapshot(orgId: string, windowStart: Date): Promise<CostSnapshot>;
}

class DrizzleCostMonitor implements CostMonitor {
  async snapshot(orgId: string, windowStart: Date): Promise<CostSnapshot> {
    const db = getDb();
    const empty: CostSnapshot = {
      orgId,
      windowStart,
      totalMicroUsd: 0,
      totalUsd: 0,
      totalTokens: 0,
      callCount: 0,
      cachedCallCount: 0,
      byModel: [],
    };
    if (!db) return empty;

    const rows = await db
      .select({
        model: modelUsage.model,
        costMicroUsd: sql<number>`coalesce(sum(${modelUsage.costMicroUsd}), 0)::int`,
        tokens: sql<number>`coalesce(sum(${modelUsage.tokensIn} + ${modelUsage.tokensOut}), 0)::int`,
        calls: sql<number>`count(*)::int`,
        cachedCalls: sql<number>`count(*) filter (where ${modelUsage.cached} = 'yes')::int`,
      })
      .from(modelUsage)
      .where(and(eq(modelUsage.orgId, orgId), gte(modelUsage.createdAt, windowStart)))
      .groupBy(modelUsage.model);

    const totals = rows.reduce(
      (acc, r) => ({
        totalMicroUsd: acc.totalMicroUsd + r.costMicroUsd,
        totalTokens: acc.totalTokens + r.tokens,
        callCount: acc.callCount + r.calls,
        cachedCallCount: acc.cachedCallCount + r.cachedCalls,
      }),
      { totalMicroUsd: 0, totalTokens: 0, callCount: 0, cachedCallCount: 0 },
    );

    return {
      orgId,
      windowStart,
      ...totals,
      totalUsd: microUsdToUsd(totals.totalMicroUsd),
      byModel: rows.map((r) => ({ model: r.model, costMicroUsd: r.costMicroUsd, calls: r.calls })),
    };
  }
}

let _instance: DrizzleCostMonitor | null = null;
export function getCostMonitor(): CostMonitor {
  if (!_instance) _instance = new DrizzleCostMonitor();
  return _instance;
}
