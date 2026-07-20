// ModelRouter port. The internal reasoning path — every service that
// needs an LLM goes through this, never directly to a provider SDK.
//
// Constitution rule: `ModelRouter → OpenRouter → Selected Model`.

import type { ModelCapability } from "@/config/models";

export type RouterRequest = {
  capability: ModelCapability;
  system?: string;
  prompt: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;

  // Cache TTL in seconds. Undefined = don't cache. Zero = cache forever.
  cacheTtlSeconds?: number;

  // Attribution for cost/usage records.
  orgId?: string | null;
  caller?: string | null;
};

export type RouterResponse = {
  content: string;
  model: string;
  capability: ModelCapability;
  tokensIn: number;
  tokensOut: number;
  costMicroUsd: number;
  latencyMs: number;
  cached: boolean;
  finishReason: string | null;
};

export interface ModelRouter {
  complete(req: RouterRequest): Promise<RouterResponse>;
}
