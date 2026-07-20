// Model pricing table — USD per million tokens. Used by the CostTracker
// to convert (model, tokens_in, tokens_out) into micro-USD.
//
// Rates match OpenRouter's public model pricing as of 2026-07. Keep this
// table small and current; the router falls back to a conservative default
// when a model isn't listed here (prevents undetected free rides for new
// models, but doesn't block the call).
//
// Update alongside model changes in .env.all.example / src/config/env.schema.ts.

export type ModelRate = { in: number; out: number };

const RATES_USD_PER_MILLION_TOKENS: Record<string, ModelRate> = {
  // OpenAI via OpenRouter
  "openai/gpt-4.1-mini": { in: 0.15, out: 0.6 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "openai/gpt-4o": { in: 2.5, out: 10.0 },
  "openai/gpt-4.1": { in: 2.0, out: 8.0 },

  // Anthropic
  "anthropic/claude-sonnet-4": { in: 3.0, out: 15.0 },
  "anthropic/claude-haiku-4": { in: 0.25, out: 1.25 },

  // Google
  "google/gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "google/gemini-2.5-pro": { in: 1.25, out: 5.0 },

  // Perplexity
  "perplexity/sonar": { in: 1.0, out: 1.0 },

  // DeepSeek
  "deepseek/deepseek-chat-v3": { in: 0.27, out: 1.1 },

  // xAI
  "x-ai/grok-2-latest": { in: 2.0, out: 10.0 },

  // Qwen (batch/utility)
  "qwen/qwen-2.5-72b-instruct": { in: 0.35, out: 0.4 },
};

// Conservative default for unknown models. Assume mid-tier so cost accounting
// never silently under-reports.
const DEFAULT_RATE: ModelRate = { in: 1.0, out: 3.0 };

const MICRO_USD_PER_USD = 1_000_000;

// Returns cost in integer micro-USD (1_000_000 = $1).
// Integer math prevents float drift over aggregation.
export function computeCostMicroUsd(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const rate = RATES_USD_PER_MILLION_TOKENS[model] ?? DEFAULT_RATE;
  const usd = (tokensIn * rate.in + tokensOut * rate.out) / 1_000_000;
  return Math.round(usd * MICRO_USD_PER_USD);
}

export function getModelRate(model: string): ModelRate {
  return RATES_USD_PER_MILLION_TOKENS[model] ?? DEFAULT_RATE;
}
