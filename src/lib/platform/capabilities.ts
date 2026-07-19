import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Capability negotiation — the honest "what can actually run" surface.
// Carries the repo's no-fake-engine rule: an engine is reported available
// only if its required credentials are present. Phase 2/3 read this to know
// what they may call. See docs/PHASE1_API_GATEWAY.md §3.4.
// ============================================================

export interface EngineCapability {
  name: string;
  available: boolean;
  reason?: string;
}

// Required env vars per engine. Kept in sync with visibility-engine.ts callers.
const ENGINE_ENV: Record<string, { vars: string[]; reason: string }> = {
  chatgpt: { vars: ["OPENAI_API_KEY"], reason: "OPENAI_API_KEY not set" },
  perplexity: { vars: ["PERPLEXITY_API_KEY"], reason: "PERPLEXITY_API_KEY not set" },
  gemini: { vars: ["GOOGLE_AI_API_KEY"], reason: "GOOGLE_AI_API_KEY not set" },
  google_ai_overview: {
    vars: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    reason: "DataForSEO credentials not set",
  },
  grok: { vars: ["GROK_API_KEY"], reason: "GROK_API_KEY not set" },
  copilot: { vars: ["COPILOT_API_URL", "COPILOT_API_KEY"], reason: "Copilot proxy URL/key not set" },
};

/** Pure, env-only check — unit-testable without a database. */
export function engineAvailability(name: string): { available: boolean; reason?: string } {
  const cfg = ENGINE_ENV[name];
  if (!cfg) return { available: true }; // unknown/future engines assumed available
  const missing = cfg.vars.filter((v) => !process.env[v]);
  return missing.length === 0 ? { available: true } : { available: false, reason: cfg.reason };
}

export async function getCapabilities(
  sb: SupabaseClient = createServiceClient()
): Promise<{ engines: EngineCapability[]; regions: string[] }> {
  const supabase = sb;
  const { data: engines } = await supabase
    .from("engines")
    .select("name, is_active")
    .eq("is_active", true);
  const list = (engines ?? []).map((e: { name: string }) => ({
    name: e.name,
    ...engineAvailability(e.name),
  }));
  return { engines: list, regions: ["ap-south-1"] };
}
