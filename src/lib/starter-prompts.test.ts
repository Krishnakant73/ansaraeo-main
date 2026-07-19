import { describe, it, expect } from "vitest";
import { generateStarterPrompts } from "./starter-prompts";

describe("generateStarterPrompts", () => {
  it("generates EN templates tagged 'en' and substitutes fields", async () => {
    const r = await generateStarterPrompts({
      industry: "d2c_fashion",
      category: "sneakers",
      competitor: "Nike",
      city: "Mumbai",
      languages: ["en"],
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.language === "en")).toBe(true);
    expect(r[0].text).toContain("sneakers");
    // at least one template uses {competitor}
    expect(r.some((p) => p.text.includes("Nike"))).toBe(true);
  });

  it("returns HI templates tagged 'hi' when requested", async () => {
    const r = await generateStarterPrompts({
      industry: "d2c_beauty",
      category: "serum",
      languages: ["hi"],
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.language === "hi")).toBe(true);
  });

  it("handles any language set without throwing (non-template langs need no key to be safe)", async () => {
    const r = await generateStarterPrompts({
      industry: "saas",
      category: "crm",
      languages: ["en", "hi", "ta", "bn", "ml", "ur"],
    });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((p) => p.language === "en")).toBe(true);
    expect(r.every((p) => typeof p.text === "string" && p.text.length > 0)).toBe(true);
  });
});
