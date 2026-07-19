// ============================================================
// history-events.ts — PURE logic for the History Engine.
//
// No DB, no fetch, no env. Everything here is deterministic and
// unit-tested (see history-engine.test.ts). The IO layer
// (history-engine.ts) calls these to derive timeline events and
// aggregate trends from real observations.
//
// Honesty principle is baked in: a skipped run produces NO delta
// events, and buckets with no data return rate=null (never 0).
// ============================================================

export const EVENT_TYPES = {
  FIRST_MENTION: "first_mention",
  MENTION_GAINED: "mention_gained",
  MENTION_LOST: "mention_lost",
  FIRST_RECOMMENDATION: "first_recommendation",
  RECOMMENDATION_GAINED: "recommendation_gained",
  RECOMMENDATION_LOST: "recommendation_lost",
  POSITION_IMPROVED: "position_improved",
  POSITION_DROPPED: "position_dropped",
  SENTIMENT_SHIFTED: "sentiment_shifted",
  CITATION_GAINED: "citation_gained",
  CITATION_LOST: "citation_lost",
  COMPETITOR_GAINED: "competitor_gained",
  COMPETITOR_LOST: "competitor_lost",
  ENGINE_CHANGE_DETECTED: "engine_change_detected",
} as const;

export type EventSeverity = "positive" | "negative" | "info";

export type EventSpec = {
  event_type: string;
  severity: EventSeverity;
  from_state: unknown;
  to_state: unknown;
  detail: Record<string, unknown>;
};

