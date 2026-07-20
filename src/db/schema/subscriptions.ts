// Subscriptions — one row per org's active plan, per provider.
// The pre-existing organizations.plan column is denormalized state; this
// table is the source of truth for billing lifecycle (trial → active →
// past_due → canceled).
//
// Provider is either "razorpay" or "stripe" (Module 16).

import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),

    provider: text("provider", { enum: ["razorpay", "stripe"] }).notNull(),

    // Provider's own subscription ID. Unique per provider so we can look up
    // by webhook payload without ambiguity.
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    providerCustomerId: text("provider_customer_id"),

    plan: text("plan").notNull(), // starter, growth, agency (see PLAN_PRICING)
    status: text("status", {
      enum: ["trialing", "active", "past_due", "canceled", "unpaid"],
    })
      .notNull()
      .default("active"),

    // Cycle boundaries. Both are provider-authoritative.
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),

    // Raw provider payload for the initial subscription — useful for support
    // when a webhook diff can't be reconstructed.
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("subscriptions_org_idx").on(t.orgId),
    providerLookupIdx: uniqueIndex("subscriptions_provider_lookup_idx").on(
      t.provider,
      t.providerSubscriptionId,
    ),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
