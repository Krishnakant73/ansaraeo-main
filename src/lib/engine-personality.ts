import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// engine-personality — deterministic-first derivation of the six-
// axis "AI Personality" scores for a single engine, scoped to a
// single brand's runs.
//
// Same discipline as competitor-traits: only signal from
// visibility_runs + citations, no LLM classification. The workspace
// caches results in engine_personalities (migration 029) so the tab
// doesn't re-derive per request; this file is the deriver.
//
// Axes (0..100):
//   verbosity          — median tokens_used vs a fixed cap (1500 tk)
//   hedging            — share of responses with hedge words
//   format_bias        — share of responses that use bullets/lists
//   freshness_bias     — share of citations that look "recent" (yyyy)
//   citation_density   — citations per run, clamped
//   entity_resolution  — share of runs where any competitor lands
//                        in top-3 position
// ============================================================

export type EnginePersonality = {
  verbosity: number;
  hedging: number;
  format_bias: number;
  freshness_bias: number;
  citation_density: number;
  entity_resolution: number;
  sample_run_ids: string[];
  runs_observed: number;
};

export const EMPTY_PERSONALITY: EnginePersonality = {
  verbosity: 0,
  hedging: 0,
  format_bias: 0,
  freshness_bias: 0,
  citation_density: 0,
  entity_resolution: 0,
  sample_run_ids: [],
  runs_observed: 0,
};

type RunRow = {
  id: string;
  raw_response: string | null;
  tokens_used: number | null;
  competitor_mentions:
    | { name: string; mentioned: boolean; position: number | null }[]
    | null;
};

type CitationRow = {
  run_id: string;
  cited_url: string | null;
  cited_domain: string | null;
};

// Deliberately loose — hedge words are model-agnostic.
const HEDGE_REGEX = /\b(may|might|could|would|should|typically|often|sometimes|generally|likely|suggests?|appears?|seems?|possibly|potentially)\b/gi;

// Bullet / list detection: markdown bullets, numbered lists, arrow marks.
const LIST_REGEX = /(^|\n)\s*(?:[-*•]|\d+\.)\s+/;

// Year regex — 4-digit years in citation URLs are a decent freshness proxy.
const YEAR_REGEX = /\b(20\d{2})\b/;

// Public entry point. Returns EMPTY_PERSONALITY when no runs; UI
// renders EmptyStateCoach in that case. Never throws.
export async function computeEnginePersonality(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  engineId: string,
  brandId: string,
): Promise<EnginePersonality> {
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", brandId)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
  if (promptIds.length === 0) return { ...EMPTY_PERSONALITY };

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, raw_response, tokens_used, competitor_mentions")
    .eq("engine_id", engineId)
    .in("prompt_id", promptIds)
    .order("run_at", { ascending: false })
    .limit(500);
  const rows = (runs as RunRow[] | null) ?? [];
  if (rows.length === 0) return { ...EMPTY_PERSONALITY };

  const runIds = rows.map((r) => r.id);
  const { data: citations } = await supabase
    .from("citations")
    .select("run_id, cited_url, cited_domain")
    .in("run_id", runIds);
  const cits = (citations as CitationRow[] | null) ?? [];

  return derivePersonality(rows, cits);
}

// Pure function so the tests can exercise it without any DB.
export function derivePersonality(
  rows: RunRow[],
  citations: CitationRow[],
): EnginePersonality {
  if (rows.length === 0) return { ...EMPTY_PERSONALITY };

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  // Verbosity — median tokens_used vs 1500-token cap.
  const tokens = rows
    .map((r) => r.tokens_used)
    .filter((t): t is number => typeof t === "number" && t > 0);
  const verbosity = tokens.length > 0
    ? clamp((median(tokens) / 1500) * 100)
    : 0;

  // Hedging — share of responses with ≥1 hedge word.
  const responses = rows.map((r) => r.raw_response ?? "").filter((r) => r.length > 0);
  const hedgingRuns = responses.filter((r) => HEDGE_REGEX.test(r));
  HEDGE_REGEX.lastIndex = 0; // paranoia; test() with `g` flag advances lastIndex
  const hedging = responses.length > 0
    ? clamp((hedgingRuns.length / responses.length) * 100)
    : 0;

  // Format bias — share of responses with a bullet/numbered list.
  const listRuns = responses.filter((r) => LIST_REGEX.test(r));
  const format_bias = responses.length > 0
    ? clamp((listRuns.length / responses.length) * 100)
    : 0;

  // Freshness bias — share of dated citations that reference a recent year.
  const thisYear = 2026; // stamp at author time; recompute in-scope on next migration
  const datedCitations = citations
    .map((c) => {
      const src = `${c.cited_url ?? ""} ${c.cited_domain ?? ""}`;
      const m = YEAR_REGEX.exec(src);
      return m ? Number(m[1]) : null;
    })
    .filter((y): y is number => y != null && y >= 2015 && y <= thisYear + 1);
  const recent = datedCitations.filter((y) => thisYear - y <= 1);
  const freshness_bias = datedCitations.length > 0
    ? clamp((recent.length / datedCitations.length) * 100)
    : 0;

  // Citation density — mean citations per run, clamped at 5/run = 100.
  const perRun = rows.length > 0 ? citations.length / rows.length : 0;
  const citation_density = clamp((perRun / 5) * 100);

  // Entity resolution — share of runs where any competitor lands in top 3.
  const topEntities = rows.filter((r) =>
    (r.competitor_mentions ?? []).some(
      (m) =>
        m.mentioned && typeof m.position === "number" && m.position > 0 && m.position <= 3,
    ),
  );
  const entity_resolution = rows.length > 0
    ? clamp((topEntities.length / rows.length) * 100)
    : 0;

  return {
    verbosity: round1(verbosity),
    hedging: round1(hedging),
    format_bias: round1(format_bias),
    freshness_bias: round1(freshness_bias),
    citation_density: round1(citation_density),
    entity_resolution: round1(entity_resolution),
    sample_run_ids: rows.slice(0, 20).map((r) => r.id),
    runs_observed: rows.length,
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
