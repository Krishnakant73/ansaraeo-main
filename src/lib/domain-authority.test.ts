import { describe, it, expect } from "vitest";
import { parseDomainRankResult } from "./domain-authority";

describe("parseDomainRankResult", () => {
  it("extracts domain_rank + backlink signals from a DataForSEO summary", () => {
    const json = {
      tasks: [
        {
          result: [
            { domain_rank: 742, referring_domains: 1200, backlinks: 45000 },
          ],
        },
      ],
    };
    const r = parseDomainRankResult(json);
    expect(r).not.toBeNull();
    expect(r!.authorityScore).toBe(742);
    expect(r!.referringDomains).toBe(1200);
    expect(r!.backlinks).toBe(45000);
  });

  it("returns null when there is no result", () => {
    expect(parseDomainRankResult({ tasks: [{ result: [] }] })).toBeNull();
    expect(parseDomainRankResult({ tasks: [] })).toBeNull();
    expect(parseDomainRankResult({})).toBeNull();
    expect(parseDomainRankResult(null)).toBeNull();
  });

  it("tolerates missing numeric fields (nulls, not crashes)", () => {
    const r = parseDomainRankResult({ tasks: [{ result: [{ domain_rank: 55 }] }] });
    expect(r!.authorityScore).toBe(55);
    expect(r!.referringDomains).toBeNull();
    expect(r!.backlinks).toBeNull();
  });

  it("ignores non-numeric domain_rank", () => {
    const r = parseDomainRankResult({ tasks: [{ result: [{ domain_rank: "high" }] }] });
    expect(r!.authorityScore).toBeNull();
  });
});
