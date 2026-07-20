import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// engine-change-log — detects step-changes in engine behavior and
// merges them with any manual annotations from engine_change_events.
//
// The detectors are deterministic (rolling means, absolute pp shifts)
// so a "change" is reproducible. The AI Change Log tab renders these
// as a timeline — every entry has enough evidence to click through
// to the underlying runs.
// ============================================================

export type EngineChangeKind =
  | "baseline_drift"
  | "citation_shift"
  | "format_shift"
  | "manual";

export type EngineChangeEvent = {
  at: string;                       // ISO date at midday UTC (for stable sort)
  kind: EngineChangeKind;
  magnitude: number | null;         // pp for drifts, points for format_shift
  summary: string;
  evidence_run_ids: string[];
  source: "detected" | "recorded";  // detected = derived here, recorded = engine_change_events row
};

type SnapshotRow = {
  captured_on: string;              // yyyy-mm-dd
  mention_rate: number | null;
  own_citation_share: number | null;
};

type EventRow = {
  occurred_on: string;
  kind: string;
  magnitude: number | null;
  summary: string;
  evidence_run_ids: string[] | null;
};

// Public entry point.
export async function detectEngineChanges(
   
  supabase: SupabaseClient<any, "public", any>,
  engineId: string,
  brandId: string,
): Promise<EngineChangeEvent[]> {
  const [snapshotsRes, eventsRes] = await Promise.all([
    supabase
      .from("engine_snapshots")
      .select("captured_on, mention_rate, own_citation_share")
      .eq("engine_id", engineId)
      .eq("brand_id", brandId)
      .order("captured_on", { ascending: false })
      .limit(60),
    supabase
      .from("engine_change_events")
      .select("occurred_on, kind, magnitude, summary, evidence_run_ids")
      .eq("engine_id", engineId)
      .or(`brand_id.eq.${brandId},brand_id.is.null`)
      .order("occurred_on", { ascending: false })
      .limit(50),
  ]);

  const snapshots = ((snapshotsRes.data as SnapshotRow[] | null) ?? []).slice().sort(
    (a, b) => (a.captured_on < b.captured_on ? -1 : 1),
  ); // ascending for windowed math
  const events = (eventsRes.data as EventRow[] | null) ?? [];

  const detected: EngineChangeEvent[] = [
    ...detectMentionRateDrift(snapshots),
    ...detectCitationShift(snapshots),
  ];
  const recorded: EngineChangeEvent[] = events.map((e) => ({
    at: `${e.occurred_on}T12:00:00Z`,
    kind: (e.kind as EngineChangeKind) ?? "manual",
    magnitude: e.magnitude ?? null,
    summary: e.summary,
    evidence_run_ids: e.evidence_run_ids ?? [],
    source: "recorded",
  }));

  // De-dupe on (kind, day) — a manual annotation takes precedence over
  // a same-day detection.
  const bucket = new Map<string, EngineChangeEvent>();
  for (const d of detected) bucket.set(bucketKey(d), d);
  for (const r of recorded) bucket.set(bucketKey(r), r);

  return Array.from(bucket.values()).sort((a, b) => (a.at < b.at ? 1 : -1));
}

function bucketKey(e: EngineChangeEvent): string {
  return `${e.kind}:${e.at.slice(0, 10)}`;
}

// Baseline drift — 7-day rolling mention rate shifts ≥ 8pp vs prior 14d.
export function detectMentionRateDrift(snapshots: SnapshotRow[]): EngineChangeEvent[] {
  const out: EngineChangeEvent[] = [];
  const days = snapshots.filter((s) => s.mention_rate != null);
  if (days.length < 21) return out;

  for (let i = 20; i < days.length; i++) {
    const cur7 = days.slice(i - 6, i + 1).map((d) => Number(d.mention_rate));
    const prior14 = days.slice(i - 20, i - 6).map((d) => Number(d.mention_rate));
    const curMean = mean(cur7);
    const priorMean = mean(prior14);
    const delta = curMean - priorMean;
    if (Math.abs(delta) < 8) continue;
    out.push({
      at: `${days[i].captured_on}T12:00:00Z`,
      kind: "baseline_drift",
      magnitude: round1(delta),
      summary:
        delta > 0
          ? `Mention rate jumped ${round1(delta)}pp vs the prior two weeks — something you did is landing.`
          : `Mention rate slid ${round1(Math.abs(delta))}pp vs the prior two weeks — investigate what changed.`,
      evidence_run_ids: [],
      source: "detected",
    });
  }
  return dedupeAdjacent(out);
}

// Citation shift — own-citation-share moves ≥ 10pp week-over-week.
export function detectCitationShift(snapshots: SnapshotRow[]): EngineChangeEvent[] {
  const out: EngineChangeEvent[] = [];
  const days = snapshots.filter((s) => s.own_citation_share != null);
  if (days.length < 14) return out;

  for (let i = 13; i < days.length; i++) {
    const cur = mean(days.slice(i - 6, i + 1).map((d) => Number(d.own_citation_share)));
    const prev = mean(days.slice(i - 13, i - 6).map((d) => Number(d.own_citation_share)));
    const delta = cur - prev;
    if (Math.abs(delta) < 10) continue;
    out.push({
      at: `${days[i].captured_on}T12:00:00Z`,
      kind: "citation_shift",
      magnitude: round1(delta),
      summary:
        delta > 0
          ? `Own-domain citation share up ${round1(delta)}pp this week — the engine is trusting your pages more.`
          : `Own-domain citation share fell ${round1(Math.abs(delta))}pp — a source you owned may have dropped out.`,
      evidence_run_ids: [],
      source: "detected",
    });
  }
  return dedupeAdjacent(out);
}

// Collapse consecutive same-kind events so a slow drift doesn't spam.
function dedupeAdjacent(events: EngineChangeEvent[]): EngineChangeEvent[] {
  const out: EngineChangeEvent[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (last && last.kind === e.kind) {
      // Same day → keep the more-recent; adjacent day within 3 → skip.
      const dayA = new Date(last.at).getTime();
      const dayB = new Date(e.at).getTime();
      if (Math.abs(dayB - dayA) < 3 * 86_400_000) continue;
    }
    out.push(e);
  }
  return out;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
