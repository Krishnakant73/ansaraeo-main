import type { InternalLLMProvider } from "./types";
import { PROVIDER_REGISTRY } from "./registry";

// Selected via INTERNAL_LLM_PROVIDER (default "openai"). Switching providers
// is a configuration change only — no application code changes required.
export const INTERNAL_LLM_PROVIDER = (process.env.INTERNAL_LLM_PROVIDER ?? "openai").toLowerCase();

let cached: InternalLLMProvider | null = null;

export function getInternalLLM(): InternalLLMProvider {
  const name = INTERNAL_LLM_PROVIDER;
  const entry = PROVIDER_REGISTRY[name];
  if (!entry) {
    throw new Error(
      `Unknown INTERNAL_LLM_PROVIDER "${name}". Available: ${Object.keys(PROVIDER_REGISTRY).join(
        ", "
      )}.`
    );
  }
  if (!cached) cached = entry.create();
  return cached;
}

export { listProviders } from "./registry";
export { OpenAIProvider } from "./openai-provider";
export {
  InternalLLMError,
  isInternalLLMError,
  normalizeProviderError,
  kindFromStatus,
} from "./errors";
export type { InternalLLMErrorKind, InternalLLMErrorDebug } from "./errors";
export type {
  InternalLLMProvider,
  ClassifyResult,
  Entity,
  MissionPlan,
  GenerateInput,
  ChatInput,
  ChatMessage,
  ChatRole,
} from "./types";
