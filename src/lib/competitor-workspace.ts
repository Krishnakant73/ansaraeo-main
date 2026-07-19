// ============================================================
// Competitor workspace loader + shape.
//
// getCompetitorById(id) — cookie-scoped resolver used by the
// /dashboard/w/competitor/[id]/** descriptor. Same contract as the
// Brand and Prompt loaders: cookie client, RLS filters unauthorized
// reads, null → 404. Never uses the service client (would leak
// competitor existence across orgs).
//
// The returned object embeds the parent brand + lightweight stats
// so the header + KPI card don't re-query.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type CompetitorStats = {
  runCount: number;                 // runs touching this competitor's brand
  mentionCount: number;             // runs where this competitor was mentioned
  shareOfVoice7d: number | null;    // percent, 0..100, null if zero runs 7d
  vsYouGap7d: number | null;        // competitor% − brand% last 7d (pp)
  lastMentionAt: string | null;
};

export type CompetitorBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
};

export type Competitor = {
  id: string;
  brand_id: string;
  name: string;
  domain: string | null;
  source: string;
  confirmed: boolean;
  brand: CompetitorBrand;
  stats: CompetitorStats;
};

const BRAND_COLUMNS = "id, name, slug, domain, industry";

export async function getCompetitorById(id: string): Promise<Competitor | null> {
  const supabase = await createClient();
  const { data: comp } = await supabase
    .from("competitors")
    .select("id, brand_id, name, domain, source, confirmed")
    .eq("id", id)
    .maybeSingle();
  if (!comp) return null;

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", (comp as { brand_id: string }).brand_id)
    .maybeSingle();
  if (!brand) return null;

  const stats = await loadCompetitorStats(
    (comp as { brand_id: string; name: string }).brand_id,
    (comp as { name: string }).name,
    supabase,
  );

  return {
    ...(comp as Omit<Competitor, "brand" | "stats">),
    brand: brand as CompetitorBrand,
    stats,
  };
}

type MentionRow = {
  run_at: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCompetitorStats(brandId: string, name: string, supabase: any): Promise<CompetitorStats> {
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", brandId)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
  if (promptIds.length === 0) {
    return {
      runCount: 0,
      mentionCount: 0,
      shareOfVoice7d: null,
      vsYouGap7d: null,
      lastMentionAt: null,
    };
  }

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("run_at, brand_mentioned, competitor_mentions")
    .in("prompt_id", promptIds)
    .order("run_at", { ascending: false })
    .limit(1000);
  const rows = (runs as MentionRow[] | null) ?? [];

  const now = Date.now();
  const week = 7 * 86_400_000;
  const cur7 = rows.filter((r) => now - new Date(r.run_at).getTime() < week);
  const nonSkipped7 = cur7.filter((r) => r.brand_mentioned !== null);
  const brandMentioned7 = nonSkipped7.filter((r) => r.brand_mentioned === true).length;

  const nameLower = name.toLowerCase();
  const isMentioned = (r: MentionRow) =>
    (r.competitor_mentions ?? []).some(
      (m) => m.mentioned && m.name.toLowerCase() === nameLower,
    );
  const compMentioned7 = nonSkipped7.filter(isMentioned).length;

  const brandRate7 = nonSkipped7.length > 0 ? Math.round((brandMentioned7 / nonSkipped7.length) * 100) : null;
  const compRate7 = nonSkipped7.length > 0 ? Math.round((compMentioned7 / nonSkipped7.length) * 100) : null;
  const gap = compRate7 != null && brandRate7 != null ? compRate7 - brandRate7 : null;

  const mentionCount = rows.filter(isMentioned).length;
  const lastMentionRow = rows.find(isMentioned);

  return {
    runCount: rows.length,
    mentionCount,
    shareOfVoice7d: compRate7,
    vsYouGap7d: gap,
    lastMentionAt: lastMentionRow?.run_at ?? null,
  };
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
