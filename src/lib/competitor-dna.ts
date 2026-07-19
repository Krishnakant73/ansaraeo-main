import type { SupabaseClient } from "@supabase/supabase-js";
import type { DnaAxis, DnaScores } from "@/app/dashboard/w/competitor/features/CompetitorDna";

// ============================================================
// competitor-dna — deterministic six-axis DNA score derivation.
//
// All axes reduce recorded data (visibility_runs, citations,
// engines, run_at) to a 0..100 signal. Nothing is invented; when
// signal is unavailable the axis defaults to 0 and the caption
// says "no signal" upstream.
// ============================================================

const AXES: DnaAxis[] = [
  "citation",
  "velocity",
  "reviews",
  "community",
  "schema",
  "freshness",
];

const EMPTY: DnaScores = AXES.reduce((acc, a) => {
  acc[a] = 0;
  return acc;
}, {} as DnaScores);

type Row = {
  id: string;
  run_at: string;
  engine_id: string | null;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

type CitationRow = {
  run_id: string;
  cited_url: string | null;
  cited_domain: string | null;
  is_own_domain: boolean | null;
  is_trusted_source: boolean | null;
  first_seen_at: string | null;
};

export async function computeCompetitorDna(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  competitor: { id: string; brand_id: string; name: string; domain: string | null },
): Promise<{ them: DnaScores; you: DnaScores }> {
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
  if (promptIds.length === 0) return { them: { ...EMPTY }, you: { ...EMPTY } };

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, run_at, engine_id, brand_mentioned, competitor_mentions")
    .in("prompt_id", promptIds)
    .order("run_at", { ascending: false })
    .limit(1000);
  const rows = (runs as Row[] | null) ?? [];
  if (rows.length === 0) return { them: { ...EMPTY }, you: { ...EMPTY } };

  const runIds = rows.map((r) => r.id);
  const { data: cits } = await supabase
    .from("citations")
    .select("run_id, cited_url, cited_domain, is_own_domain, is_trusted_source, first_seen_at")
    .in("run_id", runIds);
  const citRows = (cits as CitationRow[] | null) ?? [];

  const nameLower = competitor.name.toLowerCase();
  const domainLower = (competitor.domain ?? "").toLowerCase();

  const compRuns = rows.filter((r) =>
    (r.competitor_mentions ?? []).some((m) => m.mentioned && m.name.toLowerCase() === nameLower),
  );
  const yourRuns = rows.filter((r) => r.brand_mentioned === true);

  const them: DnaScores = { ...EMPTY };
  const you: DnaScores = { ...EMPTY };

  // Citation gravity — share of runs where own-domain citation appears.
  if (domainLower) {
    const themCitedRuns = new Set(
      citRows
        .filter((c) => (c.cited_domain ?? "").toLowerCase().includes(domainLower))
        .map((c) => c.run_id),
    );
    them.citation = compRuns.length > 0
      ? Math.round((compRuns.filter((r) => themCitedRuns.has(r.id)).length / compRuns.length) * 100)
      : 0;
  }
  const yourOwnCiteRuns = new Set(citRows.filter((c) => c.is_own_domain).map((c) => c.run_id));
  you.citation = yourRuns.length > 0
    ? Math.round((yourRuns.filter((r) => yourOwnCiteRuns.has(r.id)).length / yourRuns.length) * 100)
    : 0;

  // Content velocity — distinct competitor URLs seen in the last 30d
  // divided by 30, scaled so 5 pages/week ≈ 100.
  const now = Date.now();
  const monthAgo = now - 30 * 86_400_000;
  if (domainLower) {
    const themUrls = new Set<string>();
    for (const c of citRows) {
      if (!c.cited_url) continue;
      if (!(c.cited_domain ?? "").toLowerCase().includes(domainLower)) continue;
      const firstSeen = c.first_seen_at ? new Date(c.first_seen_at).getTime() : 0;
      if (firstSeen < monthAgo) continue;
      themUrls.add(c.cited_url);
    }
    them.velocity = Math.round(Math.min(100, (themUrls.size / 20) * 100));
  }
  const yourUrls = new Set<string>();
  for (const c of citRows) {
    if (!c.is_own_domain || !c.cited_url) continue;
    const firstSeen = c.first_seen_at ? new Date(c.first_seen_at).getTime() : 0;
    if (firstSeen < monthAgo) continue;
    yourUrls.add(c.cited_url);
  }
  you.velocity = Math.round(Math.min(100, (yourUrls.size / 20) * 100));

  // Review presence — inferred from citation URLs containing /review or
  // known review-site host fragments.
  const reviewHosts = ["g2.com", "capterra", "trustpilot", "reddit.com", "producthunt"];
  const isReviewCite = (c: CitationRow) => {
    const url = (c.cited_url ?? "").toLowerCase();
    if (!url) return false;
    if (url.includes("/review") || url.includes("/reviews/")) return true;
    return reviewHosts.some((h) => url.includes(h));
  };
  if (domainLower) {
    const themReviewRuns = new Set<string>();
    for (const c of citRows) {
      if (isReviewCite(c)) themReviewRuns.add(c.run_id);
    }
    // How many of the competitor's runs have any review-flavour citation.
    them.reviews = compRuns.length > 0
      ? Math.round((compRuns.filter((r) => themReviewRuns.has(r.id)).length / compRuns.length) * 100)
      : 0;
    // Yours: same math on your runs.
    you.reviews = yourRuns.length > 0
      ? Math.round((yourRuns.filter((r) => themReviewRuns.has(r.id)).length / yourRuns.length) * 100)
      : 0;
  }

  // Community footprint — position dominance proxy: how often they land in
  // the top-3 slots when mentioned.
  const positionsThem = compRuns
    .map((r) =>
      (r.competitor_mentions ?? []).find(
        (m) => m.mentioned && m.name.toLowerCase() === nameLower,
      )?.position,
    )
    .filter((p): p is number => typeof p === "number" && p > 0);
  const positionsYou = yourRuns
    .map((r) => (r as Row & { brand_position?: number | null }).brand_position ?? null)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const topShare = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.filter((p) => p <= 3).length / arr.length) * 100) : 0;
  them.community = topShare(positionsThem);
  you.community = topShare(positionsYou);

  // Schema fitness — proxy: share of trusted-source citations on runs
  // referencing them. A brand with schema tends to get syndicated → trusted
  // hosts cite them.
  if (domainLower) {
    const themTrusted = new Set<string>(
      citRows
        .filter(
          (c) =>
            c.is_trusted_source &&
            (c.cited_domain ?? "").toLowerCase().includes(domainLower),
        )
        .map((c) => c.run_id),
    );
    them.schema = compRuns.length > 0
      ? Math.round((compRuns.filter((r) => themTrusted.has(r.id)).length / compRuns.length) * 100)
      : 0;
    const youTrusted = new Set(
      citRows.filter((c) => c.is_own_domain && c.is_trusted_source).map((c) => c.run_id),
    );
    you.schema = yourRuns.length > 0
      ? Math.round((yourRuns.filter((r) => youTrusted.has(r.id)).length / yourRuns.length) * 100)
      : 0;
  }

  // Freshness cadence — how recently we've seen them at all.
  const freshnessScore = (mostRecent: string | null): number => {
    if (!mostRecent) return 0;
    const dt = Date.now() - new Date(mostRecent).getTime();
    // Full points if within 24h; scaled down to 0 by day 30.
    const dayDelta = dt / 86_400_000;
    return Math.round(Math.max(0, Math.min(100, ((30 - dayDelta) / 30) * 100)));
  };
  them.freshness = freshnessScore(compRuns[0]?.run_at ?? null);
  you.freshness = freshnessScore(yourRuns[0]?.run_at ?? null);

  return { them, you };
}
