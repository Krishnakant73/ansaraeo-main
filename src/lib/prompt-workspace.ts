// ============================================================
// Prompt workspace loader + shape.
//
// getPromptById(id, supabase) — cookie-scoped resolver used by the
// /dashboard/w/prompt/[id]/** descriptor. Returns null on RLS miss →
// the framework 404s (mirrors the Brand workspace contract). Never
// use the service client here: prompt existence would leak across
// orgs.
//
// The returned object embeds the parent brand (needed for chips,
// href generation, competitor lookups) and computes lightweight
// stats (last run, run count) up-front so the header + KPI card
// callers don't re-query.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type PromptStats = {
  runCount: number;
  lastRunAt: string | null;
  enginesActive: number; // distinct engines with a run in last 7d
  mentionRate7d: number | null; // percent (0..100), null when zero runs
};

export type PromptBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
};

export type Prompt = {
  id: string;
  brand_id: string;
  text: string;
  language: string;
  category: string | null;
  intent: string | null;
  priority: boolean;
  is_active: boolean;
  created_at: string;
  brand: PromptBrand;
  stats: PromptStats;
};

const PROMPT_COLUMNS =
  "id, brand_id, text, language, category, intent, priority, is_active, created_at";
const BRAND_COLUMNS = "id, name, slug, domain, industry";

export async function getPromptById(id: string): Promise<Prompt | null> {
  const supabase = await createClient();
  const { data: prompt } = await supabase
    .from("prompts")
    .select(PROMPT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!prompt) return null;

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", (prompt as { brand_id: string }).brand_id)
    .maybeSingle();
  // RLS: if the user can read the prompt but not the brand something is
  // very wrong; degrade to null so we render a 404.
  if (!brand) return null;

  const stats = await loadPromptStats(id, supabase);

  return {
    ...(prompt as Omit<Prompt, "brand" | "stats">),
    brand: brand as PromptBrand,
    stats,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPromptStats(promptId: string, supabase: any): Promise<PromptStats> {
  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, run_at, engine_id, brand_mentioned")
    .eq("prompt_id", promptId)
    .order("run_at", { ascending: false })
    .limit(500);

  const rows =
    (runs as { id: string; run_at: string; engine_id: string; brand_mentioned: boolean | null }[] | null) ??
    [];
  if (rows.length === 0) {
    return { runCount: 0, lastRunAt: null, enginesActive: 0, mentionRate7d: null };
  }

  const now = Date.now();
  const week = 7 * 86_400_000;
  const last7 = rows.filter((r) => now - new Date(r.run_at).getTime() < week);
  const engines7 = new Set(last7.map((r) => r.engine_id).filter(Boolean));
  const nonSkipped7 = last7.filter((r) => r.brand_mentioned !== null);
  const mentioned7 = nonSkipped7.filter((r) => r.brand_mentioned === true).length;

  return {
    runCount: rows.length,
    lastRunAt: rows[0]?.run_at ?? null,
    enginesActive: engines7.size,
    mentionRate7d:
      nonSkipped7.length === 0 ? null : Math.round((mentioned7 / nonSkipped7.length) * 100),
  };
}

// Compact relative-time helper used by the header chip. Kept here so
// tab bodies + shell agree on the same formatting.
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
