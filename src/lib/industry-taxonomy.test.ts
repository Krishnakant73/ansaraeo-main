import { describe, it, expect } from "vitest";
import {
  normalizeIndustry,
  industryLabel,
  countryToRegion,
  regionLabel,
  coerceEnum,
  COMPANY_SIZES,
  TRAFFIC_BANDS,
} from "./industry-taxonomy";

describe("normalizeIndustry", () => {
  it("collapses known aliases to canonical keys", () => {
    expect(normalizeIndustry("SaaS")).toBe("saas");
    expect(normalizeIndustry("software as a service")).toBe("saas");
    expect(normalizeIndustry("FinTech")).toBe("fintech");
    expect(normalizeIndustry("E-Commerce")).toBe("ecommerce");
    expect(normalizeIndustry("EdTech")).toBe("education");
    expect(normalizeIndustry("  Health  ")).toBe("healthcare");
  });

  it("falls back to 'other' for unknown or empty input", () => {
    expect(normalizeIndustry("")).toBe("other");
    expect(normalizeIndustry(null)).toBe("other");
    expect(normalizeIndustry(undefined)).toBe("other");
    expect(normalizeIndustry("Quantum Cat Grooming")).toBe("other");
  });

  it("labels map back to human text", () => {
    expect(industryLabel("fintech")).toBe("Fintech / Finance");
    expect(industryLabel("nope")).toBe("Other");
    expect(industryLabel(null)).toBe("Other");
  });
});

describe("countryToRegion", () => {
  it("maps known countries to regions", () => {
    expect(countryToRegion("IN")).toBe("south_asia");
    expect(countryToRegion("india")).toBe("south_asia");
    expect(countryToRegion("us")).toBe("north_america");
    expect(countryToRegion("GB")).toBe("europe");
    expect(countryToRegion("AE")).toBe("middle_east");
    expect(countryToRegion("SG")).toBe("southeast_asia");
  });

  it("falls back to 'global' for unknown/empty", () => {
    expect(countryToRegion("")).toBe("global");
    expect(countryToRegion(null)).toBe("global");
    expect(countryToRegion("XX")).toBe("global");
  });

  it("region labels", () => {
    expect(regionLabel("south_asia")).toBe("South Asia");
    expect(regionLabel(null)).toBe("Global");
  });
});

describe("coerceEnum", () => {
  it("validates against allowed set, null-safe", () => {
    expect(coerceEnum(COMPANY_SIZES, "Enterprise")).toBe("enterprise");
    expect(coerceEnum(TRAFFIC_BANDS, "nonsense")).toBeNull();
    expect(coerceEnum(COMPANY_SIZES, null)).toBeNull();
    expect(coerceEnum(COMPANY_SIZES, "")).toBeNull();
  });
});
