import { describe, it, expect } from "vitest";
import { validateLlmsTxt } from "./llms-txt-validator";

const VALID_LLMS_TXT = [
  "# AnsarAEO",
  "> AnsarAEO is an AI Search / Answer Engine Optimization platform for brands.",
  "",
  "## Docs",
  "- [Getting started](https://ansaraeo.com/docs)",
  "- [Pricing](https://ansaraeo.com/pricing)",
].join("\n");

const INVALID_LLMS_TXT = [
  "This file has no H1 heading at all, just stray prose.",
  "And more prose that violates the llms.txt spec by lacking structure.",
].join("\n");

describe("validateLlmsTxt (text mode)", () => {
  it("passes a spec-compliant llms.txt", async () => {
    const result = await validateLlmsTxt({ text: VALID_LLMS_TXT });
    expect(result.source.mode).toBe("text");
    expect(result.h1).toBe("AnsarAEO");
    expect(result.linkCount).toBeGreaterThanOrEqual(2);
    expect(result.status).not.toBe("fail");
    expect(typeof result.score).toBe("number");
  });

  it("flags a llms.txt with no H1 / no structure", async () => {
    const result = await validateLlmsTxt({ text: INVALID_LLMS_TXT });
    expect(result.h1).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.status === "fail")).toBe(true);
  });
});
