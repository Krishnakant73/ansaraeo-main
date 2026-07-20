// Server-side PostHog client. Follows the getRazorpay() lazy pattern from
// src/lib/razorpay.ts — never construct the client at module load time
// (Next.js evaluates route modules during page-data collection at build time,
// and a missing key would blow up the build).
//
// Callers use getPostHog() inside the request handler and get null when the
// project token isn't configured — never throws.
import { PostHog } from "posthog-node";
import { getPostHogConfig } from "@/lib/env";

let _client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  const cfg = getPostHogConfig();
  if (!cfg) return null;
  if (!_client) {
    _client = new PostHog(cfg.token, {
      host: cfg.host,
      // Flush aggressively in serverless: each cron/webhook invocation is
      // short-lived, so we don't want events pooling in memory.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

// Fire a server-side event. Silent no-op when PostHog isn't configured.
// Failure-isolated per the monitoring rule: analytics never breaks the caller.
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    const ph = getPostHog();
    if (!ph) return;
    ph.capture({ distinctId, event, properties });
  } catch {
    /* never throw from analytics */
  }
}

// Call before a serverless function exits when possible so events aren't
// dropped. Safe to skip — the flushAt:1 config sends synchronously anyway.
export async function shutdownPostHog(): Promise<void> {
  try {
    await _client?.shutdown();
  } catch {
    /* never throw */
  }
}
