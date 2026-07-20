// Inngest client — additive to the Postgres queue at src/lib/platform/queue.ts.
//
// Rules for what belongs here vs the Postgres queue:
//   - Postgres queue: visibility_check, trust_verify, agent_step — the durable
//     execution substrate for AnsarAEO's core pipelines. Do NOT move these.
//   - Inngest: net-new event-driven flows that benefit from Inngest's built-in
//     features — long delays (sleep hours/days), fan-out from a single event,
//     retries with exponential backoff, cross-service coordination.
//
// Singleton — `new Inngest(...)` at module load is safe here (unlike Razorpay)
// because Inngest doesn't validate the eventKey eagerly. The SDK reads
// INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from the environment on demand.

import { Inngest } from "inngest";

// Typed event catalog. New events go here so send() and function definitions
// share a single source of truth. Keep names dot-separated and past-tense
// ("org.created", not "createOrg") — matches Inngest's own conventions.
export type Events = {
  "org.created": {
    name: "org.created";
    data: {
      orgId: string;
      brandName: string;
      email: string;
    };
  };
};

export const inngest = new Inngest({
  id: "ansaraeo",
});

// Convenience: send an event without pulling the client at the call site.
// Silent no-op when INNGEST_EVENT_KEY is missing — matches the fire-and-forget
// discipline of src/lib/monitoring.ts (analytics/observability MUST NOT throw
// into the caller path). Callers still `await` for ordering, but a failure
// resolves rather than rejects.
export async function sendInngestEvent<K extends keyof Events>(
  name: K,
  data: Events[K]["data"],
): Promise<void> {
  if (!process.env.INNGEST_EVENT_KEY) return;
  try {
    await inngest.send({ name, data });
  } catch (err) {
    console.error(`[inngest] failed to send ${String(name)}:`, err);
  }
}
