// ============================================================
// Centralized internal-LLM error model.
//
// Every failure from an InternalLLMProvider (src/lib/llm/*) is
// normalized into InternalLLMError so call sites get a consistent
// shape regardless of which provider (OpenAI, Claude, …) failed.
//
// Design rules honored by this module:
//  • It EXTENDS Error, so existing try/catch + `.message` fallbacks
//    keep working UNCHANGED (no behavior change for callers).
//  • Debugging information is preserved, never dropped: the original
//    cause, HTTP status, provider name, model, and a truncated
//    response body live on `debug` / typed fields.
//  • It is ONLY for AnsarAEO's internal reasoning backend — never
//    for the Answer Engines (visibility-engine.ts). See types.ts.
// ============================================================

export type InternalLLMErrorKind =
  | "ProviderError"
  | "AuthenticationError"
  | "RateLimitError"
  | "TimeoutError"
  | "InvalidRequestError"
  | "UnknownProviderError";

export interface InternalLLMErrorDebug {
  provider: string;
  model?: string;
  status?: number;
  requestId?: string;
  responseBody?: string;
  originalError?: string;
  [key: string]: unknown;
}

export class InternalLLMError extends Error {
  readonly kind: InternalLLMErrorKind;
  readonly provider: string;
  readonly status?: number;
  readonly debug: InternalLLMErrorDebug;

  constructor(opts: {
    kind: InternalLLMErrorKind;
    provider: string;
    message: string;
    status?: number;
    model?: string;
    debug?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = "InternalLLMError";
    this.kind = opts.kind;
    this.provider = opts.provider;
    this.status = opts.status;
    this.debug = {
      provider: opts.provider,
      model: opts.model,
      status: opts.status,
      ...opts.debug,
    };
  }

  toJSON() {
    return {
      name: this.name,
      kind: this.kind,
      provider: this.provider,
      message: this.message,
      status: this.status,
      debug: this.debug,
    };
  }
}

export function isInternalLLMError(err: unknown): err is InternalLLMError {
  return err instanceof InternalLLMError;
}

// Map an HTTP status (from a provider chat/completions call) to a
// normalized InternalLLMErrorKind.
export function kindFromStatus(status: number): InternalLLMErrorKind {
  if (status === 401 || status === 403) return "AuthenticationError";
  if (status === 408) return "TimeoutError";
  if (status === 429) return "RateLimitError";
  if (status === 400 || status === 422) return "InvalidRequestError";
  if (status >= 400 && status < 500) return "InvalidRequestError";
  if (status >= 500) return "ProviderError";
  return "UnknownProviderError";
}

// Normalize any thrown value from a provider call into InternalLLMError.
// If it's already an InternalLLMError, return it unchanged (idempotent).
//
// Preserves all debugging information: the original error is stringified
// into debug.originalError, and any known status / response body passed
// via `ctx` is carried through.
export function normalizeProviderError(
  provider: string,
  err: unknown,
  ctx: { model?: string; status?: number; responseBody?: string } = {},
): InternalLLMError {
  if (err instanceof InternalLLMError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const originalError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);

  // Network / abort → timeout class. fetch throws TypeError on connection
  // failure; AbortError on a client-side timeout. Both are surfaced as
  // TimeoutError so callers can treat them uniformly, with the original
  // error preserved for debugging.
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return new InternalLLMError({
        kind: "TimeoutError",
        provider,
        message: `${provider} request timed out: ${message}`,
        model: ctx.model,
        debug: { originalError, ...ctx },
      });
    }
    if (/network|econn|timeout|fetch failed|econnreset|etimedout|aborted/i.test(message)) {
      return new InternalLLMError({
        kind: "TimeoutError",
        provider,
        message: `${provider} network error: ${message}`,
        model: ctx.model,
        debug: { originalError, ...ctx },
      });
    }
  }

  // If we already know the status (e.g. parsed before normalization),
  // classify from it.
  if (ctx.status != null) {
    return new InternalLLMError({
      kind: kindFromStatus(ctx.status),
      provider,
      message: `${provider} error (${ctx.status}): ${message}`,
      status: ctx.status,
      model: ctx.model,
      debug: { originalError, ...ctx },
    });
  }

  return new InternalLLMError({
    kind: "UnknownProviderError",
    provider,
    message: `${provider} unknown error: ${message}`,
    model: ctx.model,
    debug: { originalError, ...ctx },
  });
}
