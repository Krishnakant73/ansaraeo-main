# Services layer

Single-responsibility business logic. **All business rules live here** — never in routes, Server Actions, or React components.

## What lives here

One folder per service, each with a `types.ts`, `service.ts`, and `service.test.ts`:

- `authentication/` — AuthenticationService
- `brand/` — BrandService
- `crawler/` — CrawlerService (calls the crawler adapter)
- `content-extraction/` — ContentExtractionService
- `seo-analyzer/` — SEOAnalyzer
- `geo-analyzer/` — GEOAnalyzer
- `aeo-analyzer/` — AEOAnalyzer
- `visibility-analyzer/` — VisibilityAnalyzer
- `competitor-analyzer/` — CompetitorAnalyzer
- `recommendation-engine/` — RecommendationEngine
- `report-generator/` — ReportGenerator
- `model-router/` — ModelRouter (Module 9)
- `prompt-library/` — PromptLibrary (Module 10)
- `billing/` — BillingService
- `notification/` — NotificationService
- `usage/` — UsageService (CostTracker/TokenTracker/UsageTracker)

## Rules

- Services depend on **domain types** and **repository interfaces**. Never on Supabase directly, never on HTTP.
- Services are called by API routes / Server Actions / Inngest functions. Never call routes from services.
- Every service exports a class or a functional module with an explicit interface. If two services need the same helper, extract to `src/domain/` (if pure) or a shared repository.
- Every LLM call goes through `ModelRouter` (Module 9). Never call OpenAI/OpenRouter directly from a service.
- Every prompt string comes from `PromptLibrary` (Module 10). Never inline a prompt.

## Migration policy

Existing modules in `src/lib/*-workspace.ts`, `src/lib/*-engine.ts`, `src/lib/visibility-engine.ts` etc. are the **current business logic layer** — they'll move here module-by-module. New features start in `src/services/` on day one.

Reference: [[project-constitution]]