/** Minimal observation shape the diff needs (both pure + serializable). */
export type DiffObservation = {
  id: string;
  observed_at: string;
  skipped: boolean;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

export type DiffInput = {
  prev: DiffObservation | null;
  curr: DiffObservation;
  /** cited domains for the prior run (for citation delta) */
  prevCitations?: string[];
  /** cited domains for the current run */
  currCitations?: string[];
  /** normalized response signature for the prior run (engine-change signal) */
  prevSignature?: string | null;
  /** normalized response signature for the current run */
  currSignature?: string | null;
};

/**
 * Derive timeline events between two consecutive observations.
 * Pure: same input → same events. No side effects.
 */
export function diffObservation(input: DiffInput): EventSpec[] {
  const {
    prev,
    curr,
    prevCitations = [],
    currCitations = [],
    prevSignature = null,
    currSignature = null,
  } = input;

  const events: EventSpec[] = [];

  // A skip is "we checked, engine returned nothing" — not a verdict flip.
  // Recorded as history but never emits a delta event.
  if (curr.skipped) return events;

  const currMentioned = curr.brand_mentioned === true;

  // First real observation (or first since a skip): only "firsts", never
  // citation/competitor deltas (those would all be "gained" = noise).
  if (!prev || prev.skipped) {
    if (currMentioned) {
      events.push({
        event_type: EVENT_TYPES.FIRST_MENTION,
        severity: "positive",
        from_state: null,
        to_state: { brand_mentioned: true },
        detail: {},
      });
    }
    if (curr.recommendation_alignment === "aligned") {
      events.push({
        event_type: EVENT_TYPES.FIRST_RECOMMENDATION,
        severity: "positive",
        from_state: null,
        to_state: { recommendation_alignment: "aligned" },
        detail: {},
      });
    }
    return events;
  }

  const prevMentioned = prev.brand_mentioned === true;

  // --- mention verdict ---
  if (!prevMentioned && currMentioned) {
    events.push({
      event_type: EVENT_TYPES.MENTION_GAINED,
      severity: "positive",
      from_state: { brand_mentioned: false },
      to_state: { brand_mentioned: true },
      detail: {},
    });
  } else if (prevMentioned && !currMentioned) {
    events.push({
      event_type: EVENT_TYPES.MENTION_LOST,
      severity: "negative",
      from_state: { brand_mentioned: true },
      to_state: { brand_mentioned: false },
      detail: {},
    });
  }

  // --- recommendation alignment (aligned is the only positive state) ---
  const wasAligned = prev.recommendation_alignment === "aligned";
  const isAligned = curr.recommendation_alignment === "aligned";
  if (!wasAligned && isAligned) {
    events.push({
      event_type: EVENT_TYPES.RECOMMENDATION_GAINED,
      severity: "positive",
      from_state: { recommendation_alignment: prev.recommendation_alignment },
      to_state: { recommendation_alignment: "aligned" },
      detail: {},
    });
  } else if (wasAligned && !isAligned) {
    events.push({
      event_type: EVENT_TYPES.RECOMMENDATION_LOST,
      severity: "negative",
      from_state: { recommendation_alignment: "aligned" },
      to_state: { recommendation_alignment: curr.recommendation_alignment },
      detail: {},
    });
  }

  // --- position (lower rank number = better) ---
  if (
    prev.brand_position != null &&
    curr.brand_position != null &&
    prev.brand_position !== curr.brand_position
  ) {
    const improved = curr.brand_position < prev.brand_position;
    events.push({
      event_type: improved ? EVENT_TYPES.POSITION_IMPROVED : EVENT_TYPES.POSITION_DROPPED,
      severity: improved ? "positive" : "negative",
      from_state: { brand_position: prev.brand_position },
      to_state: { brand_position: curr.brand_position },
      detail: { from: prev.brand_position, to: curr.brand_position },
    });
  }

  // --- sentiment ---
  if (prev.sentiment && curr.sentiment && prev.sentiment !== curr.sentiment) {
    let severity: EventSeverity = "info";
    if (curr.sentiment === "positive") severity = "positive";
    else if (curr.sentiment === "negative") severity = "negative";
    events.push({
      event_type: EVENT_TYPES.SENTIMENT_SHIFTED,
      severity,
      from_state: { sentiment: prev.sentiment },
      to_state: { sentiment: curr.sentiment },
      detail: { from: prev.sentiment, to: curr.sentiment },
    });
  }

  // --- citations (set diff on cited domains) ---
  const prevSet = new Set(prevCitations);
  const currSet = new Set(currCitations);
  const gainedDomains = currCitations.filter((d) => !prevSet.has(d));
  const lostDomains = prevCitations.filter((d) => !currSet.has(d));
  if (gainedDomains.length) {
    events.push({
      event_type: EVENT_TYPES.CITATION_GAINED,
      severity: "positive",
      from_state: { citations: prevCitations.length },
      to_state: { citations: currCitations.length },
      detail: { domains: gainedDomains, count: gainedDomains.length },
    });
  }
  if (lostDomains.length) {
    events.push({
      event_type: EVENT_TYPES.CITATION_LOST,
      severity: "negative",
      from_state: { citations: prevCitations.length },
      to_state: { citations: currCitations.length },
      detail: { domains: lostDomains, count: lostDomains.length },
    });
  }

  // --- competitors (set diff on mentioned names) ---
  const prevComp = new Set(
    (prev.competitor_mentions ?? []).filter((c) => c.mentioned).map((c) => c.name),
  );
  const currComp = new Set(
    (curr.competitor_mentions ?? []).filter((c) => c.mentioned).map((c) => c.name),
  );
  const gainedComp = [...currComp].filter((n) => !prevComp.has(n));
  const lostComp = [...prevComp].filter((n) => !currComp.has(n));
  if (gainedComp.length) {
    // A competitor gaining the mention is bad for us → negative severity.
    events.push({
      event_type: EVENT_TYPES.COMPETITOR_GAINED,
      severity: "negative",
      from_state: { competitors: [...prevComp] },
      to_state: { competitors: [...currComp] },
      detail: { competitors: gainedComp, count: gainedComp.length },
    });
  }
  if (lostComp.length) {
    // A competitor losing the mention is good for us → positive severity.
    events.push({
      event_type: EVENT_TYPES.COMPETITOR_LOST,
      severity: "positive",
      from_state: { competitors: [...prevComp] },
      to_state: { competitors: [...currComp] },
      detail: { competitors: lostComp, count: lostComp.length },
    });
  }

  // --- engine-change signal: verdict flipped AND the response text changed
  // materially. Honestly a heuristic — labeled as such, never claimed as
  // proof of an engine "update". ---
  const signatureChanged =
    prevSignature != null && currSignature != null && prevSignature !== currSignature;
  if (signatureChanged && prevMentioned !== currMentioned) {
    events.push({
      event_type: EVENT_TYPES.ENGINE_CHANGE_DETECTED,
      severity: "info",
      from_state: { brand_mentioned: prevMentioned },
      to_state: { brand_mentioned: currMentioned },
      detail: { reason: "response_changed_and_mention_flipped" },
    });
  }

  return events;
}

// ---------- trend aggregation (pure) ----------

export type TrendBucket = "day" | "week" | "month";

export type TrendRow = {
  observed_at: string;
  brand_mentioned: boolean | null;
  skipped: boolean;
  engine_name: string;
};

export type TrendPoint = {
  bucket: string;
  total: number;
  mentioned: number;
  rate: number | null;
};

/** UTC bucket key — deterministic, aligns with monthly partitions. */
export function bucketKey(iso: string, bucket: TrendBucket): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (bucket === "month") return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  if (bucket === "day") return new Date(Date.UTC(y, m, d.getUTCDate())).toISOString().slice(0, 10);
  // week: Monday of the UTC week
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(y, m, d.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

/**
 * Time-bucketed mention rate. Skipped runs and null mentions are excluded
 * from the denominator. A bucket that has runs but no qualifying mention
 * verdict (e.g. every run that month was skipped) is still emitted with
 * rate=null — honesty: we never report a 0% rate for a period we measured
 * but couldn't score, and we never fabricate a value.
 */
export function bucketTrend(rows: TrendRow[], bucket: TrendBucket = "month"): TrendPoint[] {
  const qualifying = new Map<string, { total: number; mentioned: number }>();
  for (const r of rows) {
    if (r.skipped || r.brand_mentioned == null) continue;
    const key = bucketKey(r.observed_at, bucket);
    const acc = qualifying.get(key) ?? { total: 0, mentioned: 0 };
    acc.total += 1;
    if (r.brand_mentioned) acc.mentioned += 1;
    qualifying.set(key, acc);
  }

  // Emit one point per bucket that has ANY row (so a month with only skipped
  // runs still shows up as rate=null rather than silently vanishing).
  const points = new Map<string, TrendPoint>();
  for (const r of rows) {
    const key = bucketKey(r.observed_at, bucket);
    const acc = qualifying.get(key);
    points.set(key, {
      bucket: key,
      total: acc?.total ?? 0,
      mentioned: acc?.mentioned ?? 0,
      rate: acc ? Math.round((acc.mentioned / acc.total) * 100) : null,
    });
  }

  return [...points.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, p]) => p);
}

