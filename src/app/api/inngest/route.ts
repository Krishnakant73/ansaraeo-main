// Inngest webhook endpoint — the URL you paste into the Inngest dashboard
// or `npx inngest-cli@latest dev` config. Inngest POSTs here to invoke
// registered functions.
//
// The `serve` helper generates GET (introspection) + POST (execution) +
// PUT (registration) handlers all at once — Inngest's cloud uses PUT to
// discover new functions on deploy.
//
// Signing key is read from INNGEST_SIGNING_KEY by the SDK automatically at
// runtime. No key = no verification, which is fine for `inngest dev` (local)
// but Inngest will reject production writes without one.

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { inngestFunctions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
