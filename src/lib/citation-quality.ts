// Citation source-quality scoring — a DETERMINISTIC, honest heuristic.
//
// This is NOT true domain authority (we have no Moz/Ahrefs/SimilarWeb feed, and
// fabricating one would violate the product's honesty design). It is a
// transparent proxy built only from signals we actually have at citation time:
// the domain's TLD, a curated list of sources AI engines reliably cite, and
// whether the citation is to the brand's own domain or a competitor's. Every
// consumer must label this as a "source-quality proxy", never as measured DA.

export type SourceQuality = {
  score: number; // 0–100, higher = more authoritative source
  is_trusted_source: boolean;
};

// Domains AI answer engines frequently treat as authoritative. Curated, not
// exhaustive — extend as needed. Indian + global mix reflecting the product's
// India-first market.
const TRUSTED_DOMAINS = new Set<string>([
  "wikipedia.org",
  "who.int",
  "un.org",
  "statista.com",
  "reuters.com",
  "bloomberg.com",
  "nytimes.com",
  "forbes.com",
  "techcrunch.com",
  "theverge.com",
  "wired.com",
  "ndtv.com",
  "thehindu.com",
  "economictimes.indiatimes.com",
  "livemint.com",
  "moneycontrol.com",
  "business-standard.com",
  "inc42.com",
  "yourstory.com",
  "entrackr.com",
  "gadgets360.com",
  "gsmarena.com",
  "smartprix.com",
  "amazon.in",
  "flipkart.com",
  "youtube.com",
  "medium.com",
  "linkedin.com",
  "github.com",
  "researchgate.net",
  "ieee.org",
]);

const TRUSTED_TLDS: string[] = [".gov", ".edu", ".ac.in", ".gov.in", ".edu.in", ".org"];

// Normalize "https://www.Example.com/path" -> "example.com".
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  return d || null;
}

function registrableDomain(domain: string): string {
  // Crude eTLD+1: take the last two labels, except known multi-part suffixes.
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  const lastTwo = parts.slice(-2).join(".");
  const lastThree = parts.slice(-3).join(".");
  if (TRUSTED_DOMAINS.has(lastTwo)) return lastTwo;
  // Keep subdomain context for known authorities (e.g. economictimes.indiatimes.com).
  if (TRUSTED_DOMAINS.has(lastThree)) return lastThree;
  return lastTwo;
}

export function computeSourceQuality(
  domain: string | null | undefined,
  ctx?: { isOwnDomain?: boolean; isCompetitorDomain?: boolean },
): SourceQuality {
  const norm = normalizeDomain(domain);
  if (!norm) return { score: 0, is_trusted_source: false };

  const parts = norm.split(".");
  const reg = registrableDomain(norm);
  const lastThree = parts.slice(-3).join(".");
  // Trusted if it's a known authority domain OR ends with a trusted TLD
  // (handles multi-part TLDs like .gov.in / .edu.in that a single-label
  // TLD check would miss).
  const isTrusted =
    TRUSTED_DOMAINS.has(reg) ||
    TRUSTED_DOMAINS.has(lastThree) ||
    TRUSTED_TLDS.some((tld) => norm.endsWith(tld));
  const isOwn = ctx?.isOwnDomain ?? false;
  const isCompetitor = ctx?.isCompetitorDomain ?? false;

  let score = 50; // neutral third-party baseline
  if (isTrusted) score += 35;
  if (isOwn) score += 10; // a confirmed asset for the brand
  if (isCompetitor) score -= 15; // not the brand's asset; competitive overlap signal
  score = Math.max(0, Math.min(100, score));

  return { score: Math.round(score), is_trusted_source: isTrusted };
}

export type CoCitationInput = {
  runId: string;
  domain: string;
  isOwnDomain: boolean;
  isTrustedSource: boolean;
};

export type CoCitationResult = {
  // own-domain domain -> set of trusted domains that co-appeared in a run
  ownToTrusted: Record<string, string[]>;
  // how many runs an own-domain citation co-appeared with >=1 trusted source
  ownRunsWithTrustedCoCitation: number;
  // total own-domain citations observed
  ownCitationCount: number;
};

// Source-network signal: does the brand's own domain appear alongside trusted
// sources within the same answer? Co-citation with authoritative sources is a
// known proxy for "the engine treats this brand as part of a trusted cluster".
export function computeCoCitation(rows: CoCitationInput[]): CoCitationResult {
  const byRun = new Map<string, CoCitationInput[]>();
  for (const r of rows) {
    if (!byRun.has(r.runId)) byRun.set(r.runId, []);
    byRun.get(r.runId)!.push(r);
  }

  const ownToTrusted: Record<string, Set<string>> = {};
  let ownRunsWithTrustedCoCitation = 0;
  let ownCitationCount = 0;

  for (const runRows of byRun.values()) {
    const trusted = runRows.filter((r) => r.isTrustedSource && !r.isOwnDomain).map((r) => r.domain);
    const own = runRows.filter((r) => r.isOwnDomain);
    if (own.length && trusted.length) ownRunsWithTrustedCoCitation += 1;
    for (const o of own) {
      ownCitationCount += 1;
      const key = normalizeDomain(o.domain) || o.domain;
      if (!ownToTrusted[key]) ownToTrusted[key] = new Set();
      for (const t of trusted) ownToTrusted[key].add(t);
    }
  }

  const serialized: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(ownToTrusted)) serialized[k] = Array.from(v).sort();

  return {
    ownToTrusted: serialized,
    ownRunsWithTrustedCoCitation,
    ownCitationCount,
  };
}
