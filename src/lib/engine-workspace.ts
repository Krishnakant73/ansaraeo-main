// ============================================================
// Engine workspace loader + shape.
//
// Engines are a global table (`engines`) — they don't belong to a brand.
// So the Engine workspace answers "how does <engine> cover <my brand>"
// and pulls brand-scoping from the same cookie the rest of the app uses
// (getSelectedBrand). No brand → 404 gracefully via null return.
//
// Slug = engine name (chatgpt|perplexity|gemini|google_ai_overview|
// grok|copilot). Enforced by the loader — an unknown slug → null → 404.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import type { EnginePersonality } from "./engine-personality";
import { EMPTY_PERSONALITY } from "./engine-personality";

export type EngineSnapshotPoint = {
  captured_on: string;              // yyyy-mm-dd
  mention_rate: number | null;
  own_citation_share: number | null;
};

export type EngineStats = {
  runCount: number;              // total non-skipped runs for this engine × brand
  skippedRunCount: number;
  mentionRate: number | null;    // percent over all runs
  mentionRate7d: number | null;
  mentionRate7dDelta: number | null; // pp vs prior 7d
  avgPosition: number | null;
  citationCount: number;
  ownCitationShare: number | null; // pp
  lastRunAt: string | null;
};

export type EngineBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type EngineDescriptor = {
  displayName: string;
  cites: boolean;               // whether the engine usually surfaces citations
  requiresKey: string | null;   // env var name if it's optional
  note: string;                 // one-liner for the header subtitle
};

const ENGINE_META: Record<string, EngineDescriptor> = {
  chatgpt: {
    displayName: "ChatGPT",
    cites: false,
    requiresKey: null,
    note: "OpenAI gpt-4o-mini. Does not typically surface citations.",
  },
  perplexity: {
    displayName: "Perplexity",
    cites: true,
    requiresKey: null,
    note: "Cites by default. Best signal for citation share.",
  },
  gemini: {
    displayName: "Gemini",
    cites: false,
    requiresKey: null,
    note: "Google gemini-2.0-flash. Distinct from Google AI Overview.",
  },
  google_ai_overview: {
    displayName: "Google AI Overview",
    cites: false,
    requiresKey: "DATAFORSEO_LOGIN",
    note: "Real AI Overview scraped via DataForSEO. Skips queries with no AI Overview shown.",
  },
  grok: {
    displayName: "Grok",
    cites: true,
    requiresKey: "GROK_API_KEY",
    note: "xAI grok-2-latest with web search. Cites via top-level citations.",
  },
  copilot: {
    displayName: "Microsoft Copilot",
    cites: false,
    requiresKey: "COPILOT_API_URL",
    note: "No public API — only enabled when a proxy is configured.",
  },
};

export type Engine = {
  id: string;                    // engine row uuid
  name: string;                  // slug + canonical key
  displayName: string;
  is_active: boolean;
  meta: EngineDescriptor;
  brand: EngineBrand;
  stats: EngineStats;
  personality: EnginePersonality; // EMPTY_PERSONALITY when no data
  changeEvents30d: number;        // count of engine_change_events in last 30d; 0 pre-migration-029
  snapshotSeries: EngineSnapshotPoint[]; // last 30 daily snapshots; [] pre-migration-029
};

export async function getEngineByName(name: string): Promise<Engine | null> {
  const meta = ENGINE_META[name];
  if (!meta) return null; // unknown slug

  const supabase = await createClient();
  const { data: eng } = await supabase
    .from("engines")
    .select("id, name, is_active")
    .eq("name", name)
    .maybeSingle();
  if (!eng) return null;

  const { brand } = await getSelectedBrand();
  if (!brand) return null; // no brand context → 404

  const engineId = (eng as { id: string }).id;
  const [stats, personality, changeEvents30d, snapshotSeries] = await Promise.all([
    loadEngineStats(engineId, brand.id, supabase),
    loadPersonality(engineId, brand.id, supabase),
    loadChangeEvents30d(engineId, brand.id, supabase),
    loadSnapshotSeries(engineId, brand.id, supabase),
  ]);

  return {
    id: engineId,
    name: (eng as { name: string }).name,
    displayName: meta.displayName,
    is_active: (eng as { is_active: boolean }).is_active,
    meta,
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      domain: brand.domain,
    },
    stats,
    personality,
    changeEvents30d,
    snapshotSeries,
  };
}

