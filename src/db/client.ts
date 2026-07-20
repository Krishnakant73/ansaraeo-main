// ============================================================
// Drizzle client — postgres.js driver over Supabase Postgres.
//
// Lazy-init (Razorpay pattern): never construct at module load. `next build`
// evaluates route modules during page-data collection; a missing DATABASE_URL
// would fail the build. getDb() is called inside repositories at request
// time and returns null when unconfigured.
//
// Coexists with the pre-existing Supabase client at src/lib/supabase/server.ts.
// Use Drizzle for new tables (Module 3+); Supabase RLS client stays for
// user-facing queries against pre-existing tables until they migrate.
// ============================================================

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _client: postgres.Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getConnectionUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

export function getDb(): PostgresJsDatabase<typeof schema> | null {
  if (_db) return _db;
  const url = getConnectionUrl();
  if (!url) return null;
  _client = postgres(url, {
    // Serverless-friendly connection pool — max 1 per invocation, prepared
    // statements off (pgBouncer transaction pooler on Supabase doesn't
    // support them). Idle timeout short so functions release the socket.
    max: 1,
    prepare: false,
    idle_timeout: 20,
  });
  _db = drizzle(_client, { schema });
  return _db;
}

// Test hook.
export async function __resetDb(): Promise<void> {
  await _client?.end({ timeout: 1 });
  _client = null;
  _db = null;
}
