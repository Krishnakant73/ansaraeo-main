// Drizzle schema barrel. Every table export gets picked up by drizzle-kit
// for migration generation. Order: constitution's DB list in the same order.
//
// New tables (Module 3+) live here. Pre-existing tables (brands, prompts,
// visibility_runs, etc.) stay in supabase/migration_*.sql for now — they
// migrate to Drizzle when their owning module is refactored (see
// [[constitution-vs-current-state]]).

export * from "./credits";
export * from "./subscriptions";
export * from "./invoices";
export * from "./api-usage";
export * from "./model-usage";
export * from "./audit-logs";
