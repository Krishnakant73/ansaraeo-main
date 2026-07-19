// ============================================================
// Internal LLM abstraction.
//
// AnsarAEO uses a single internal LLM for its OWN reasoning work
// (content drafts, classification, entity extraction, summarization,
// mission planning). This module abstracts that worker behind a small,
// capability-oriented interface so the underlying provider
// (OpenAI today; Claude / Gemini / Grok / local later) can be swapped
// via configuration WITHOUT touching application code.
//
// This is an internal engineering concern only — it does NOT change any
// customer-facing behavior, prompts, workflows, or business logic.
//
// ─────────────────────────────────────────────────────────────────
// ARCHITECTURE BOUNDARY — READ BEFORE TOUCHING ANYTHING HERE
// ─────────────────────────────────────────────────────────────────
// src/lib/llm/* is AnsarAEO's OWN reasoning backend. It answers the
// question "which LLM does AnsarAEO use to do ITS work?" (drafting
// content, classifying answers, extracting entities, planning missions,
// chatting with the user).
//
// It is COMPLETELY SEPARATE from the *Answer Engines* the product
// measures (src/lib/visibility-engine.ts, src/lib/visibility-
// consistency.ts): ChatGPT, Claude, Gemini, Perplexity, Google AI
// Overview, Copilot, Grok. Those are MEASUREMENT TARGETS — "does the
// brand get mentioned when a CUSTOMER asks that engine?" They are NEVER
// implemented as InternalLLMProvider instances and must never share code
// with this module. See src/lib/llm/README.md.
//
// NAME-COLLISION WARNING: the registry (registry.ts) lists "claude",
// "gemini", "grok" as *internal* provider candidates. Those names
// refer to "which model WE call for OUR reasoning", NOT the answer
// engine of the same name. Never let the shared names blur the two
// layers.
// ============================================================

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// Input to the legacy single-turn generate() call.
//
// `prompt` is OPTIONAL: when omitted, only the `system` message is sent
// (a few call sites issue a system-only request). A non-empty `prompt`
// is required for a normal user+system exchange.
export interface GenerateInput {
  system?: string;
  prompt?: string;
  model?: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

// Input to the multi-turn chat() call. `messages` is sent verbatim.
export interface ChatInput {
  messages: ChatMessage[];
  model?: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ClassifyResult {
  label: string;
  confidence: number;
}

export interface Entity {
  type: string;
  value: string;
}

export interface MissionPlan {
  goal: string;
  steps: string[];
}

// The five capabilities AnsarAEO currently uses from its internal LLM.
export interface InternalLLMProvider {
  readonly name: string;

  // Free-form generation. Returns the model's raw text (often JSON when
  // `json` is set). Callers parse the result as needed.
  //
  // `prompt` is OPTIONAL (see GenerateInput). Implementing providers MUST
  // support a system-only request (no `prompt`) as well as a
  // system+prompt exchange. See README.md for the contract.
  generate(input: GenerateInput): Promise<string>;

  // Multi-turn chat. Accepts an explicit message list (system/user/
  // assistant) and sends it verbatim to the provider. Internally reuses
  // the exact same request path as generate(); generate() remains the
  // legacy single-turn interface and is preserved for backward
  // compatibility (every existing caller uses generate()).
  //
  // NOTE: the existing Agent Chat route (src/app/api/agent/chat/route.ts)
  // is intentionally NOT migrated to chat() — it owns multi-turn history
  // assembly and conversation persistence that must not change. This method
  // exists for future agent surfaces and to make the full chat interface
  // explicit. See TASK 3 notes in the PR / final report.
  chat(input: ChatInput): Promise<string>;

  summarize(input: { text: string; maxLength?: number; model?: string }): Promise<string>;

  classify(input: { text: string; labels?: string[]; model?: string }): Promise<ClassifyResult>;

  extractEntities(input: { text: string; model?: string }): Promise<Entity[]>;

  planMission(input: { goal: string; context?: string; model?: string }): Promise<MissionPlan>;
}
