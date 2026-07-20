// CreditsService — append-only ledger. Never mutate rows; every credit
// change is a new row with a signed delta. Current balance = SUM(delta).
//
// Written to the credits table via Drizzle (src/db/schema/credits.ts).

import { getDb } from "@/db/client";
import { credits } from "@/db/schema/credits";
import { eq, sql } from "drizzle-orm";

export type CreditEntry = {
  orgId: string;
  delta: number;
  kind: string;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  actorUserId?: string | null;
};

export interface CreditsService {
  balance(orgId: string): Promise<number>;
  grant(entry: Omit<CreditEntry, "delta"> & { amount: number }): Promise<void>;
  spend(entry: Omit<CreditEntry, "delta"> & { amount: number }): Promise<void>;
  refund(entry: Omit<CreditEntry, "delta"> & { amount: number }): Promise<void>;
}

class DrizzleCreditsService implements CreditsService {
  async balance(orgId: string): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${credits.delta}), 0)::int` })
      .from(credits)
      .where(eq(credits.orgId, orgId));
    return row?.total ?? 0;
  }

  async grant(entry: Omit<CreditEntry, "delta"> & { amount: number }): Promise<void> {
    if (entry.amount <= 0) throw new Error("grant amount must be positive");
    await this.insert({ ...entry, delta: entry.amount });
  }

  async spend(entry: Omit<CreditEntry, "delta"> & { amount: number }): Promise<void> {
    if (entry.amount <= 0) throw new Error("spend amount must be positive");
    await this.insert({ ...entry, delta: -entry.amount });
  }

  async refund(entry: Omit<CreditEntry, "delta"> & { amount: number }): Promise<void> {
    if (entry.amount <= 0) throw new Error("refund amount must be positive");
    await this.insert({ ...entry, delta: entry.amount });
  }

  private async insert(row: CreditEntry): Promise<void> {
    const db = getDb();
    if (!db) throw new Error("DATABASE_URL not configured — CreditsService cannot write");
    await db.insert(credits).values({
      orgId: row.orgId,
      delta: row.delta,
      kind: row.kind,
      referenceType: row.referenceType ?? undefined,
      referenceId: row.referenceId ?? undefined,
      note: row.note ?? undefined,
      actorUserId: row.actorUserId ?? undefined,
    });
  }
}

let _instance: DrizzleCreditsService | null = null;
export function getCreditsService(): CreditsService {
  if (!_instance) _instance = new DrizzleCreditsService();
  return _instance;
}
