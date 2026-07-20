// Next.js 16 instrumentation hook. Runs once per runtime at server startup.
// Wires:
//   - Sentry (nodejs + edge) — error + performance tracing
//   - @vercel/otel — OpenTelemetry SDK exporting to whatever OTLP endpoint
//     OTEL_EXPORTER_OTLP_ENDPOINT points at (Better Stack Telemetry today).
//
// The two coexist. Sentry auto-instruments HTTP/fetch for its own dashboard;
// @vercel/otel exports separate spans over OTLP for aggregation. Overlap is
// fine — cost is a rounding error and it means we don't lose visibility if
// either provider goes dark.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // OTLP exporter to Better Stack (or any OTLP-compatible collector).
    // Endpoint + headers come from env; unset endpoint = OTel doesn't init.
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      const { registerOTel } = await import("@vercel/otel");
      registerOTel({ serviceName: "ansar-aeo" });
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js 15+ hook — Sentry uses this to capture request errors from the
// App Router with full context (route, params, cookies excluding secrets).
export const onRequestError = Sentry.captureRequestError;
