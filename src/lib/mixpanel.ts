// Server-side Mixpanel wrapper. Dual-track alongside PostHog:
//   - PostHog: session replay, feature-flag exposure, autocapture
//   - Mixpanel: funnels, retention, cohort analysis
// Both consume the same event stream from AppProviders on the client and
// captureServerEvent() on the server.
//
// Lazy pattern mirrors getRazorpay(): never call `Mixpanel.init(...)` at
// module load time — do it inside the request handler so builds without
// the token still compile.
import Mixpanel from "mixpanel";
import { getMixpanelToken } from "@/lib/env";

let _client: Mixpanel.Mixpanel | null = null;

export function getMixpanel(): Mixpanel.Mixpanel | null {
  if (_client) return _client;
  const token = getMixpanelToken();
  if (!token) return null;
  _client = Mixpanel.init(token);
  return _client;
}

// Server-side track. Silent no-op when Mixpanel isn't configured.
// Failure-isolated: never throws into the caller.
export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(event, { distinct_id: distinctId, ...properties });
  } catch {
    /* never throw from analytics */
  }
}
