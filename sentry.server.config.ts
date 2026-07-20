// Sentry server-side init. Runs in the Node runtime (App Router server
// components, route handlers, cron routes). When SENTRY_DSN is unset the
// SDK becomes a silent no-op, so this stays safe in local dev without keys.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Sentry auto-instruments fetch + http; we let @vercel/otel handle the
  // exporter side so traces flow into Better Stack in parallel.
  debug: false,
  // Never send raw request bodies to Sentry — cron routes carry CRON_SECRET
  // in Authorization, webhooks carry signed payloads, etc.
  sendDefaultPii: false,
  // Attach local variables to server stack frames — cheap on cost, huge
  // debugging win when a cron/worker throws.
  includeLocalVariables: true,
});
