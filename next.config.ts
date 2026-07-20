import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Sentry Next.js webpack plugin — uploads source maps at build time when
// SENTRY_AUTH_TOKEN is present, otherwise it's a no-op wrapper (safe for
// local dev + CI builds without the token). Matches the lazy-init spirit
// of getRazorpay() — never fails the build on missing secrets.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Silent locally; verbose in CI so upload issues surface.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // We tunnel client requests through /monitoring to sidestep ad-blockers
  // in India that block *.sentry.io. See Sentry docs for the route Next
  // generates internally.
  tunnelRoute: "/monitoring",
  // Only upload source maps on actual builds with a token — prevents dev
  // rebuilds from hammering Sentry.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
