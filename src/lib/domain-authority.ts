// Real domain authority via DataForSEO (PRD §11-G / §7.7 P2).
//
// DataForSEO's Backlinks API exposes a real `domain_rank` (0–100) computed from
// its backlink index — a credible, externally-computed authority signal. It
// COMPLEMENTS (does not replace) the deterministic `source_quality` proxy.
//
// Honesty + cost rules:
//   * Lookups are cached per normalized domain in `domain_authority` and
//     refreshed incrementally (bounded batch) by the nightly enrichment cron —
//     never one live call per citation insert (DataForSEO bills per request).
//   * `authority_score` / `authority_source` on `citations` are NULL until a
//     feed value exists, so the deterministic proxy stays the honest default.
//   * `authority_source` is ALWAYS labeled (e.g. 'dataforseo_domain_rank') so
//     the UI never implies this is Google's own DA.
//   * Every call degrades gracefully when DATAFORSEO_LOGIN/PASSWORD are absent.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDomain } from "./citation-quality";

export const AUTHORITY_SOURCE = "dataforseo_domain_rank";

export function dataForSeoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

export type DomainRankResult = {
  authorityScore: number | null;
  referringDomains: number | null;
  backlinks: number | null;
};

// Pure: extract the authority signal from a DataForSEO Backlinks Summary
// response. Safe against partial/empty payloads.
export function parseDomainRankResult(json: any): DomainRankResult | null {
  const result = json?.tasks?.[0]?.result?.[0];
  if (!result) return null;
  return {
    authorityScore: typeof result.domain_rank === "number" ? result.domain_rank : null,
    referringDomains: typeof result.referring_domains === "number" ? result.referring_domains : null,
    backlinks: typeof result.backlinks === "number" ? result.backlinks : null,
  };
}

export async function fetchDomainRank(domain: string): Promise<DomainRankResult | null> {
  if (!dataForSeoConfigured()) return null;
  const target = normalizeDomain(domain);
  if (!target) return null;

  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");

  const res = await fetch(`https://api.dataforseo.com/v3/backlinks/summary/${encodeURIComponent(target)}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return parseDomainRankResult(json);
}

export async function upsertDomainAuthority(
  supabase: SupabaseClient,
  row: { domain: string; authorityScore: number | null; referringDomains: number | null; backlinks: number | null },
): Promise<void> {
  const domain = normalizeDomain(row.domain);
  if (!domain) return;
  await supabase.from("domain_authority").upsert(
    {
      domain,
      authority_score: row.authorityScore,
      referring_domains: row.referringDomains,
      backlinks: row.backlinks,
      source: AUTHORITY_SOURCE,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "domain" },
  );
}

// Read the cached authority for a domain (used at citation insert so new
// citations immediately carry a score if we've already looked the domain up).
export async function applyCachedAuthority(
  supabase: SupabaseClient,
  domain: string | null,
): Promise<{ authorityScore: number | null; authoritySource: string | null }> {
  const norm = normalizeDomain(domain);
  if (!norm) return { authorityScore: null, authoritySource: null };
  const { data } = await supabase
    .from("domain_authority")
    .select("authority_score, source")
    .eq("domain", norm)
    .maybeSingle();
  if (data?.authority_score != null) {
    return { authorityScore: data.authority_score, authoritySource: data.source ?? AUTHORITY_SOURCE };
  }
  return { authorityScore: null, authoritySource: null };
}

export type EnrichResult = { enriched: number; skipped: boolean };

// Find cited domains not yet cached (or stale), look each up, cache it, and
// backfill the authority columns on every citation for that domain. Bounded by
// `limit` so a single run stays within a sane DataForSEO credit budget.
export async function enrichDomains(
  supabase: SupabaseClient,
  opts?: { limit?: number; maxAgeDays?: number },
): Promise<EnrichResult> {
  const limit = opts?.limit ?? 50;
  const maxAgeDays = opts?.maxAgeDays ?? 30;

  if (!dataForSeoConfigured()) return { enriched: 0, skipped: true };

  const { data: cited } = await supabase
    .from("citations")
    .select("cited_domain")
    .not("cited_domain", "is", null);
  if (!cited || !cited.length) return { enriched: 0, skipped: false };

  const domains = Array.from(
    new Set((cited as { cited_domain: string | null }[]).map((c) => normalizeDomain(c.cited_domain)).filter(Boolean) as string[]),
  );

  const { data: cached } = await supabase.from("domain_authority").select("domain, fetched_at");
  const since = Date.now() - maxAgeDays * 86_400_000;
  const cachedMap = new Map<string, number>(
    (cached ?? []).map((r: { domain: string; fetched_at: string }) => [r.domain, new Date(r.fetched_at).getTime()]),
  );

  const toFetch = domains.filter((d) => {
    const t = cachedMap.get(d);
    return t === undefined || t < since;
  });

  let enriched = 0;
  for (const domain of toFetch.slice(0, limit)) {
    const result = await fetchDomainRank(domain);
    if (!result || result.authorityScore == null) continue;
    await upsertDomainAuthority(supabase, {
      domain,
      authorityScore: result.authorityScore,
      referringDomains: result.referringDomains,
      backlinks: result.backlinks,
    });
    // Backfill every citation that references this domain.
    await supabase
      .from("citations")
      .update({ authority_score: result.authorityScore, authority_source: AUTHORITY_SOURCE })
      .eq("cited_domain", domain);
    enriched += 1;
  }

  return { enriched, skipped: false };
}
