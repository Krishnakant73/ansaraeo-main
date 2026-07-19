// Dependency-free, opt-in error reporting for AnsarAEO.
//
// If MONITORING_WEBHOOK_URL is set (e.g. a Slack/Discord incoming webhook or
// any HTTP endpoint that accepts a JSON POST), errors are shipped there
// fire-and-forget. Otherwise this is a no-op beyond console.error. It is
// deliberately impossible for reportError to throw into the caller — monitoring
// must never break the request path.

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
