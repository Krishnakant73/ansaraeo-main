// Sentry edge runtime init. Runs in middleware (src/proxy.ts) + any route
// exported with `runtime: "edge"`. Kept minimal — the edge runtime has no
// Node APIs, so we can't reuse the server config.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
  debug: false,
  sendDefaultPii: false,
});
