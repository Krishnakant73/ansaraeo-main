// Pure, deterministic Brand Positioning / AI Perception logic.
// No `@/` imports here so it stays unit-testable under vitest (no path alias).

export type Tone = "positive" | "neutral" | "negative";

export type BrandPerception = {
  perceived_category: string | null;
  strengths: string[];
  weaknesses: string[];
  recommended_for: string[];
  tone: Tone;
};

export type IntendedPositioning = {
  category: string | null;
  target_customer: string | null;
  differentiators: string[];
  best_for: string[];
  transformation_from: string | null;
  transformation_to: string | null;
};

export type AggregatePerception = {
  perceived_categories: { value: string; count: number }[];
  strengths: { value: string; count: number }[];
  weaknesses: { value: string; count: number }[];
  recommended_for: { value: string; count: number }[];
  tone_mix: { positive: number; neutral: number; negative: number };
};

export type PositioningGap = {
  categoryMatch: boolean;
  differentiatorsCovered: string[];
  differentiatorsMissing: string[];
  bestForCovered: string[];
  bestForMissing: string[];
  alignmentScore: number; // 0-100, labeled proxy
};

const MAX_ITEMS = 12;

function clampTextArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0)
    .slice(0, MAX_ITEMS);
}

function asTone(input: unknown): Tone {
  return input === "positive" || input === "negative" ? input : "neutral";
}

/** Pure: coerce an unknown LLM payload into a BrandPerception. Never throws. */
export function parseBrandPerception(raw: unknown): BrandPerception {
  if (!raw || typeof raw !== "object") {
    return { perceived_category: null, strengths: [], weaknesses: [], recommended_for: [], tone: "neutral" };
  }
  const obj = raw as Record<string, unknown>;
  const cat = obj.perceived_category;
  return {
    perceived_category: typeof cat === "string" && cat.trim().length > 0 ? cat.trim() : null,
    strengths: clampTextArray(obj.strengths),
    weaknesses: clampTextArray(obj.weaknesses),
    recommended_for: clampTextArray(obj.recommended_for),
    tone: asTone(obj.tone),
  };
}

/** Pure: aggregate an array of perceptions into frequency counts. */
export function aggregatePerceptions(rows: BrandPerception[]): AggregatePerception {
  const bump = (acc: Map<string, number>, v: string) => acc.set(v, (acc.get(v) ?? 0) + 1);
  const cat = new Map<string, number>();
  const str = new Map<string, number>();
  const weak = new Map<string, number>();
  const rec = new Map<string, number>();
  const tone_mix = { positive: 0, neutral: 0, negative: 0 };

  for (const r of rows) {
    if (r.perceived_category) bump(cat, r.perceived_category);
    for (const s of r.strengths) bump(str, s);
    for (const w of r.weaknesses) bump(weak, w);
    for (const f of r.recommended_for) bump(rec, f);
    tone_mix[r.tone] = (tone_mix[r.tone] ?? 0) + 1;
  }

  const top = (m: Map<string, number>) =>
    [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);

  return {
    perceived_categories: top(cat),
    strengths: top(str),
    weaknesses: top(weak),
    recommended_for: top(rec),
    tone_mix,
  };
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9ऀ-ॿ]+/i)
      .map((w) => w.trim())
      .filter((w) => w.length > 2),
  );
}

function tokenOverlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / a.size;
}

/** A claimed term is "covered" if any aggregated value shares >=half its tokens. */
function coverageHit(claim: string, haystack: string, items: { value: string }[]): boolean {
  const claimTokens = tokenize(claim);
  if (claimTokens.size === 0) return false;
  for (const item of items) {
    const itemTokens = tokenize(item.value);
    let hit = 0;
    for (const t of claimTokens) {
      if (itemTokens.has(t) || item.value.toLowerCase().includes(t)) hit++;
    }
    if (hit / claimTokens.size >= 0.5) return true;
  }
  return haystack.toLowerCase().includes([...claimTokens][0]);
}

/** Pure: compare intended positioning against aggregated actual perception. */
export function judgePositioningGap(
  intended: IntendedPositioning,
  aggregate: AggregatePerception,
): PositioningGap {
  const intendedCategory = (intended.category ?? "").trim();
  const actualCategory = aggregate.perceived_categories[0]?.value ?? "";

  const categoryMatch =
    intendedCategory.length > 0 && actualCategory.length > 0
      ? tokenOverlapScore(tokenize(intendedCategory), tokenize(actualCategory)) > 0
      : intendedCategory.length === 0; // no claim => no mismatch

  const intendedDiff = intended.differentiators ?? [];
  const intendedBest = intended.best_for ?? [];

  const allStrengths = aggregate.strengths.map((x) => x.value).join(" ");
  const allRec = aggregate.recommended_for.map((x) => x.value).join(" ");

  const coveredDiff = intendedDiff.filter((d) => coverageHit(d, allStrengths, aggregate.strengths));
  const missingDiff = intendedDiff.filter((d) => !coverageHit(d, allStrengths, aggregate.strengths));
  const coveredBest = intendedBest.filter((b) => coverageHit(b, allRec, aggregate.recommended_for));
  const missingBest = intendedBest.filter((b) => !coverageHit(b, allRec, aggregate.recommended_for));

  const diffScore = intendedDiff.length ? coveredDiff.length / intendedDiff.length : 1;
  const bestScore = intendedBest.length ? coveredBest.length / intendedBest.length : 1;
  const alignmentScore = Math.round(((categoryMatch ? 1 : 0) * 0.4 + diffScore * 0.3 + bestScore * 0.3) * 100);

  return {
    categoryMatch,
    differentiatorsCovered: coveredDiff,
    differentiatorsMissing: missingDiff,
    bestForCovered: coveredBest,
    bestForMissing: missingBest,
    alignmentScore,
  };
}
