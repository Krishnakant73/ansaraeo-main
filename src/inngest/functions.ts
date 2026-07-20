// Inngest function definitions. Each function subscribes to one event from
// src/inngest/client.ts's typed catalog.
//
// Starter function: welcomeNewOrg. Fires on "org.created", sends a welcome
// email via Resend. This exists as an end-to-end smoke test of the Inngest
// wiring — replace the body with real onboarding steps once verified against
// the Inngest dev server (`npx inngest-cli@latest dev`).

import { inngest, type Events } from "./client";
import { sendEmail } from "@/lib/email";

export const welcomeNewOrg = inngest.createFunction(
  {
    id: "welcome-new-org",
    name: "Send welcome email on org.created",
    triggers: [{ event: "org.created" }],
  },
  async ({ event, step }) => {
    // Narrow via unknown — Inngest's Received event union includes
    // "inngest/function.invoked" alongside our trigger. At runtime this
    // handler only sees "org.created" payloads.
    const { orgId, brandName, email } = (event as unknown as Events["org.created"]).data;

    // step.run wraps side effects so Inngest can retry them idempotently
    // without re-running the whole function.
    await step.run("send-welcome-email", async () => {
      const result = await sendEmail({
        provider: "resend",
        to: email,
        subject: `${brandName} — welcome to AnsarAEO`,
        text: `${brandName} is now live in AnsarAEO.

We're queuing your first visibility check across ChatGPT, Perplexity, Gemini and Google AI Overview. You'll see the first results in your dashboard within the next few minutes.

${process.env.NEXT_PUBLIC_APP_URL ?? "https://ansaraeo.com"}/dashboard`,
      });
      if (!result.ok) throw new Error(`welcome email failed: ${result.error}`);
      return { orgId, provider: result.provider };
    });

    return { orgId, delivered: true };
  },
);

// Registry consumed by src/app/api/inngest/route.ts.
export const inngestFunctions = [welcomeNewOrg];
