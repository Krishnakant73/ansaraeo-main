import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// competitor-traits — deterministic-first derivation of the
// Strengths / Weaknesses cards shown in the Competitor workspace.
//
// Follows the same philosophy as mention-matcher.ts: the deterministic
// signal (row counts, citation patterns, ranking gaps) is authoritative;
// an LLM verifier can be layered on later without changing this file's
// contract. Every trait is backed by evidence_run_ids so the UI can
// trace the claim in one click ("→ 14 runs · 4 threads").
//
// Reads only from visibility_runs + citations + prompts. No new tables
// required for derivation; when migration 028 is live, the results can
// be cached in competitor_traits so the workspace tab doesn't re-derive
// per request.
// ============================================================

export type TraitDimension = "strength" | "weakness";

export type CompetitorTrait = {
  competitor_id: string;
  dimension: TraitDimension;
  label: string;
  description: string;
  evidence_run_ids: string[];
  evidence_count: number;
  confidence: number;         // 0..1
  beatable: "easy" | "medium" | "hard" | null;
};

type MentionRow = {
  id: string;
  run_at: string;
  prompt_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

type CitationRow = {
  run_id: string;
  cited_domain: string | null;
  is_competitor_domain: boolean | null;
};

// Public entry point. Returns strengths + weaknesses sorted by
// confidence (descending). Empty array on insufficient data —
// the caller renders EmptyStateCoach instead.
export async function deriveCompetitorTraits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  competitor: {
    id: string;
    brand_id: string;
    name: string;
    domain: string | null;
  },
): Promise<CompetitorTrait[]> {
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
  if (promptIds.length === 0) return [];

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, run_at, prompt_id, brand_mentioned, brand_position, competitor_mentions")
    .in("prompt_id", promptIds)
    .order("run_at", { ascending: false })
    .limit(1000);
  const rows = (runs as MentionRow[] | null) ?? [];
  if (rows.length === 0) return [];

  const runIds = rows.map((r) => r.id);
  const { data: citations } = await supabase
    .from("citations")
    .select("run_id, cited_domain, is_competitor_domain")
    .in("run_id", runIds);
  const citRows = (citations as CitationRow[] | null) ?? [];

  const nameLower = competitor.name.toLowerCase();
  const domainLower = (competitor.domain ?? "").toLowerCase();

  // Runs the competitor appeared in.
  const compRuns = rows.filter((r) =>
    (r.competitor_mentions ?? []).some(
      (m) => m.mentioned && m.name.toLowerCase() === nameLower,
    ),
  );

  const traits: CompetitorTrait[] = [];

  // ─── Strength candidates ─────────────────────────────────

  // 1. Citation gravity — competitor's own domain shows up as a citation.
  if (domainLower) {
    const citedRuns = new Set(
      citRows
        .filter((c) => (c.cited_domain ?? "").toLowerCase().includes(domainLower))
        .map((c) => c.run_id),
    );
    const supportingRuns = compRuns.filter((r) => citedRuns.has(r.id));
    if (supportingRuns.length >= 3) {
      const conf = Math.min(0.98, supportingRuns.length / Math.max(compRuns.length, 6));
      traits.push({
        competitor_id: competitor.id,
        dimension: "strength",
        label: "Citation gravity",
        description: `Their domain is directly cited in ${supportingRuns.length} of ${compRuns.length} runs where they appear.`,
        evidence_run_ids: supportingRuns.slice(0, 20).map((r) => r.id),
        evidence_count: supportingRuns.length,
        confidence: round3(conf),
        beatable: supportingRuns.length > 10 ? "hard" : "medium",
      });
    }
  }

  // 2. Position dominance — average rank ≤ 2 when they appear.
  const positions = compRuns
    .map((r) =>
      (r.competitor_mentions ?? []).find(
        (m) => m.mentioned && m.name.toLowerCase() === nameLower,
      )?.position,
    )
    .filter((p): p is number => typeof p === "number" && p > 0);
  if (positions.length >= 3) {
    const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
    if (avg <= 2) {
      const evidence = compRuns
        .filter((r) => {
          const m = (r.competitor_mentions ?? []).find(
            (x) => x.mentioned && x.name.toLowerCase() === nameLower,
          );
          return typeof m?.position === "number" && m.position <= 2;
        })
        .slice(0, 20)
        .map((r) => r.id);
      traits.push({
        competitor_id: competitor.id,
        dimension: "strength",
        label: "Top-of-answer position",
        description: `Averages rank ${avg.toFixed(1)} across ${positions.length} appearances.`,
        evidence_run_ids: evidence,
        evidence_count: evidence.length,
        confidence: round3(Math.min(0.95, positions.length / 20)),
        beatable: avg <= 1.3 ? "hard" : "medium",
      });
    }
  }

  // 3. Cross-engine breadth — they appear against ≥3 engines.
  const engineIds = new Set<string>(
    compRuns
      .map((r) => (r as MentionRow & { engine_id?: string }).engine_id)
      .filter(Boolean) as string[],
  );
  if (engineIds.size >= 3) {
    traits.push({
      competitor_id: competitor.id,
      dimension: "strength",
      label: "Cross-engine coverage",
      description: `Surfaced by ${engineIds.size} distinct engines in the last window.`,
      evidence_run_ids: compRuns.slice(0, 20).map((r) => r.id),
      evidence_count: compRuns.length,
      confidence: round3(Math.min(0.9, engineIds.size / 6)),
      beatable: "medium",
    });
  }

  // ─── Weakness candidates ─────────────────────────────────

  // 4. Absent in engines where you show up — the inverse.
  // Runs where YOU are mentioned but they aren't, indexed against total.
  const brandOnly = rows.filter((r) => {
    const compIn = (r.competitor_mentions ?? []).some(
      (m) => m.mentioned && m.name.toLowerCase() === nameLower,
    );
    return r.brand_mentioned === true && !compIn;
  });
  if (brandOnly.length >= 3 && brandOnly.length >= compRuns.length * 0.4) {
    traits.push({
      competitor_id: competitor.id,
      dimension: "weakness",
      label: "Coverage gap",
      description: `You're mentioned but they aren't in ${brandOnly.length} of the last ${rows.length} runs. Prompts where they've never appeared are your safest defenses.`,
      evidence_run_ids: brandOnly.slice(0, 20).map((r) => r.id),
      evidence_count: brandOnly.length,
      confidence: round3(Math.min(0.9, brandOnly.length / rows.length)),
      beatable: "easy",
    });
  }

  // 5. Sparse citation footprint — appears but never cited.
  if (domainLower) {
    const withCitation = new Set(
      citRows
        .filter((c) => (c.cited_domain ?? "").toLowerCase().includes(domainLower))
        .map((c) => c.run_id),
    );
    const uncited = compRuns.filter((r) => !withCitation.has(r.id));
    if (compRuns.length >= 5 && withCitation.size === 0) {
      traits.push({
        competitor_id: competitor.id,
        dimension: "weakness",
        label: "No citation anchor",
        description: `They're mentioned by name in ${compRuns.length} runs but their domain is never cited. An earned citation on your side flips this.`,
        evidence_run_ids: uncited.slice(0, 20).map((r) => r.id),
        evidence_count: uncited.length,
        confidence: round3(Math.min(0.85, compRuns.length / 15)),
        beatable: "medium",
      });
    }
  }

  // 6. Losing runs — competitor was outranked by you.
  const outranked = compRuns.filter((r) => {
    const m = (r.competitor_mentions ?? []).find(
      (x) => x.mentioned && x.name.toLowerCase() === nameLower,
    );
    return (
      typeof m?.position === "number" &&
      typeof r.brand_position === "number" &&
      r.brand_position < m.position
    );
  });
  if (outranked.length >= 3) {
    traits.push({
      competitor_id: competitor.id,
      dimension: "weakness",
      label: "You outrank them here",
      description: `In ${outranked.length} runs you appear at a better position than they do. Ship a comparison page to lock this in.`,
      evidence_run_ids: outranked.slice(0, 20).map((r) => r.id),
      evidence_count: outranked.length,
      confidence: round3(Math.min(0.9, outranked.length / Math.max(compRuns.length, 8))),
      beatable: "easy",
    });
  }

  return traits.sort((a, b) => b.confidence - a.confidence);
}

