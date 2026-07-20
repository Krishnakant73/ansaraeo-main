// AuditLogService — append-only record of security- and billing-relevant
// events. Writes to audit_logs (src/db/schema/audit-logs.ts).
//
// Redaction rule: NEVER include plaintext credentials in the payload.
// Callers should pass hashes / masked values.

import { getDb } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";

export type AuditEntry = {
  orgId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export interface AuditLogService {
  record(entry: AuditEntry): Promise<void>;
}

class DrizzleAuditLogService implements AuditLogService {
  async record(entry: AuditEntry): Promise<void> {
    const db = getDb();
    if (!db) return; // Same discipline as UsageTracker — never break the caller.
    try {
      await db.insert(auditLogs).values({
        orgId: entry.orgId ?? undefined,
        actorUserId: entry.actorUserId ?? undefined,
        action: entry.action,
        targetType: entry.targetType ?? undefined,
        targetId: entry.targetId ?? undefined,
        payload: entry.payload,
        ipAddress: entry.ipAddress ?? undefined,
        userAgent: entry.userAgent ?? undefined,
      });
    } catch (err) {
      console.error("[audit-log] failed to record:", err);
    }
  }
}

let _instance: DrizzleAuditLogService | null = null;
export function getAuditLogService(): AuditLogService {
  if (!_instance) _instance = new DrizzleAuditLogService();
  return _instance;
}
