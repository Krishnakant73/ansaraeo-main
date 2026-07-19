import { describe, it, expect } from "vitest";
import { validateJsonLd } from "./schema-for-ai";

describe("validateJsonLd", () => {
  it("accepts a well-formed Organization JSON-LD", () => {
    const input = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme",
      url: "https://acme.com",
    });
    const result = validateJsonLd(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.type).toBe("Organization");
  });

  it("rejects malformed JSON", () => {
    const result = validateJsonLd("{not valid json");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid JSON"))).toBe(true);
  });

  it("flags a missing @type", () => {
    const input = JSON.stringify({ "@context": "https://schema.org", name: "Acme" });
    const result = validateJsonLd(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing @type"))).toBe(true);
  });

  it("flags a missing @context", () => {
    const input = JSON.stringify({ "@type": "Organization", name: "Acme", url: "https://acme.com" });
    const result = validateJsonLd(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Missing @context"))).toBe(true);
  });

  it("handles a @graph wrapper", () => {
    const input = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "Organization", name: "Acme", url: "https://acme.com" }],
    });
    const result = validateJsonLd(input);
    expect(result.valid).toBe(true);
    expect(result.type).toBe("Organization");
  });
});
