// RouterBackedProvider — routes every internal LLM call through ModelRouter.
//
// Implements the pre-existing InternalLLMProvider contract so all ~16 callers
// (visibility-engine, content-optimizer, scan-classifier, price-factcheck,
// pdp-generator, brand-perception-io, and every other module that uses
// getInternalLLM()) migrate through a single env var flip:
//
//   INTERNAL_LLM_PROVIDER=openrouter
//
// vs. the previous default (openai) which hits OpenAI directly.
//
// The constitution's ModelRouter is the target: capability-based routing
// (DEFAULT / CLASSIFICATION), OpenRouter transport, prompt-hash Redis cache,
// automatic FALLBACK_MODEL on error, cost + usage recording.
//
// Every capability method maps to a specific capability slug so the router
// dispatches to the right model:
//   generate/chat/summarize → DEFAULT
//   classify/extractEntities → CLASSIFICATION
//   planMission → REASONING
// These slugs are declared here rather than in the router because they
// belong to the InternalLLMProvider contract's semantics, not to the router.

import type {
  ChatInput,
  ChatMessage,
  ClassifyResult,
  Entity,
  GenerateInput,
  InternalLLMProvider,
  MissionPlan,
} from "./types";
import { InternalLLMError } from "./errors";
import { getModelRouter } from "@/services/model-router";
import type { ModelCapability } from "@/config/models";

// Convert the legacy generate() shape to router (system, prompt) pair.
function toRouterPair(system: string | undefined, prompt: string | undefined): {
  system?: string;
  prompt: string;
} {
  // The router's `prompt` is required. When the caller passed only a system
  // message (a real usage — see GenerateInput.prompt being optional), we
  // synthesize a minimal user turn so the model has something to respond to.
  return { system, prompt: prompt && prompt.length > 0 ? prompt : " " };
}

// Chat message list → (system, single-user-blob) — lossy but adequate for
// the internal reasoning use case. Multi-turn history assembly (Agent Chat)
// intentionally does NOT go through InternalLLMProvider.chat().
function messagesToRouterPair(messages: ChatMessage[]): { system?: string; prompt: string } {
  const systems = messages.filter((m) => m.role === "system").map((m) => m.content);
  const others = messages.filter((m) => m.role !== "system");
  const combinedSystem = systems.length ? systems.join("\n\n") : undefined;
  const promptBlob = others
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n\n");
  return { system: combinedSystem, prompt: promptBlob || " " };
}

export interface RouterBackedProviderOptions {
  // Explicit override for the default capability. Callers rarely need this —
  // the class picks CLASSIFICATION / REASONING per-method automatically.
  defaultCapability?: ModelCapability;
}

export class RouterBackedProvider implements InternalLLMProvider {
  readonly name = "openrouter";
  private readonly defaultCapability: ModelCapability;

  constructor(opts: RouterBackedProviderOptions = {}) {
    this.defaultCapability = opts.defaultCapability ?? "DEFAULT";
  }

  private async dispatch(
    system: string | undefined,
    prompt: string,
    capability: ModelCapability,
    opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    try {
      const response = await getModelRouter().complete({
        capability,
        system,
        prompt,
        json: opts.json,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        caller: "internal-llm-router",
        // 5-minute cache dedupes the accidental double-invoke, without
        // staling variation across the day. Callers that need fresh output
        // every time should either pass different prompts or extend the
        // provider with an opt-out (no callers need that today).
        cacheTtlSeconds: 5 * 60,
      });
      return response.content;
    } catch (err) {
      // Normalize to the InternalLLMError shape callers already expect.
      throw new InternalLLMError({
        kind: "ProviderError",
        provider: "openrouter",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async generate(input: GenerateInput): Promise<string> {
    const { system, prompt } = toRouterPair(input.system, input.prompt);
    return this.dispatch(system, prompt, this.defaultCapability, {
      json: input.json,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }

  async chat(input: ChatInput): Promise<string> {
    const { system, prompt } = messagesToRouterPair(input.messages);
    return this.dispatch(system, prompt, this.defaultCapability, {
      json: input.json,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }

  async summarize(input: { text: string; maxLength?: number; model?: string }): Promise<string> {
    return this.dispatch(
      undefined,
      `Summarize the following text concisely in at most ${
        input.maxLength ?? 200
      } words. Preserve all key facts.\n\n${input.text}`,
      "UTILITY",
    );
  }

  async classify(input: { text: string; labels?: string[]; model?: string }): Promise<ClassifyResult> {
    const raw = await this.dispatch(
      undefined,
      `Classify the text into exactly one label${
        input.labels?.length ? ` from this list: ${input.labels.join(", ")}` : ""
      }.\nRespond ONLY as JSON: {"label": string, "confidence": number}.\n\n${input.text}`,
      "CLASSIFICATION",
      { json: true },
    );
    const parsed = JSON.parse(raw) as ClassifyResult;
    return {
      label: parsed.label,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  }

  async extractEntities(input: { text: string; model?: string }): Promise<Entity[]> {
    const raw = await this.dispatch(
      undefined,
      `Extract named entities from the text. Respond ONLY as JSON: {"entities": [{"type": string, "value": string}]}.\n\n${input.text}`,
      "CLASSIFICATION",
      { json: true },
    );
    const parsed = JSON.parse(raw) as { entities?: Entity[] };
    return parsed.entities ?? [];
  }

  async planMission(input: { goal: string; context?: string; model?: string }): Promise<MissionPlan> {
    const raw = await this.dispatch(
      undefined,
      `Break the goal into an ordered list of concrete steps. Respond ONLY as JSON: {"goal": string, "steps": string[]}.\nGoal: ${input.goal}\nContext: ${
        input.context ?? ""
      }`,
      "REASONING",
      { json: true },
    );
    const parsed = JSON.parse(raw) as MissionPlan;
    return { goal: parsed.goal ?? input.goal, steps: parsed.steps ?? [] };
  }
}
