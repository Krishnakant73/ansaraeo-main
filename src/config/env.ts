// ============================================================
// getEnv — validated, typed access to process.env.
//
// Called lazily. First call validates process.env against envSchema (Zod).
// Subsequent calls return the cached bundle. In production, if required
// vars are missing at first access we log a structured warning but do NOT
// throw — the pre-existing "skip honestly, never block build" pattern still
// wins for optional integrations. A specific service that MUST have a key
// should call the schema field directly and throw its own error.
//
// Constitution: env vars are read HERE ONLY. Downstream code accesses via
// getEnv() — never process.env. Legacy getters in src/lib/env.ts still work
// and migrate opportunistically.
// ============================================================

import { envSchema, type Env } from "./env.schema";

let _cached: Env | null = null;

export function getEnv(): Env {
  if (_cached) return _cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Only fail hard on schema-level type errors (e.g., wrong ENCRYPTION_KEY
    // format). Missing-optional-keys never lands here because everything is
    // marked .optional() at schema level.
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  _cached = result.data;
  return _cached;
}

// Test hook — never call in application code.
export function __resetEnvCache(): void {
  _cached = null;
}