export type CompRow = {
  observed_at: string;
  competitor_mentions: { name: string; mentioned: boolean }[] | null;
};

export type CompetitorTrendPoint = { month: string; mentioned: number; total: number };
export type CompetitorTrend = Record<string, CompetitorTrendPoint[]>;

/** Per-competitor monthly mention counts (pure). */
export function bucketCompetitorTrend(rows: CompRow[]): CompetitorTrend {
  const map = new Map<string, Map<string, { mentioned: number; total: number }>>();
  for (const r of rows) {
    const month = bucketKey(r.observed_at, "month");
    if (!map.has(month)) map.set(month, new Map());
    const monthMap = map.get(month)!;
    for (const c of r.competitor_mentions ?? []) {
      const acc = monthMap.get(c.name) ?? { mentioned: 0, total: 0 };
      acc.total += 1;
      if (c.mentioned) acc.mentioned += 1;
      monthMap.set(c.name, acc);
    }
  }
  const result: CompetitorTrend = {};
  for (const [month, monthMap] of map) {
    for (const [name, acc] of monthMap) {
      if (!result[name]) result[name] = [];
      result[name].push({ month, mentioned: acc.mentioned, total: acc.total });
    }
  }
  for (const name of Object.keys(result)) {
    result[name].sort((a, b) => (a.month < b.month ? -1 : 1));
  }
  return result;
}

// ---------- aggregation (pure) ----------
// These mirror the structure of getInsights() in history-engine.ts but are
// extracted as deterministic, unit-tested helpers so the "which competitors
// gained over 12 months" / "which prompts improved" answers are verifiable
// without a database. Same inputs → same outputs. Honesty is carried: a
// competitor with no prior bucket, or a prompt with only prior data, yields
// null/stable rather than a fabricated delta.

export type FirstMention = { engine: string; observed_at: string };

