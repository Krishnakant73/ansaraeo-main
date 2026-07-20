// ============================================================
// OpenRouterModelRouter — capability-routed LLM dispatcher.
//
// Pipeline per request:
//   1. Resolve capability → model ID (from env via config/models.ts)
//   2. Compute prompt hash → look up cache
//   3. Cache hit: return cached content + record cache hit (cost = 0)
//   4. Cache miss: call LlmAdapter (OpenRouter) with fallback on error
//   5. Record usage (tokens + micro-USD) into model_usage
//   6. Store in cache when caller opted in (cacheTtlSeconds)
//
// Every rule from the constitution:
//   - Never hardcodes a model ID (all come from env)
//   - Routes by capability, not provider
//   - Falls back to FALLBACK_MODEL on error
//   - Structured JSON via json:true (never parses NL)
//   - Prompt hash + Redis cache
//   - Records cost + usage per call
// ============================================================

import { getEnv } from "@/config/env";
import { getModelForCapability, type ModelCapability } from "@/config/models";
import { OpenRouterAdapter, computeCostMicroUsd } from "@/adapters/llm";
import type { LlmAdapter, LlmRequest } from "@/adapters/llm";
import { getCache } from "@/adapters/cache";
import { getUsageTracker } from "@/services/usage";
import { hashPrompt } from "@/services/usage/prompt-hash";
import type { ModelRouter, RouterRequest, RouterResponse } from "./types";

type CachedEntry = {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  finishReason: string | null;
};

export class OpenRouterModelRouter implements ModelRouter {
  constructor(private readonly adapter: LlmAdapter) {}

  async complete(req: RouterRequest): Promise<RouterResponse> {
    const model = getModelForCapability(req.capability);
    const started = Date.now();

    const promptHash = hashPrompt({
      model,
      system: req.system,
      prompt: req.prompt,
      json: req.json,
      extras: {
        temperature: req.temperature,
        maxTokens: req.maxTokens,
      },
    });

    // ---- Cache lookup ----
    const cache = getCache();
    if (req.cacheTtlSeconds !== undefined) {
      const cached = await safe(() => cache.get<CachedEntry>(`llm:${promptHash}`));
      if (cached) {
        void this.recordUsage({
          req,
          model: cached.model,
          promptHash,
          tokensIn: cached.tokensIn,
          tokensOut: cached.tokensOut,
          costMicroUsd: 0,
          latencyMs: Date.now() - started,
          cached: true,
        });
        return {
          content: cached.content,
          model: cached.model,
          capability: req.capability,
          tokensIn: cached.tokensIn,
          tokensOut: cached.tokensOut,
          costMicroUsd: 0,
          latencyMs: Date.now() - started,
          cached: true,
          finishReason: cached.finishReason,
        };
      }
    }

    // ---- Live call with fallback ----
    const llmRequest: LlmRequest = {
      model,
      messages: buildMessages(req),
      json: req.json,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      timeoutMs: req.timeoutMs ?? 60_000,
    };

    let llmResponse;
    try {
      llmResponse = await this.adapter.complete(llmRequest);
    } catch (primaryErr) {
      // One retry against the FALLBACK_MODEL. If both fail, surface the
      // original error (more diagnostic than the fallback's).
      const fallback = getEnv().FALLBACK_MODEL;
      if (fallback && fallback !== model) {
        try {
          llmResponse = await this.adapter.complete({ ...llmRequest, model: fallback });
        } catch {
          throw primaryErr;
        }
      } else {
        throw primaryErr;
      }
    }

    const costMicroUsd = computeCostMicroUsd(
      llmResponse.model,
      llmResponse.tokensIn,
      llmResponse.tokensOut,
    );
    const latencyMs = Date.now() - started;

    // ---- Cache store (best-effort) ----
    const ttl = req.cacheTtlSeconds;
    if (ttl !== undefined) {
      void safe(() =>
        cache.set(
          `llm:${promptHash}`,
          {
            content: llmResponse!.content,
            model: llmResponse!.model,
            tokensIn: llmResponse!.tokensIn,
            tokensOut: llmResponse!.tokensOut,
            finishReason: llmResponse!.finishReason,
          } satisfies CachedEntry,
          ttl > 0 ? ttl : undefined,
        ),
      );
    }

    // ---- Usage recording (fire and forget) ----
    void this.recordUsage({
      req,
      model: llmResponse.model,
      promptHash,
      tokensIn: llmResponse.tokensIn,
      tokensOut: llmResponse.tokensOut,
      costMicroUsd,
      latencyMs,
      cached: false,
    });

    return {
      content: llmResponse.content,
      model: llmResponse.model,
      capability: req.capability,
      tokensIn: llmResponse.tokensIn,
      tokensOut: llmResponse.tokensOut,
      costMicroUsd,
      latencyMs,
      cached: false,
      finishReason: llmResponse.finishReason,
    };
  }

  private async recordUsage(params: {
    req: RouterRequest;
    model: string;
    promptHash: string;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
    latencyMs: number;
    cached: boolean;
  }): Promise<void> {
    try {
      await getUsageTracker().record({
        orgId: params.req.orgId ?? null,
        capability: params.req.capability,
        model: params.model,
        provider: this.adapter.provider,
        promptHash: params.promptHash,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        costMicroUsd: params.costMicroUsd,
        latencyMs: params.latencyMs,
        cached: params.cached,
        caller: params.req.caller ?? null,
      });
    } catch {
      /* usage tracking must never break the router */
    }
  }
}

function buildMessages(req: RouterRequest): LlmRequest["messages"] {
  const messages: LlmRequest["messages"] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.prompt });
  return messages;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

// ---- Singleton wiring ----
let _instance: OpenRouterModelRouter | null = null;

export function getModelRouter(): ModelRouter {
  if (_instance) return _instance;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured — ModelRouter cannot dispatch");
  }
  _instance = new OpenRouterModelRouter(new OpenRouterAdapter(apiKey));
  return _instance;
}
