import { describe, it, expect } from "vitest";
import { computeSourceQuality, computeCoCitation, normalizeDomain } from "./citation-quality";

describe("citation source-quality (honest proxy)", () => {
  it("flags known trusted authorities", () => {
    const r = computeSourceQuality("https://en.wikipedia.org/wiki/Example");
    expect(r.is_trusted_source).toBe(true);
    expect(r.score).toBeGreaterThan(50);
  });

  it("flags gov / edu TLDs as trusted", () => {
    expect(computeSourceQuality("https://www.example.gov.in").is_trusted_source).toBe(true);
    expect(computeSourceQuality("https://example.edu").is_trusted_source).toBe(true);
  });

  it("treats an unknown third-party domain as neutral baseline", () => {
    const r = computeSourceQuality("https://some-random-blog.com");
    expect(r.is_trusted_source).toBe(false);
    expect(r.score).toBe(50);
  });

  it("bonuses the brand's own domain", () => {
    const r = computeSourceQuality("https://mybrand.com/pricing", { isOwnDomain: true });
    expect(r.score).toBe(60);
  });

  it("penalizes a competitor domain", () => {
    const r = computeSourceQuality("https://rival.com", { isCompetitorDomain: true });
    expect(r.score).toBe(35);
  });

  it("stays within 0-100", () => {
    const r = computeSourceQuality("https://rival.gov.in", { isCompetitorDomain: true });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("normalizes domains (strips protocol, www, path)", () => {
    expect(normalizeDomain("https://www.Example.com/path?x=1")).toBe("example.com");
    expect(normalizeDomain("")).toBeNull();
  });

  it("computes co-citation with trusted sources", () => {
    const rows = [
      { runId: "r1", domain: "mybrand.com", isOwnDomain: true, isTrustedSource: false },
      { runId: "r1", domain: "wikipedia.org", isOwnDomain: false, isTrustedSource: true },
      { runId: "r2", domain: "mybrand.com", isOwnDomain: true, isTrustedSource: false },
    ];
    const co = computeCoCitation(rows);
    expect(co.ownCitationCount).toBe(2);
    expect(co.ownRunsWithTrustedCoCitation).toBe(1);
    expect(co.ownToTrusted["mybrand.com"]).toEqual(["wikipedia.org"]);
  });
});
