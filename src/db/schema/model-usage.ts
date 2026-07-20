// Model Usage — every LLM call the ModelRouter dispatches, with tokens + cost.
// This is the canonical record for the CostTracker / TokenTracker (Module 8).
//
// One row per LLM call — grouped later by (org, model, capability, day) for
// dashboards. Not for realtime billing decisions (use the credits ledger for
// that); this is analytics + cost attribution.

import { pgTable, uuid, text, integer, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const modelUsage = pgTable(
  "model_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id"),

    // Capability requested (e.g., "REPORT") — see ModelCapability in config/models.ts.
    capability: text("capability").notNull(),

    // Actual model routed to — captures router decisions + fallbacks.
    model: text("model").notNull(),
    provider: text("provider").notNull().default("openrouter"),

    // Prompt hash — same value across identical prompt+model pairs so the
    // cache hit rate can be computed by counting duplicates over a window.
    promptHash: text("prompt_hash"),

    // Tokens as reported by the provider. Costs in USD micro-dollars
    // (integer avoids float drift; 1_000_000 = $1). Router computes cost
    // from the (model, tokens_in, tokens_out) triple at dispatch time.
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costMicroUsd: integer("cost_micro_usd").notNull().default(0),

    latencyMs: integer("latency_ms").notNull(),
    cached: text("cached", { enum: ["yes", "no"] }).notNull().default("no"),

    // Which service called the router (audit trail).
    caller: text("caller"),

    // Full response metadata (finish_reason, safety flags, etc.).
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgCreatedIdx: index("model_usage_org_created_idx").on(t.orgId, t.createdAt.desc()),
    modelCreatedIdx: index("model_usage_model_created_idx").on(t.model, t.createdAt.desc()),
    promptHashIdx: index("model_usage_prompt_hash_idx").on(t.promptHash),
  }),
);

// Storing cost as int micro-dollars avoids float drift over aggregation.
// 1 USD = 1_000_000 micro-USD. Convert with `microUsd / 1_000_000` for display.
export const MICRO_USD_PER_USD = 1_000_000;

export type ModelUsage = typeof modelUsage.$inferSelect;
export type NewModelUsage = typeof modelUsage.$inferInsert;

// Small typed helper used by the CostTracker (Module 8).
export function microUsdToUsd(micro: number): number {
  return Number((micro / MICRO_USD_PER_USD).toFixed(6));
}
