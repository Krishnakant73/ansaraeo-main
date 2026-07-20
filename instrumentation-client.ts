// Browser Sentry init. Next.js 16 auto-loads this on the client alongside
// the server-side instrumentation.ts hook. Sampling defaults are conservative
// — bump tracesSampleRate once the free-tier quota is understood.
//
// Session replay is intentionally OFF here: PostHog Batch C carries that
// concern with better cost + India-friendly ingest. Sentry stays focused on
// errors + spans.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // We surface user identity via PostHog / Mixpanel — Sentry stays PII-lean.
  sendDefaultPii: false,
  // Filter noisy browser extensions and localhost noise.
  ignoreErrors: [
    "top.GLOBALS",
    /Non-Error promise rejection captured/,
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
  ],
});

// Named export required by Next.js 15+ to capture router-transition errors.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
