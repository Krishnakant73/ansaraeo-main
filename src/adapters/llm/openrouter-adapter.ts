// OpenRouter LLM adapter. OpenAI-compatible chat completions API against
// https://openrouter.ai/api/v1/chat/completions.
//
// Cost is NOT calculated here — the router does it, keyed on a model→rate
// table. The adapter's job is to return provider-native metadata.

import type { LlmAdapter, LlmRequest, LlmResponse } from "./types";

export class OpenRouterAdapter implements LlmAdapter {
  readonly provider = "openrouter";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://openrouter.ai/api/v1",
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = request.timeoutMs
      ? setTimeout(() => controller.abort(), request.timeoutMs)
      : null;

    try {
      const body: Record<string, unknown> = {
        model: request.model,
        messages: request.messages,
      };
      if (request.temperature !== undefined) body.temperature = request.temperature;
      if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
      if (request.json) body.response_format = { type: "json_object" };

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://ansaraeo.com",
          "X-Title": "AnsarAEO",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
      }

      const data = (await res.json()) as {
        model?: string;
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };

      const choice = data.choices?.[0];
      return {
        content: choice?.message?.content ?? "",
        model: data.model ?? request.model,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        finishReason: choice?.finish_reason ?? null,
        raw: data as Record<string, unknown>,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
