// API Usage — per-request accounting for the /api/v1/* surface.
// Feeds UsageService (Module 8) for per-plan rate limits + org-level analytics.

import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id"),

    // The route path (e.g., "/api/v1/competitors/[id]/dna").
    route: text("route").notNull(),
    method: text("method").notNull(),

    // Wall-clock latency for the whole handler.
    latencyMs: integer("latency_ms").notNull(),
    statusCode: integer("status_code").notNull(),

    // Bytes in/out — indicative, not exact.
    requestBytes: integer("request_bytes"),
    responseBytes: integer("response_bytes"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgCreatedIdx: index("api_usage_org_created_idx").on(t.orgId, t.createdAt.desc()),
    routeCreatedIdx: index("api_usage_route_created_idx").on(t.route, t.createdAt.desc()),
  }),
);

export type ApiUsage = typeof apiUsage.$inferSelect;
export type NewApiUsage = typeof apiUsage.$inferInsert;
