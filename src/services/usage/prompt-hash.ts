// Prompt hash — deterministic content addressing for the LLM cache.
//
// SHA-256 over the canonical serialization of the request tuple:
//   (model, systemPrompt, userPrompt, jsonMode, additional-options)
//
// Router uses this as the Redis cache key. Two identical requests share
// one cache entry regardless of caller.
//
// Constitution: "Hash prompts. Cache repeated AI requests. Redis."

import { createHash } from "crypto";

export type PromptInput = {
  model: string;
  system?: string;
  prompt: string;
  json?: boolean;
  // Any extra options that materially change the output (temperature, etc.)
  // Callers pass a stable, sorted object.
  extras?: Record<string, unknown>;
};

export function hashPrompt(input: PromptInput): string {
  const canonical = JSON.stringify({
    m: input.model,
    s: input.system ?? "",
    p: input.prompt,
    j: input.json ?? false,
    x: sortedExtras(input.extras),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function sortedExtras(extras: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!extras) return {};
  const keys = Object.keys(extras).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = extras[k];
  return out;
}
