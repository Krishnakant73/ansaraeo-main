# Adapters layer

Provider-specific implementations of external services. Each adapter fulfills a **port** (interface) defined by a service.

## What lives here

Grouped by capability:

- `crawler/` — `FirecrawlAdapter`, `Crawl4AIAdapter`, `CheerioAdapter` (Module 11)
- `llm/` — `OpenRouterAdapter` (Module 9). Also legacy `OpenAIAdapter` for the internal LLM path until fully migrated.
- `email/` — `ResendAdapter`, `ZohoAdapter` (already partial in `src/lib/email.ts`)
- `payments/` — `RazorpayAdapter`, `StripeAdapter` (Module 16)
- `search/` — `TavilyAdapter`, `DataForSEOAdapter`
- `queue/` — `PostgresQueueAdapter` (existing), `InngestAdapter` (existing)
- `cache/` — `RedisAdapter` (Module 8), in-memory dev fallback
- `analytics/` — `PostHogAdapter`, `MixpanelAdapter`
- `observability/` — `SentryAdapter`, `OtelAdapter`
- `feature-flags/` — `GrowthBookAdapter`

## Rules

- Adapters implement a **port** — an interface owned by the service that uses them.
- Adapters know about the third-party library (Firecrawl SDK, Stripe SDK, etc.). No other code should import provider SDKs directly.
- Adapters are the ONLY place `process.env.X` is read for third-party credentials — via `getXConfig()` in `src/lib/env.ts`.
- Every adapter is replaceable — swap the wiring in `src/config/` or a service constructor, no other code touches.

## Migration policy

Existing thin wrappers in `src/lib/{email,tavily,crawl,mixpanel,posthog-server,razorpay,whatsapp}.ts` are proto-adapters. They'll move here (with interfaces extracted to their owning service) as each module is refactored.

Reference: [[project-constitution]]
