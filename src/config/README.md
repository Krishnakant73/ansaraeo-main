# Config layer

Composition root and validated config.

## What lives here

- `env.schema.ts` — Zod schema for every env var (Module 2)
- `env.ts` — `getEnv()` returns the validated, typed env bundle (or throws at boot)
- `models.ts` — capability → model ID mapping (Module 9, reads env)
- `feature-flags.ts` — starter defaults for GrowthBook flags
- `wiring.ts` — dependency-injection composition: instantiates repositories + adapters and injects into services

## Rules

- Env vars are read HERE ONLY, at boot. Downstream code accesses via `getEnv()` — never `process.env` directly (except tests + `src/lib/env.ts` legacy getters which are being migrated).
- Wiring picks adapters by env — e.g., `CRAWLER_PROVIDER=firecrawl|crawl4ai|cheerio` decides which crawler adapter is bound.

## Migration policy

`src/lib/env.ts` (the pre-Module-2 typed getters) is the seed. Zod schema wraps + validates it in Module 2. Existing `process.env.X` reads in services migrate through the getter as those services are refactored.

Reference: [[project-constitution]]
