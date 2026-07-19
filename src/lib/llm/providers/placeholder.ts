import type { ChatInput, InternalLLMProvider } from "../types";

// Placeholder for providers we intend to support but have not implemented.
// They sit behind the same interface so the wiring (registry + env config)
// is ready; the methods throw a clear, actionable error until implemented.
//
// NOTE: a placeholder supports the full interface (generate + chat) — it
// simply rejects on use. See src/lib/llm/README.md for the separation
// between these INTERNAL provider candidates and the Answer Engines.
export function createPlaceholderProvider(name: string): InternalLLMProvider {
  const notImplemented = (): never => {
    throw new Error(
      `Internal LLM provider "${name}" is not implemented yet. Set INTERNAL_LLM_PROVIDER=openai.`
    );
  };
  return {
    name,
    // async wrappers so callers awaiting these get a rejecting Promise
    // (not a synchronous throw), matching the Promise-returning interface.
    generate: async () => notImplemented(),
    chat: async (_input: ChatInput) => notImplemented(),
    summarize: async () => notImplemented(),
    classify: async () => notImplemented(),
    extractEntities: async () => notImplemented(),
    planMission: async () => notImplemented(),
  };
}
