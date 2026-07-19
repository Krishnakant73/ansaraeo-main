# Internal LLM Provider vs Answer Engines — architecture boundary

This document exists to prevent one specific kind of confusion: **the same
model names appear in two completely separate systems.** Do not let the shared
names blur the boundary.

## Layer 1 — `src/lib/llm/*` (this directory)

AnsarAEO's **own reasoning backend**. It answers the question:

> *Which LLM does AnsarAEO use to do **its** work?*

Used for: content drafts, classification of answers, entity extraction,
summarization, mission planning, and (eventually) agent chat.

- Single entry point: `getInternalLLM()` in `index.ts`, env-selected via
  `INTERNAL_LLM_PROVIDER` (default `openai`).
- One interface: `InternalLLMProvider` in `types.ts` (`generate`, `chat`,
  `summarize`, `classify`, `extractEntities`, `planMission`).
- One error shape: `InternalLLMError` in `errors.ts` (kinds:
  `ProviderError`, `AuthenticationError`, `RateLimitError`, `TimeoutError`,
  `InvalidRequestError`, `UnknownProviderError`).
- Swapping providers is a **configuration** change only — no application code
  that calls `getInternalLLM()` changes.

The registry lists `openai` (implemented) and `claude` / `gemini` /
`grok` / `local` (placeholders). **Those names mean "which model WE call
for OUR reasoning"** — nothing more.

## Layer 2 — Answer Engines (`src/lib/visibility-engine.ts`, `src/lib/visibility-consistency.ts`)

The product **measures** these. It answers the question:

> *When a **customer** asks this engine a question, does our brand get
> mentioned?*

The engines are: **ChatGPT, Claude, Gemini, Perplexity, Google AI
Overview, Copilot, Grok**.

- Implemented as direct per-engine callers (`callChatGPT`, `callGemini`,
  `callPerplexity`, `callGrok`, `callCopilot`, `callGoogleAIOverview`,
  registered in `ENGINE_CALLERS` / `callEngine`).
- They write `visibility_runs` / compute stability scores. They are
  **measurement targets**, never used to do AnsarAEO's own reasoning.

## The rule

> An Answer Engine is **never** an `InternalLLMProvider` implementation.
> The two layers share **no code**. If you find yourself wanting to call an
> Answer Engine from `src/lib/llm/*`, or to route `getInternalLLM()`
> through `visibility-engine.ts`, stop — you have crossed the boundary.

The name collision (`claude`, `gemini`, `grok` exist in **both** layers) is
intentional naming, not shared implementation. Keep it that way.
