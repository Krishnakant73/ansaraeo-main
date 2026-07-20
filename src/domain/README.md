# Domain layer

Pure business entities, value objects, and enums. **No I/O.** No Supabase, no HTTP, no Node APIs, no environment variables.

Everything here should be safe to instantiate in a test with no mocks.

## What lives here

- Entity types (`Brand`, `Prompt`, `VisibilityRun`, `Competitor`, `Report`, …) — plain TS types describing shape, not persistence.
- Value objects (`Score`, `Priority`, `Sentiment`, `EngineName`, …) with validation rules.
- Enums / union types shared across services.
- Pure domain functions (e.g., `computeVisibilityScore(runs) → number`) — deterministic, no side effects.

## What does NOT live here

- Supabase queries → `src/repositories/`
- LLM calls → `src/services/`
- HTTP handlers → `src/app/api/`
- React components → `src/components/`
- Prompt strings → `/prompts/*.md`

## Migration policy

Existing types scattered across `src/lib/*.ts` migrate here **incrementally** as their owning service is refactored. Do not big-bang-move; each move needs to update every import and re-run the full test suite.

Reference: [[project-constitution]]
