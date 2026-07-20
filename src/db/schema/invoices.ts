// Invoices — one row per successful/failed billing event.
// The pre-existing `payments` table captures one-shot Razorpay orders;
// `invoices` is the durable canonical record across both providers and
// includes subscription cycles + one-shot upgrades.

import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull(),
    subscriptionId: uuid("subscription_id"),

    provider: text("provider", { enum: ["razorpay", "stripe"] }).notNull(),
    providerInvoiceId: text("provider_invoice_id"),

    // Money in the smallest currency unit (paise for INR, cents for USD).
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),

    status: text("status", {
      enum: ["pending", "paid", "failed", "refunded", "void"],
    })
      .notNull()
      .default("pending"),

    description: text("description"),

    // Provider's full payload — useful for support + tax audits.
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => ({
    orgCreatedIdx: index("invoices_org_created_idx").on(t.orgId, t.createdAt.desc()),
    subscriptionIdx: index("invoices_subscription_idx").on(t.subscriptionId),
    providerLookupIdx: index("invoices_provider_lookup_idx").on(t.provider, t.providerInvoiceId),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