// ─── Threat score derivation ─────────────────────────────

export type ThreatScoreParts = {
  score: number;             // 0..100
  components: {
    label: string;
    weight: number;          // 0..1
    contribution: number;    // 0..100 scaled
    detail: string;
  }[];
};

// Compose a 0..100 threat score from the competitor's mention rate delta,
// citation gravity, position lead, and content velocity. Weighted mean;
// missing components fall back to 0 (safe: gap components can't inflate
// the score, they can only lower it).
export function scoreCompetitorThreat(inputs: {
  gapPp: number | null;                 // competitor% − brand%, last 7d
  citationShareDeltaPp: number | null;  // competitor citation share − yours, 30d
  positionLead: number | null;          // (brand.avg − competitor.avg), 30d; +ve = they lead
  contentVelocityRatio: number | null;  // their pages/30d divided by yours, capped
  forecastCrossoverIn: number | null;   // days until forecast crossover, if any
}): ThreatScoreParts {
  const parts: ThreatScoreParts["components"] = [];

  const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

  // Mention gap: −20pp → 0, +40pp → 100.
  if (inputs.gapPp != null) {
    const scaled = clamp(((inputs.gapPp + 20) / 60) * 100);
    parts.push({
      label: "Mention-rate gap",
      weight: 0.35,
      contribution: scaled,
      detail: `${inputs.gapPp >= 0 ? "+" : ""}${inputs.gapPp.toFixed(0)}pp`,
    });
  }
  // Citation share delta: same scaling.
  if (inputs.citationShareDeltaPp != null) {
    const scaled = clamp(((inputs.citationShareDeltaPp + 20) / 60) * 100);
    parts.push({
      label: "Citation share delta",
      weight: 0.2,
      contribution: scaled,
      detail: `${inputs.citationShareDeltaPp >= 0 ? "+" : ""}${inputs.citationShareDeltaPp.toFixed(0)}pp`,
    });
  }
  // Position lead (avg brand − avg comp): +2 → 100, −2 → 0.
  if (inputs.positionLead != null) {
    const scaled = clamp(((inputs.positionLead + 2) / 4) * 100);
    parts.push({
      label: "Position lead",
      weight: 0.15,
      contribution: scaled,
      detail: `${inputs.positionLead >= 0 ? "+" : ""}${inputs.positionLead.toFixed(1)}`,
    });
  }
  // Content velocity ratio: cap at 4× ⇒ 100.
  if (inputs.contentVelocityRatio != null) {
    const scaled = clamp((inputs.contentVelocityRatio / 4) * 100);
    parts.push({
      label: "Content velocity",
      weight: 0.15,
      contribution: scaled,
      detail: `${inputs.contentVelocityRatio.toFixed(1)}× yours`,
    });
  }
  // Forecast crossover risk: <30 days → 100, >180 days → 0.
  if (inputs.forecastCrossoverIn != null) {
    const scaled = clamp(((180 - inputs.forecastCrossoverIn) / 150) * 100);
    parts.push({
      label: "Forecast crossover risk",
      weight: 0.15,
      contribution: scaled,
      detail: inputs.forecastCrossoverIn < 30 ? "imminent" : `${Math.round(inputs.forecastCrossoverIn)}d out`,
    });
  }

  const totalWeight = parts.reduce((a, b) => a + b.weight, 0) || 1;
  const score = Math.round(
    parts.reduce((sum, p) => sum + p.contribution * p.weight, 0) / totalWeight,
  );

  return { score: clamp(score, 0, 100), components: parts };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
