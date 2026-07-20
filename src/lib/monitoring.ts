// Opt-in error reporting for AnsarAEO. Two independent sinks:
//   1. Sentry — via @sentry/nextjs when SENTRY_DSN is set. Structured errors,
//      breadcrumbs, source maps.
//   2. MONITORING_WEBHOOK_URL — dependency-free fallback (Slack/Discord/etc.)
//      that still works when Sentry is unreachable or intentionally disabled.
//
// Both sinks are strictly fire-and-forget. reportError() MUST NOT throw into
// the caller — monitoring must never break the request path.
//
// Sentry is imported lazily so this module stays usable in code paths that
// run before instrumentation.ts (e.g., very early boot errors) and in tests
// that don't want the SDK loaded.

export type ErrorContext = Record<string, unknown>;

export function reportError(error: unknown, context?: ErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  if (context && Object.keys(context).length > 0) {
    console.error(`[reportError] ${message}`, context);
  } else {
    console.error(`[reportError] ${message}`);
  }
  if (stack) console.error(stack);

  // Sink 1: Sentry. Lazy import + broad try/catch — never let SDK errors
  // (or a missing DSN making captureException throw) escape.
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    void (async () => {
      try {
        const Sentry = await import("@sentry/nextjs");
        if (error instanceof Error) {
          Sentry.captureException(error, context ? { extra: context } : undefined);
        } else {
          Sentry.captureMessage(message, {
            level: "error",
            extra: context,
          });
        }
      } catch {
        /* swallow — monitoring must never break the request path */
      }
    })();
  }

  // Sink 2: raw HTTP webhook (Slack/Discord/etc.).
  const webhook = process.env.MONITORING_WEBHOOK_URL;
  if (!webhook) return;

  try {
    const payload = JSON.stringify({
      text: `AnsarAEO error: ${message}`,
      context,
      stack,
      service: "ansar-aeo",
    });
    fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {
      /* swallow — monitoring must never break the request path */
    });
  } catch {
    /* never throw */
  }
}
