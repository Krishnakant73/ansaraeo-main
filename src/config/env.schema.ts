// ============================================================
// env.schema — Zod-validated environment schema.
//
// Per constitution Module 2: env vars are read HERE ONLY, at boot. Callers
// use getEnv() to access the validated bundle, never process.env directly.
//
// Migration reality: the pre-existing codebase has ~50 direct `process.env.X`
// reads. This schema is the seed for the migration — new code uses getEnv();
// legacy call sites migrate opportunistically as their owning module is
// refactored. src/lib/env.ts stays as a compatibility shim on top.
//
// Every field is optional at the schema level so `next build` succeeds in
// CI without live secrets. Runtime validation (that a specific service's
// keys exist) happens in the getXConfig() getters when the service is used.
// ============================================================

import { z } from "zod";

// ----------------------------------------------------------------
// Section: core (never optional in production; optional at schema
// level so CI builds without them per pre-existing pattern)
// ----------------------------------------------------------------
const coreSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase — build-safe fallbacks live in src/lib/supabase/client.ts and
  // the ci.yml workflow. Real values ship via Vercel env vars.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Cron auth (Bearer ${CRON_SECRET})
  CRON_SECRET: z.string().min(8).optional(),

  // AES-256-GCM key for integration credentials (src/lib/crypto.ts)
  // 32 bytes hex = 64 chars. Any other length is a bug — validated here.
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)")
    .optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// ----------------------------------------------------------------
// Section: answer engines (measurement targets)
// Each is optional; the callers in visibility-engine.ts skip honestly
// when their key is absent (grok/copilot pattern).
// ----------------------------------------------------------------
const answerEngineSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  GROK_API_KEY: z.string().optional(),
  COPILOT_API_URL: z.string().url().optional(),
  COPILOT_API_KEY: z.string().optional(),
  COPILOT_MODEL: z.string().default("gpt-4o-mini"),

  // OpenRouter — as answer engine AND as internal ModelRouter target
  // (Module 9). Same key, dual purpose.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),

  // DataForSEO — Google AI Overview scraping
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),
});

// ----------------------------------------------------------------
// Section: ModelRouter capabilities (Module 9)
// Every model ID is env-driven; the router selects by capability.
// Constitution rule: NEVER hardcode model IDs.
// ----------------------------------------------------------------
const modelRouterSchema = z.object({
  // Capability → model slug (any OpenRouter-supported provider/model).
  // Defaults match the constitution's DEFAULT MODEL MAPPING section.
  DEFAULT_MODEL: z.string().default("openai/gpt-4.1-mini"),
  SCORING_MODEL: z.string().default("openai/gpt-4.1-mini"),
  LONG_CONTEXT_MODEL: z.string().default("google/gemini-2.5-flash"),
  RESEARCH_MODEL: z.string().default("perplexity/sonar"),
  REASONING_MODEL: z.string().default("deepseek/deepseek-chat-v3"),
  REPORT_MODEL: z.string().default("anthropic/claude-sonnet-4"),
  SOCIAL_MODEL: z.string().default("x-ai/grok-2-latest"),
  CLASSIFICATION_MODEL: z.string().default("openai/gpt-4.1-mini"),
  UTILITY_MODEL: z.string().default("qwen/qwen-2.5-72b-instruct"),
  FALLBACK_MODEL: z.string().default("openai/gpt-4.1-mini"),
});

// ----------------------------------------------------------------
// Section: caching + jobs
// ----------------------------------------------------------------
const infraSchema = z.object({
  // Redis (Module 8) — for prompt-hash cache. Upstash-compatible URL.
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Inngest (already wired)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
});

// ----------------------------------------------------------------
// Section: crawler adapters (Module 11)
// ----------------------------------------------------------------
const crawlerSchema = z.object({
  CRAWLER_PROVIDER: z.enum(["firecrawl", "crawl4ai", "cheerio"]).default("crawl4ai"),
  FIRECRAWL_API_KEY: z.string().optional(),
  CRAWL4AI_API_URL: z.string().url().optional(),
  CRAWL4AI_API_KEY: z.string().optional(),
});

// ----------------------------------------------------------------
// Section: observability + analytics + flags
// ----------------------------------------------------------------
const observabilitySchema = z.object({
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().default("ansaraeo"),
  SENTRY_PROJECT: z.string().default("javascript-nextjs"),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),

  BETTER_STACK_UPTIME_TOKEN: z.string().optional(),
  BETTER_STACK_TELEMETRY_TOKEN: z.string().optional(),

  MONITORING_WEBHOOK_URL: z.string().url().optional(),
});

const analyticsSchema = z.object({
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  POSTHOG_PERSONAL_API_KEY: z.string().optional(),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
  // GA4 measurement ID (G-XXXX) + GTM container ID (GTM-XXXX). Public-safe;
  // scope is enforced by origin allowlisting in the GA/GTM admin console.
  NEXT_PUBLIC_GA_ID: z.string().regex(/^G-/).optional(),
  NEXT_PUBLIC_GTM_ID: z.string().regex(/^GTM-/).optional(),
});

const flagsSchema = z.object({
  GROWTHBOOK_CLIENT_KEY: z.string().optional(),
  GROWTHBOOK_API_HOST: z.string().url().default("https://cdn.growthbook.io"),
});

// ----------------------------------------------------------------
// Section: comms
// ----------------------------------------------------------------
const commsSchema = z.object({
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().email().default("noreply@ansaraeo.com"),

  ZOHO_SMTP_HOST: z.string().default("smtp.zoho.com"),
  ZOHO_SMTP_USER: z.string().optional(),
  ZOHO_SMTP_PASS: z.string().optional(),

  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  EMAIL_DRY_RUN: z.enum(["true", "false"]).optional(),
});

// ----------------------------------------------------------------
// Section: billing (Module 16)
// ----------------------------------------------------------------
const billingSchema = z.object({
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Stripe (Module 16 — additive alongside Razorpay per constitution)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

// ----------------------------------------------------------------
// Section: search + integrations
// ----------------------------------------------------------------
const searchSchema = z.object({
  TAVILY_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

// ----------------------------------------------------------------
// Composed schema
// ----------------------------------------------------------------
export const envSchema = coreSchema
  .merge(answerEngineSchema)
  .merge(modelRouterSchema)
  .merge(infraSchema)
  .merge(crawlerSchema)
  .merge(observabilitySchema)
  .merge(analyticsSchema)
  .merge(flagsSchema)
  .merge(commsSchema)
  .merge(billingSchema)
  .merge(searchSchema);

export type Env = z.infer<typeof envSchema>;
