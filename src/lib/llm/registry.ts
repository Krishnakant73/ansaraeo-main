import type { InternalLLMProvider } from "./types";
import { OpenAIProvider } from "./openai-provider";
import { RouterBackedProvider } from "./router-provider";
import { createPlaceholderProvider } from "./providers/placeholder";

export interface ProviderEntry {
  implemented: boolean;
  create: () => InternalLLMProvider;
}

// ───────────────────────────────────────────────────────────────────
// ⚠️  READ BEFORE ADDING A PROVIDER  ⚠️
// These names are AnsarAEO's INTERNAL reasoning backend candidates —
// i.e. "which model does AnsarAEO call to do OUR work?" They are NOT
// the Answer Engines the product measures (ChatGPT, Claude, Gemini,
// Perplexity, Google AI Overview, Copilot, Grok in
// src/lib/visibility-engine.ts / visibility-consistency.ts). Those are
// measurement TARGETS and must NEVER be implemented as InternalLLMProvider
// instances. The shared names ("claude"/"gemini"/"grok") below refer to
// OUR backend choice, not the competitor engine of the same name.
// See src/lib/llm/README.md.
// ───────────────────────────────────────────────────────────────────
//
// Single source of truth for which internal LLM providers exist. Adding a
// real provider is: implement the class, register it here, (optionally) read
// its key from env. No application code that calls getInternalLLM() changes.
export const PROVIDER_REGISTRY: Record<string, ProviderEntry> = {
  openai: { implemented: true, create: () => new OpenAIProvider() },
  // Constitution ModelRouter path. Set INTERNAL_LLM_PROVIDER=openrouter to
  // route every internal LLM call (16+ callers) through OpenRouter with
  // capability-based routing, prompt-hash cache, and cost tracking. Same
  // InternalLLMProvider contract — zero caller changes.
  openrouter: { implemented: true, create: () => new RouterBackedProvider() },
  claude: { implemented: false, create: () => createPlaceholderProvider("claude") },
  gemini: { implemented: false, create: () => createPlaceholderProvider("gemini") },
  grok: { implemented: false, create: () => createPlaceholderProvider("grok") },
  local: { implemented: false, create: () => createPlaceholderProvider("local") },
};

export function listProviders(): { name: string; implemented: boolean }[] {
  return Object.entries(PROVIDER_REGISTRY).map(([name, entry]) => ({
    name,
    implemented: entry.implemented,
  }));
}
