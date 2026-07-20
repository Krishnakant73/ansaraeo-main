"use client";

// AppProviders — client-side provider tree.
//
// Wraps children with PostHog + Mixpanel. Stays split from the root layout
// so server components + metadata continue to render on the server (this
// file is the ONLY "use client" boundary in the app shell).
//
// Both trackers are guarded on their public tokens. When a token is unset,
// the provider becomes a passthrough — nothing initializes, nothing throws.
// This keeps local dev free of noise for anyone without keys in .env.local.

import { useEffect, type PropsWithChildren } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "@posthog/react";
import mixpanel from "mixpanel-browser";

const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    // Guard: init exactly once per client, and only if a token is present.
    if (POSTHOG_TOKEN && typeof window !== "undefined" && !posthog.__loaded) {
      posthog.init(POSTHOG_TOKEN, {
        api_host: POSTHOG_HOST,
        defaults: "2026-05-30",
        // Session replay is enabled by default in the PostHog dashboard config;
        // this stays honest to what the user pasted in their project setup.
        capture_pageview: "history_change",
      });
    }
    if (MIXPANEL_TOKEN && typeof window !== "undefined") {
      // mixpanel-browser is a singleton — safe to call init repeatedly, but
      // we still guard on a loaded marker to skip the network on every render.
      const mp = mixpanel as unknown as { __loaded?: boolean };
      if (!mp.__loaded) {
        mixpanel.init(MIXPANEL_TOKEN, {
          track_pageview: "url-with-path",
          persistence: "localStorage",
        });
        mp.__loaded = true;
      }
    }
  }, []);

  // Wrap in PostHog's React provider only when configured. Without a token,
  // the provider still works but we avoid the extra render tree.
  if (POSTHOG_TOKEN) {
    return <PHProvider client={posthog}>{children}</PHProvider>;
  }
  return <>{children}</>;
}
