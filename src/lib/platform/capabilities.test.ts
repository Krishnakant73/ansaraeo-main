import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockSupabase } from "./__fixtures__/mockSupabase";
import { engineAvailability, getCapabilities } from "./capabilities";

describe("capabilities", () => {
  let mock = createMockSupabase();

  beforeEach(() => {
    mock = createMockSupabase();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("engineAvailability reports unavailable when required env missing", () => {
    vi.stubEnv("GROK_API_KEY", undefined);
    expect(engineAvailability("grok")).toEqual({
      available: false,
      reason: "GROK_API_KEY not set",
    });
  });

  it("engineAvailability reports available when required env present", () => {
    vi.stubEnv("GROK_API_KEY", "x");
    expect(engineAvailability("grok").available).toBe(true);
  });

  it("copilot requires both URL and key", () => {
    vi.stubEnv("COPILOT_API_URL", "https://x");
    vi.stubEnv("COPILOT_API_KEY", undefined);
    expect(engineAvailability("copilot").available).toBe(false);
    vi.stubEnv("COPILOT_API_KEY", "y");
    expect(engineAvailability("copilot").available).toBe(true);
  });

  it("getCapabilities lists active engines with live availability", async () => {
    await mock.client.from("engines").insert([
      { name: "chatgpt", is_active: true },
      { name: "grok", is_active: true },
    ]);
    vi.stubEnv("OPENAI_API_KEY", "x"); // chatgpt available
    vi.stubEnv("GROK_API_KEY", undefined); // grok not
    const caps = await getCapabilities(mock.client);
    const chatgpt = caps.engines.find((e) => e.name === "chatgpt")!;
    const grok = caps.engines.find((e) => e.name === "grok")!;
    expect(chatgpt.available).toBe(true);
    expect(grok.available).toBe(false);
    expect(caps.regions).toContain("ap-south-1");
  });
});