// Personality is a cache-first lookup: prefer the engine_personalities
// row (populated by the nightly cron); when absent (pre-migration-029 or
// before the first cron run), return EMPTY_PERSONALITY so the workspace
// falls back to empty-state coaching rather than a crash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPersonality(engineId: string, brandId: string, supabase: any): Promise<EnginePersonality> {
  try {
    const { data } = await supabase
      .from("engine_personalities")
      .select(
        "verbosity, hedging, format_bias, freshness_bias, citation_density, entity_resolution, sample_run_ids, runs_observed",
      )
      .eq("engine_id", engineId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (!data) return { ...EMPTY_PERSONALITY };
    return {
      verbosity: Number(data.verbosity) || 0,
      hedging: Number(data.hedging) || 0,
      format_bias: Number(data.format_bias) || 0,
      freshness_bias: Number(data.freshness_bias) || 0,
      citation_density: Number(data.citation_density) || 0,
      entity_resolution: Number(data.entity_resolution) || 0,
      sample_run_ids: (data.sample_run_ids as string[] | null) ?? [],
      runs_observed: Number(data.runs_observed) || 0,
    };
  } catch {
    return { ...EMPTY_PERSONALITY };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadChangeEvents30d(engineId: string, brandId: string, supabase: any): Promise<number> {
  const thirty = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  try {
    const { count } = await supabase
      .from("engine_change_events")
      .select("id", { count: "exact", head: true })
      .eq("engine_id", engineId)
      .or(`brand_id.eq.${brandId},brand_id.is.null`)
      .gte("occurred_on", thirty);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSnapshotSeries(engineId: string, brandId: string, supabase: any): Promise<EngineSnapshotPoint[]> {
  const thirty = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  try {
    const { data } = await supabase
      .from("engine_snapshots")
      .select("captured_on, mention_rate, own_citation_share")
      .eq("engine_id", engineId)
      .eq("brand_id", brandId)
      .gte("captured_on", thirty)
      .order("captured_on", { ascending: true });
    return (data as EngineSnapshotPoint[] | null) ?? [];
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadEngineStats(engineId: string, brandId: string, supabase: any): Promise<EngineStats> {
  // All runs for this engine × brand: fetch prompt ids first, then runs.
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", brandId)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
  if (promptIds.length === 0) {
    return {
      runCount: 0,
      skippedRunCount: 0,
      mentionRate: null,
      mentionRate7d: null,
      mentionRate7dDelta: null,
      avgPosition: null,
      citationCount: 0,
      ownCitationShare: null,
      lastRunAt: null,
    };
  }

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, run_at, brand_mentioned, brand_position")
    .eq("engine_id", engineId)
    .in("prompt_id", promptIds)
    .order("run_at", { ascending: false })
    .limit(2000);
  const rows =
    (runs as { id: string; run_at: string; brand_mentioned: boolean | null; brand_position: number | null }[] | null) ??
    [];
  const nonSkipped = rows.filter((r) => r.brand_mentioned !== null);
  const skippedRunCount = rows.length - nonSkipped.length;
  const mentioned = nonSkipped.filter((r) => r.brand_mentioned === true);

  const mentionRate =
    nonSkipped.length > 0 ? Math.round((mentioned.length / nonSkipped.length) * 100) : null;
  const now = Date.now();
  const week = 7 * 86_400_000;
  const cur7 = nonSkipped.filter((r) => now - new Date(r.run_at).getTime() < week);
  const prev7 = nonSkipped.filter((r) => {
    const t = now - new Date(r.run_at).getTime();
    return t >= week && t < 2 * week;
  });
  const cur7Rate =
    cur7.length > 0 ? Math.round((cur7.filter((r) => r.brand_mentioned === true).length / cur7.length) * 100) : null;
  const prev7Rate =
    prev7.length > 0 ? Math.round((prev7.filter((r) => r.brand_mentioned === true).length / prev7.length) * 100) : null;
  const mentionRate7dDelta = cur7Rate != null && prev7Rate != null ? cur7Rate - prev7Rate : null;

  const positions = mentioned
    .map((r) => r.brand_position)
    .filter((p): p is number => p != null && p > 0);
  const avgPosition = positions.length > 0 ? +(positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1) : null;

  // Citations for this engine × brand — fetch by run_id for the last N runs.
  const runIds = rows.slice(0, 500).map((r) => r.id);
  let citationCount = 0;
  let ownCitationShare: number | null = null;
  if (runIds.length > 0) {
    const { data: cits } = await supabase
      .from("citations")
      .select("is_own_domain")
      .in("run_id", runIds);
    const c = (cits as { is_own_domain: boolean | null }[] | null) ?? [];
    citationCount = c.length;
    if (c.length > 0) {
      const own = c.filter((x) => x.is_own_domain === true).length;
      ownCitationShare = Math.round((own / c.length) * 100);
    }
  }

  return {
    runCount: nonSkipped.length,
    skippedRunCount,
    mentionRate,
    mentionRate7d: cur7Rate,
    mentionRate7dDelta,
    avgPosition,
    citationCount,
    ownCitationShare,
    lastRunAt: rows[0]?.run_at ?? null,
  };
}

export const ENGINE_META_MAP = ENGINE_META;

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
