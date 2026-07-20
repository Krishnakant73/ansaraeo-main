// Credits ledger. Each row = one credit-changing event (grant, spend, refund).
// Never mutate rows — always append; current balance is a sum over the ledger.
// This lets us audit every credit transaction for a customer.
//
// Constitution Module 17 (Credits) service reads/writes here.

import { pgTable, uuid, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const credits = pgTable(
  "credits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),

    // Positive on grant / refund; negative on spend. Sum for balance.
    delta: integer("delta").notNull(),

    // What caused this change. Free-form so we can add types without a migration.
    // Examples: "signup_grant", "monthly_grant", "plan_upgrade",
    //           "spend:visibility_check", "spend:report_generation",
    //           "refund:failed_scan", "manual_adjustment".
    kind: text("kind").notNull(),

    // Optional pointer to the resource this credit change relates to.
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),

    // Free-form notes for manual adjustments / support cases.
    note: text("note"),

    // Who triggered it (null for system-issued grants).
    actorUserId: uuid("actor_user_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgCreatedIdx: index("credits_org_created_idx").on(t.orgId, t.createdAt.desc()),
    referenceIdx: index("credits_reference_idx").on(t.referenceType, t.referenceId),
  }),
);

export type Credit = typeof credits.$inferSelect;
export type NewCredit = typeof credits.$inferInsert;
