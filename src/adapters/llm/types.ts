// LLM adapter port. The ModelRouter depends on this interface, not on any
// specific provider SDK. Swap OpenRouter for a direct provider (or a local
// model) by writing a new adapter and rebinding in wiring.

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmRequest = {
  model: string;
  messages: LlmMessage[];
  json?: boolean;
  // Provider-agnostic knobs. Adapters translate these to their native params.
  temperature?: number;
  maxTokens?: number;
  // Timeout in ms; adapters should honor this via AbortSignal.
  timeoutMs?: number;
};

export type LlmResponse = {
  content: string;
  model: string; // The model actually served (may differ from request in fallback paths).
  tokensIn: number;
  tokensOut: number;
  finishReason: string | null;
  raw?: Record<string, unknown>;
};

export interface LlmAdapter {
  readonly provider: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}
