import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a plain name", () => {
    expect(slugify("Acme Corp")).toBe("acme-corp");
  });

  it("collapses runs of non-alphanumerics", () => {
    expect(slugify("Acme & Co, Inc.!")).toBe("acme-co-inc");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  --Acme--  ")).toBe("acme");
  });

  it("preserves internal digits", () => {
    expect(slugify("Brand 2 Go")).toBe("brand-2-go");
  });

  it("lowercases uppercase", () => {
    expect(slugify("MSCHF")).toBe("mschf");
  });

  it("returns 'brand' for empty input", () => {
    expect(slugify("")).toBe("brand");
  });

  it("returns 'brand' for whitespace-only input", () => {
    expect(slugify("   ")).toBe("brand");
  });

  it("returns 'brand' for pure-symbols input", () => {
    expect(slugify("!@#$%")).toBe("brand");
  });

  it("handles unicode by stripping to ASCII alphanumerics", () => {
    // Deliberate design choice — matches the SQL regex_replace, which
    // treats non-ascii as separators. If we ever want to preserve unicode
    // in URLs, update both places together.
    expect(slugify("Café Bhāratīya")).toBe("caf-bh-rat-ya");
  });

  it("handles null-ish input safely", () => {
    // slugify(input) uses `input ?? ""` so undefined shouldn't throw.
    // Cast to any because the signature is (string) but we test defensive behavior.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(slugify(undefined as unknown as string)).toBe("brand");
  });
});
