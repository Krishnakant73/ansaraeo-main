// Shared OTel tracer factory. Callers that want to span-wrap a code path
// grab a tracer from here rather than importing @opentelemetry/api all over.
//
// The tracer resolves to a real tracer once @vercel/otel has run in
// instrumentation.ts. Before that (or when OTel is disabled), OTel's
// NoopTracer is returned automatically — callers never have to guard.
//
// Usage:
//   const tracer = getTracer();
//   return tracer.startActiveSpan("visibility.classify", async (span) => {
//     try { ... span.setAttribute("engine", engineName); ... return result; }
//     finally { span.end(); }
//   });
import { trace, type Tracer } from "@opentelemetry/api";

export function getTracer(name = "ansar-aeo", version = "0.1.0"): Tracer {
  return trace.getTracer(name, version);
}
