// Drizzle Kit config — migration generation + introspection.
//
// Points at the same Supabase Postgres instance as the pre-existing
// migrations (supabase/migration_*.sql). Drizzle is ADDITIVE, not
// replacement — new tables from Module 3 onward use Drizzle migrations
// generated into supabase/drizzle/. Existing raw-SQL migrations stay.
//
// Constitution rule: `Use migrations.` Drizzle migrations satisfy this
// for new tables; the pre-existing 023–030 files stay as historical
// migrations and are not regenerated.

import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? // Supabase exposes Postgres at db.<ref>.supabase.co:5432; we require
      // the explicit DATABASE_URL rather than deriving because the service
      // role connection string is what belongs here, not the anon key.
      undefined
    : undefined);

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./supabase/drizzle",
  dialect: "postgresql",
  dbCredentials: url ? { url } : { url: "postgres://placeholder@localhost/placeholder" },
  // Strict mode surfaces breaking-diff warnings before generation.
  strict: true,
  verbose: true,
});
