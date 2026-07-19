import type { ChatInput, ChatMessage, Entity, GenerateInput, InternalLLMProvider, MissionPlan, ClassifyResult } from "./types";
import { InternalLLMError, kindFromStatus, normalizeProviderError } from "./errors";

const DEFAULT_MODEL = "gpt-4o-mini";

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
}

// Shared request options for the single internal request path.
type RequestOpts = {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

// The only fully-functional internal LLM provider today. It mirrors the
// exact calling convention the rest of the codebase already uses for its
// own reasoning work (gpt-4o-mini, chat/completions, JSON mode where needed).
//
// generate() and chat() both funnel through the private `request()` so
// there is exactly ONE place that talks to the network and ONE error shape
// (InternalLLMError) returned on failure. See errors.ts.
export class OpenAIProvider implements InternalLLMProvider {
  readonly name = "openai";
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = opts.model ?? process.env.INTERNAL_LLM_OPENAI_MODEL ?? DEFAULT_MODEL;
  }

  // Single network + error-normalization path. Shared by generate(), chat(),
  // and every capability helper. Throws InternalLLMError on any failure so
  // callers get a consistent, debuggable error — never a raw fetch/JSON error.
  private async request(messages: ChatMessage[], opts: RequestOpts = {}): Promise<string> {
    // Config guard kept as a plain Error (not InternalLLMError) so the
    // existing "OPENAI_API_KEY not set" contract/test stays byte-for-byte.
    if (!this.apiKey) throw new Error("OPENAI_API_KEY not set");
    const model = opts.model ?? this.model;

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          temperature: opts.temperature,
          max_tokens: opts.maxTokens,
          messages,
        }),
      });
    } catch (err) {
      // Network / abort failure → normalized (TimeoutError when applicable).
      throw normalizeProviderError("openai", err, { model });
    }

    if (!res.ok) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 2000);
      } catch {
        /* response body unreadable — message falls back to status only */
      }
      throw new InternalLLMError({
        kind: kindFromStatus(res.status),
        provider: "openai",
        message: `OpenAI error (${res.status})${body ? `: ${body}` : ""}`,
        status: res.status,
        model,
        debug: { responseBody: body },
      });
    }

    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = (await res.json()) as typeof data;
    } catch (err) {
      throw normalizeProviderError("openai", err, { model, status: res.status });
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalLLMError({
        kind: "ProviderError",
        provider: "openai",
        message: "Internal LLM error (openai): empty completion",
        model,
        debug: { rawChoices: data.choices },
      });
    }
    return content;
  }

  async generate(input: GenerateInput): Promise<string> {
    const messages: ChatMessage[] = [
      ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
      // `prompt` is OPTIONAL: when omitted, only the system message is sent.
      ...(input.prompt ? [{ role: "user" as const, content: input.prompt }] : []),
    ];
    return this.request(messages, {
      model: input.model,
      json: input.json,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }

  async chat(input: ChatInput): Promise<string> {
    // Reuses the exact same request path as generate() — only the message
    // assembly differs (chat takes a verbatim message list instead of a
    // system+prompt pair).
    return this.request(input.messages, {
      model: input.model,
      json: input.json,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }

  async summarize(input: { text: string; maxLength?: number; model?: string }): Promise<string> {
    return this.request(
      [
        {
          role: "user",
          content: `Summarize the following text concisely in at most ${
            input.maxLength ?? 200
          } words. Preserve all key facts.\n\n${input.text}`,
        },
      ],
      { model: input.model },
    );
  }

  async classify(input: { text: string; labels?: string[]; model?: string }): Promise<ClassifyResult> {
    const raw = await this.request(
      [
        {
          role: "user",
          content: `Classify the text into exactly one label${
            input.labels?.length ? ` from this list: ${input.labels.join(", ")}` : ""
          }.\nRespond ONLY as JSON: {"label": string, "confidence": number}.\n\n${input.text}`,
        },
      ],
      { json: true, model: input.model },
    );
    const parsed = JSON.parse(raw) as ClassifyResult;
    return {
      label: parsed.label,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  }

  async extractEntities(input: { text: string; model?: string }): Promise<Entity[]> {
    const raw = await this.request(
      [
        {
          role: "user",
          content: `Extract named entities from the text. Respond ONLY as JSON: {"entities": [{"type": string, "value": string}]}.\n\n${input.text}`,
        },
      ],
      { json: true, model: input.model },
    );
    const parsed = JSON.parse(raw) as { entities?: Entity[] };
    return parsed.entities ?? [];
  }

  async planMission(input: { goal: string; context?: string; model?: string }): Promise<MissionPlan> {
    const raw = await this.request(
      [
        {
          role: "user",
          content: `Break the goal into an ordered list of concrete steps. Respond ONLY as JSON: {"goal": string, "steps": string[]}.\nGoal: ${input.goal}\nContext: ${
            input.context ?? ""
          }`,
        },
      ],
      { json: true, model: input.model },
    );
    const parsed = JSON.parse(raw) as MissionPlan;
    return { goal: parsed.goal ?? input.goal, steps: parsed.steps ?? [] };
  }
}
