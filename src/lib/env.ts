// ============================================================
// env — typed access to integration env vars.
//
// AnsarAEO's convention: modules read `process.env.X` directly when they
// need a single well-known key. This file exists for the new integrations
// added in the Batch A rollout, where the "skip if unset, don't throw" and
// "return a typed config bundle" patterns show up repeatedly.
//
// Two variants per service:
//   - getXConfig(): returns null when the required env vars are missing.
//     Callers that should degrade gracefully (per-engine failure isolation,
//     optional analytics) use this.
//   - requireXConfig(): throws when unset. Callers that CANNOT proceed
//     without the key (Sentry init at startup) use this.
//
// Never log the returned values. Reference them by key name in error
// messages so secrets can't accidentally hit console/logs.
// ============================================================

// ---------- OpenRouter (visibility engine) ----------
export type OpenRouterConfig = { apiKey: string; model: string };
export function getOpenRouterConfig(): OpenRouterConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini" };
}

// ---------- Sentry ----------
export type SentryConfig = { dsn: string; publicDsn: string; org?: string; project?: string; authToken?: string };
export function getSentryConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN;
  const publicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? dsn;
  if (!dsn && !publicDsn) return null;
  return {
    dsn: dsn ?? publicDsn!,
    publicDsn: publicDsn ?? dsn!,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
  };
}

// ---------- PostHog ----------
export type PostHogConfig = { token: string; host: string; personalApiKey?: string };
export function getPostHogConfig(): PostHogConfig | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return null;
  return {
    token,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
  };
}

// ---------- Mixpanel ----------
export function getMixpanelToken(): string | null {
  return process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || null;
}

// ---------- GrowthBook ----------
export type GrowthBookConfig = { clientKey: string; apiHost: string };
export function getGrowthBookConfig(): GrowthBookConfig | null {
  const clientKey = process.env.GROWTHBOOK_CLIENT_KEY;
  if (!clientKey) return null;
  return {
    clientKey,
    apiHost: process.env.GROWTHBOOK_API_HOST ?? "https://cdn.growthbook.io",
  };
}

// ---------- Better Stack ----------
export function getBetterStackUptimeToken(): string | null {
  return process.env.BETTER_STACK_UPTIME_TOKEN || null;
}
export function getBetterStackTelemetryToken(): string | null {
  return process.env.BETTER_STACK_TELEMETRY_TOKEN || null;
}

// ---------- OpenTelemetry ----------
export type OtelConfig = { endpoint: string; headers: Record<string, string> };
export function getOtelConfig(): OtelConfig | null {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return null;
  // OTEL_EXPORTER_OTLP_HEADERS is a comma-separated k=v list per OTel spec.
  const raw = process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "";
  const headers: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [k, ...rest] = pair.split("=");
    if (k && rest.length) headers[k.trim()] = rest.join("=").trim();
  }
  return { endpoint, headers };
}

// ---------- Inngest ----------
export type InngestConfig = { eventKey: string; signingKey: string };
export function getInngestConfig(): InngestConfig | null {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (!eventKey || !signingKey) return null;
  return { eventKey, signingKey };
}

// ---------- Resend ----------
export type ResendConfig = { apiKey: string; from: string };
export function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return { apiKey, from: process.env.RESEND_FROM ?? "noreply@ansaraeo.com" };
}

// ---------- Tavily ----------
export function getTavilyApiKey(): string | null {
  return process.env.TAVILY_API_KEY || null;
}

// ---------- Crawl4AI ----------
export type Crawl4AIConfig = { apiUrl: string; apiKey: string };
export function getCrawl4AIConfig(): Crawl4AIConfig | null {
  const apiUrl = process.env.CRAWL4AI_API_URL;
  const apiKey = process.env.CRAWL4AI_API_KEY;
  if (!apiUrl || !apiKey) return null;
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}
