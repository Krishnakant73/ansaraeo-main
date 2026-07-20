// Audit Logs — org-scoped record of security- and billing-relevant events.
// Written by services that touch permissions, credentials, or money.
//
// NOT for product analytics (PostHog/Mixpanel handle that). For:
//   - Role / permission changes
//   - API key creation + revocation
//   - Integration credential set / rotate / delete
//   - Plan changes + downgrades
//   - Manual credit adjustments
//   - Failed auth attempts hitting sensitive routes

import { pgTable, uuid, text, timestamp, jsonb, index, inet } from "drizzle-orm/pg-core";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id"),
    actorUserId: uuid("actor_user_id"),

    // e.g., "member.role.changed", "integration.credentials.rotated",
    // "billing.plan.upgraded". Namespaced by domain.
    action: text("action").notNull(),

    // The resource affected. Free-form so new actions don't need migrations.
    targetType: text("target_type"),
    targetId: uuid("target_id"),

    // Before/after payload. Redact secrets at the write site — the audit
    // log MUST NOT contain plaintext credentials or PII beyond what the
    // action inherently needs to reference.
    payload: jsonb("payload"),

    // Request context for security review.
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgCreatedIdx: index("audit_logs_org_created_idx").on(t.orgId, t.createdAt.desc()),
    actionCreatedIdx: index("audit_logs_action_created_idx").on(t.action, t.createdAt.desc()),
    actorIdx: index("audit_logs_actor_idx").on(t.actorUserId),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
