// ============================================================
// engine-dna — maps an EnginePersonality onto the six-axis DnaScores
// consumed by the HexRadar primitive. Also computes the "you" baseline
// for the overlay: the average personality across every OTHER active
// engine for the same brand.
//
// The most useful comparison a customer can act on is "how does this
// engine differ from your cross-engine baseline?" — a 30-point spike
// on "format_bias" says "this engine wants lists; your average engine
// is prose."
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_PERSONALITY,
  computeEnginePersonality,
  type EnginePersonality,
} from "./engine-personality";

export type DnaAxis =
  | "verbosity"
  | "hedging"
  | "format_bias"
  | "freshness_bias"
  | "citation_density"
  | "entity_resolution";

export type DnaScores = Record<DnaAxis, number>;

export const DNA_AXES: { key: DnaAxis; label: string; hint: string }[] = [
  { key: "verbosity", label: "Verbosity", hint: "Long-form vs terse answers" },
  { key: "hedging", label: "Hedging", hint: "Confident vs cautious language" },
  { key: "format_bias", label: "Format bias", hint: "Bullet-lovers vs prose" },
  { key: "freshness_bias", label: "Freshness bias", hint: "Recent sources vs evergreen" },
  { key: "citation_density", label: "Citation density", hint: "Citations per answer" },
  { key: "entity_resolution", label: "Entity resolution", hint: "Ranks named brands high" },
];

export function personalityToDna(p: EnginePersonality): DnaScores {
  return {
    verbosity: p.verbosity,
    hedging: p.hedging,
    format_bias: p.format_bias,
    freshness_bias: p.freshness_bias,
    citation_density: p.citation_density,
    entity_resolution: p.entity_resolution,
  };
}

export function averageDna(list: DnaScores[]): DnaScores {
  if (list.length === 0) {
    return personalityToDna(EMPTY_PERSONALITY);
  }
  const sum: DnaScores = {
    verbosity: 0,
    hedging: 0,
    format_bias: 0,
    freshness_bias: 0,
    citation_density: 0,
    entity_resolution: 0,
  };
  for (const s of list) {
    (Object.keys(sum) as DnaAxis[]).forEach((k) => {
      sum[k] += s[k];
    });
  }
  const out: DnaScores = { ...sum };
  (Object.keys(sum) as DnaAxis[]).forEach((k) => {
    out[k] = Math.round((sum[k] / list.length) * 10) / 10;
  });
  return out;
}

// Fetches DNA for the current engine + the "cross-engine baseline"
// (the mean personality of every other active engine for the same
// brand). Falls back to EMPTY_PERSONALITY DNA if no siblings.
export async function loadEngineDnaOverlay(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  engineId: string,
  brandId: string,
): Promise<{ them: DnaScores; you: DnaScores }> {
  const [thisPersonality, siblings] = await Promise.all([
    computeEnginePersonality(supabase, engineId, brandId),
    supabase
      .from("engines")
      .select("id")
      .eq("is_active", true)
      .neq("id", engineId),
  ]);

  const siblingIds = ((siblings.data as { id: string }[] | null) ?? []).map((r) => r.id);
  const siblingPersonalities = await Promise.all(
    siblingIds.map((sid) => computeEnginePersonality(supabase, sid, brandId)),
  );

  return {
    them: personalityToDna(thisPersonality),
    you: averageDna(siblingPersonalities.filter((p) => p.runs_observed > 0).map(personalityToDna)),
  };
}
