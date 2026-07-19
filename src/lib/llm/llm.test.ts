import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Core behavior tests import the provider classes / registry directly so they
// don't depend on the module-level INTERNAL_LLM_PROVIDER cache. The env-switch
// tests use resetModules + dynamic import to re-read env per case.

function mockOpenAIChat(content: string) {
  const lastCall: { url?: string; opts?: any } = {};
  const fn = vi.fn(async (url: string, opts: any) => {
    lastCall.url = url;
    lastCall.opts = opts;
    return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
  });
  vi.stubGlobal("fetch", fn);
  return { fn, lastCall };
}

describe("OpenAIProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("generate returns raw text and sends json mode + system message when requested", async () => {
    const { lastCall } = mockOpenAIChat('{"title":"T","contentMarkdown":"M"}');
    const { OpenAIProvider } = await import("./openai-provider");
    const out = await new OpenAIProvider({ apiKey: "sk-test" }).generate({
      system: "sys",
      prompt: "hi",
      json: true,
    });
    expect(out).toBe('{"title":"T","contentMarkdown":"M"}');
    const body = JSON.parse(lastCall.opts.body as string);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
  });

  it("throws when OPENAI_API_KEY is absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { OpenAIProvider } = await import("./openai-provider");
    await expect(new OpenAIProvider().generate({ prompt: "x" })).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("classify parses JSON and normalizes confidence", async () => {
    mockOpenAIChat('{"label":"positive","confidence":0.9}');
    const { OpenAIProvider } = await import("./openai-provider");
    const r = await new OpenAIProvider({ apiKey: "k" }).classify({ text: "great" });
    expect(r).toEqual({ label: "positive", confidence: 0.9 });
  });

  it("summarize / extractEntities / planMission return expected shapes", async () => {
    const { OpenAIProvider } = await import("./openai-provider");

    mockOpenAIChat("A short summary.");
    expect(await new OpenAIProvider({ apiKey: "k" }).summarize({ text: "long", maxLength: 50 })).toBe(
      "A short summary."
    );

    mockOpenAIChat('{"entities":[{"type":"brand","value":"Acme"}]}');
    expect(await new OpenAIProvider({ apiKey: "k" }).extractEntities({ text: "Acme" })).toEqual([
      { type: "brand", value: "Acme" },
    ]);

    mockOpenAIChat('{"goal":"g","steps":["a","b"]}');
    expect(await new OpenAIProvider({ apiKey: "k" }).planMission({ goal: "g" })).toEqual({
      goal: "g",
      steps: ["a", "b"],
    });
  });

  it("generate supports an OPTIONAL prompt (system-only request when omitted)", async () => {
    const { lastCall } = mockOpenAIChat("ok");
    const { OpenAIProvider } = await import("./openai-provider");
    await new OpenAIProvider({ apiKey: "k" }).generate({ system: "only-sys" });
    const body = JSON.parse(lastCall.opts.body as string);
    expect(body.messages).toEqual([{ role: "system", content: "only-sys" }]);
  });

  it("chat sends the message list verbatim (multi-turn) and reuses the request path", async () => {
    const { lastCall } = mockOpenAIChat("hi there");
    const { OpenAIProvider } = await import("./openai-provider");
    const out = await new OpenAIProvider({ apiKey: "sk-test" }).chat({
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "u1" },
        { role: "assistant", content: "a1" },
        { role: "user", content: "u2" },
      ],
    });
    expect(out).toBe("hi there");
    const body = JSON.parse(lastCall.opts.body as string);
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
  });
});

describe("placeholder providers", () => {
  it("claude/gemini/grok/local throw not-implemented on every method", async () => {
    const { createPlaceholderProvider } = await import("./providers/placeholder");
    for (const name of ["claude", "gemini", "grok", "local"]) {
      const p = createPlaceholderProvider(name);
      await expect(p.generate({ prompt: "x" })).rejects.toThrow(/not implemented/);
      await expect(p.summarize({ text: "x" })).rejects.toThrow(/not implemented/);
      await expect(p.classify({ text: "x" })).rejects.toThrow(/not implemented/);
      await expect(p.extractEntities({ text: "x" })).rejects.toThrow(/not implemented/);
      await expect(p.planMission({ goal: "x" })).rejects.toThrow(/not implemented/);
    }
  });
});

describe("registry + getInternalLLM (env-driven provider selection)", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("listProviders marks openai implemented and the rest as placeholders", async () => {
    const { listProviders } = await import("./registry");
    const list = listProviders();
    expect(list.find((p) => p.name === "openai")?.implemented).toBe(true);
    expect(list.find((p) => p.name === "claude")?.implemented).toBe(false);
    expect(list.find((p) => p.name === "local")?.implemented).toBe(false);
  });

  it("defaults to openai and is functional", async () => {
    vi.stubEnv("INTERNAL_LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    mockOpenAIChat("ok");
    const mod = await import("./index");
    const p = mod.getInternalLLM();
    expect(p.name).toBe("openai");
    expect(await p.generate({ prompt: "x" })).toBe("ok");
  });

  it("selecting an unimplemented provider returns it but throws on use — no code change needed to switch back", async () => {
    vi.stubEnv("INTERNAL_LLM_PROVIDER", "claude");
    const mod = await import("./index");
    const p = mod.getInternalLLM();
    expect(p.name).toBe("claude");
    await expect(p.generate({ prompt: "x" })).rejects.toThrow(/not implemented/);
  });

  it("unknown provider name throws at selection time", async () => {
    vi.stubEnv("INTERNAL_LLM_PROVIDER", "watson");
    const mod = await import("./index");
    expect(() => mod.getInternalLLM()).toThrow(/Unknown/);
  });
});