/** First time each engine surfaced the brand (chronological scan). */
export function computeFirstMentionByEngine(
  rows: { observed_at: string; engine_name: string; skipped: boolean; brand_mentioned: boolean | null }[],
): FirstMention[] {
  const out: FirstMention[] = [];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => (a.observed_at < b.observed_at ? -1 : 1))) {
    if (r.skipped || !r.brand_mentioned) continue;
    if (!seen.has(r.engine_name)) {
      seen.add(r.engine_name);
      out.push({ engine: r.engine_name, observed_at: r.observed_at });
    }
  }
  return out;
}

export type CompetitorMover = { name: string; delta: number; trend: "gaining" | "losing" | "stable" };

/**
 * Net visibility shift per competitor over the window: last bucket's mention
 * rate minus the first bucket's. >5pp = gaining (a threat to us), <-5pp =
 * losing (a win), in between = stable. Rates are 0..1 here; delta is reported
 * in whole percentage points.
 */
export function computeCompetitorMovers(trend: CompetitorTrend): CompetitorMover[] {
  return Object.entries(trend).map(([name, points]) => {
    const first = points[0];
    const last = points[points.length - 1];
    const firstRate = first.total > 0 ? first.mentioned / first.total : 0;
    const lastRate = last.total > 0 ? last.mentioned / last.total : 0;
    const delta = Math.round((lastRate - firstRate) * 100);
    const trend: CompetitorMover["trend"] = delta > 5 ? "gaining" : delta < -5 ? "losing" : "stable";
    return { name, delta, trend };
  });
}

export type PromptImprovement = {
  prompt_id: string;
  prompt_text: string;
  recentRate: number | null;
  priorRate: number | null;
  delta: number | null;
};

/**
 * Recent 30d mention rate vs the prior window, per prompt — signals that a
 * content update is working. Only prompts with BOTH windows scored produce a
 * delta; a prompt with data in only one window is excluded (delta=null) so we
 * never invent a trend from a single side.
 */
export function computePromptImprovements(
  rows: { observed_at: string; prompt_id: string; prompt_text: string; skipped: boolean; brand_mentioned: boolean | null }[],
  toDate: Date,
): PromptImprovement[] {
  const cutoff = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const byPrompt = new Map<string, { text: string; recent: number[]; prior: number[] }>();
  for (const r of rows) {
    if (r.skipped || r.brand_mentioned == null || !r.prompt_id) continue;
    if (!byPrompt.has(r.prompt_id)) byPrompt.set(r.prompt_id, { text: r.prompt_text, recent: [], prior: [] });
    const bucket = new Date(r.observed_at) >= cutoff ? "recent" : "prior";
    byPrompt.get(r.prompt_id)![bucket].push(r.brand_mentioned ? 1 : 0);
  }
  const rate = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) : null;
  return Array.from(byPrompt.entries())
    .map(([promptId, v]) => {
      const recentRate = rate(v.recent);
      const priorRate = rate(v.prior);
      const delta = recentRate != null && priorRate != null ? recentRate - priorRate : null;
      return { prompt_id: promptId, prompt_text: v.text, recentRate, priorRate, delta };
    })
    .filter((p) => p.delta != null)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
}

/** Aggregate mention rate across all buckets of a window (0..100, or null if no qualifying runs). */
export function overallRate(points: TrendPoint[]): number | null {
  const total = points.reduce((s, p) => s + p.total, 0);
  const mentioned = points.reduce((s, p) => s + p.mentioned, 0);
  if (total === 0) return null;
  return Math.round((mentioned / total) * 100);
}

/** Compare two windows' overall mention rates. before=A, after=B. delta=null if either window is empty. */
export function diffTrendWindows(
  windowA: TrendPoint[],
  windowB: TrendPoint[],
): { before: number | null; after: number | null; delta: number | null } {
  const before = overallRate(windowA);
  const after = overallRate(windowB);
  const delta = before != null && after != null ? after - before : null;
  return { before, after, delta };
}

// ---------- retention ----------

export type RetentionTier = "30d" | "365d" | "unlimited";

export function isRetentionTier(v: string | null | undefined): v is RetentionTier {
  return v === "30d" || v === "365d" || v === "unlimited";
}

/** Cutoff date before which data may be pruned; null = keep everything. */
export function computeRetentionCutoff(tier: string | null | undefined, now: Date): Date | null {
  if (tier === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (tier === "365d") return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  return null;
}

/** Normalize an AI answer into a comparable signature (for engine-change detection). */
export function normalizeResponse(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
}
