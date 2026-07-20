# Repositories layer

Data access. One repository per domain aggregate. Services call repositories; repositories call the database (Supabase / Drizzle) and return domain types.

## What lives here

One folder per aggregate:

- `brand-repository.ts` — `BrandRepository` interface + `SupabaseBrandRepository` impl
- `prompt-repository.ts`
- `visibility-run-repository.ts`
- `competitor-repository.ts`
- `report-repository.ts`
- `credits-repository.ts` (Module 17)
- `subscription-repository.ts` (Module 16)
- `audit-log-repository.ts` (Module 20)
- …

## Rules

- Every repository has an **interface** in `types.ts` and a **default impl** using the current DB adapter (Supabase today, Drizzle for new tables per Module 3).
- Services depend on the **interface**, never the concrete class. Enables in-memory test doubles + future DB swaps.
- Repositories return **domain types** (from `src/domain/`), never raw DB row shapes. Map at the repo boundary.
- No business logic in repositories — only CRUD, query composition, transactions.
- RLS is respected: use `createClient()` (cookie client) for user-scoped repos; `createServiceClient()` only for trusted background repos (cron, workers).

## Migration policy

Existing Supabase queries scattered across `src/lib/*.ts` and route handlers migrate into repositories as each service is refactored. New tables (added Module 3+) start with a Drizzle-backed repository from day one.

Reference: [[project-constitution]]
