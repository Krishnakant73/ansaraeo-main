// AnsarAEO feature flags — evaluated via GrowthBook through @flags-sdk/growthbook.
//
// Flag keys are declared here and mirror flag keys in the GrowthBook dashboard.
// Callers `await` the flag function; server components can do this directly,
// client components read via a server-passed value (App Router pattern).
//
// The `identify()` helper (src/lib/identify.ts) supplies user/device context
// so GrowthBook can evaluate targeting rules.

import { growthbookAdapter } from "@flags-sdk/growthbook";
import { flag } from "flags/next";
import { identify } from "@/lib/identify";

// Kill-switch for the OpenRouter engine added in Batch E. Off by default so
// production traffic doesn't route to a brand-new caller until we've watched
// it for a few days. Flip in GrowthBook dashboard to enable.
export const openrouterEngineEnabled = flag<boolean>({
  key: "openrouter-engine-enabled",
  adapter: growthbookAdapter.feature<boolean>(),
  defaultValue: false,
  identify,
});
