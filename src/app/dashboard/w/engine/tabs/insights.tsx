import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Insights — aggregate observations for this engine × brand:
//   1. Share of voice — competitor mentions across all runs on this
//      engine (the old competitors.tsx table).
//   2. Deterministic observations — three high-signal takeaways
//      derived from the run data (e.g. "Own-citation share is high,
//      but position averages 4+ — you're cited but not top-of-answer").
//
// Replaces the old competitors.tsx (deleted in this migration).
// ============================================================

type Row = {
  brand_mentioned: boolean | null;
  brand_position: number | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

type CompetitorAgg = { name: string; mentions: number; positions: number[] };

type CitationCounts = { total: number; own: number };

type Observation = {
  key: string;
  tone: "info" | "warn" | "win";
  title: string;
  detail: string;
};

const TONE_CLASSES: Record<Observation["tone"], string> = {
  info: "border-line bg-white",
  warn: "border-amber-200 bg-amber-50/60",
  win: "border-emerald-200 bg-emerald-50/60",
};

export default async function InsightsBody({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

  let rows: Row[] = [];
  let citationCounts: CitationCounts = { total: 0, own: 0 };
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, brand_mentioned, brand_position, competitor_mentions")
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds)
      .limit(2000);
    const runRows = (runs as (Row & { id: string })[] | null) ?? [];
    rows = runRows;

    if (runRows.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select("is_own_domain")
        .in(
          "run_id",
          runRows.map((r) => r.id),
        );
      const c = (cits as { is_own_domain: boolean | null }[] | null) ?? [];
      citationCounts = {
        total: c.length,
        own: c.filter((x) => x.is_own_domain === true).length,
      };
    }
  }

  const nonSkipped = rows.filter((r) => r.brand_mentioned !== null);
  const total = nonSkipped.length;
  const brandHits = nonSkipped.filter((r) => r.brand_mentioned === true).length;
  const brandShare = total > 0 ? Math.round((brandHits / total) * 100) : 0;

  const agg = new Map<string, CompetitorAgg>();
  for (const r of nonSkipped) {
    for (const m of r.competitor_mentions ?? []) {
      if (!m.mentioned) continue;
      const cur = agg.get(m.name) ?? { name: m.name, mentions: 0, positions: [] };
      cur.mentions += 1;
      if (m.position != null && m.position > 0) cur.positions.push(m.position);
      agg.set(m.name, cur);
    }
  }
  const competitors = Array.from(agg.values()).sort((a, b) => b.mentions - a.mentions);

  const observations: Observation[] = buildObservations({
    engine,
    total,
    brandShare,
    competitors,
    brandPositions: nonSkipped
      .map((r) => r.brand_position)
      .filter((p): p is number => typeof p === "number" && p > 0),
    citationCounts,
  });

  if (total === 0) {
    return (
      <EmptyStateCoach
        title="Nothing to observe yet"
        description={`Run scans on ${engine.displayName} for ${engine.brand.name} to unlock share-of-voice and observations.`}
        action={{
          label: "Run visibility scan",
          href: `/dashboard/b/${engine.brand.slug}/visibility`,
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-ink">Insights on {engine.displayName}</h2>
        <p className="mt-1 text-sm text-muted">
          Share of voice across {total} scored run{total === 1 ? "" : "s"}, plus deterministic
          observations from what the runs actually say.
        </p>
      </header>

      {observations.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-3">
          {observations.map((o) => (
            <li key={o.key} className={`rounded-2xl border p-4 ${TONE_CLASSES[o.tone]}`}>
              <p className="text-sm font-semibold text-ink">{o.title}</p>
              <p className="mt-1 text-xs text-ink/80">{o.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-3 font-semibold">Brand</th>
              <th className="px-4 py-3 text-right font-semibold">Share</th>
              <th className="px-4 py-3 text-right font-semibold">Mentions</th>
              <th className="px-4 py-3 text-right font-semibold">Avg pos</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/60 bg-accent/5">
              <td className="px-4 py-3 font-semibold text-ink">
                {engine.brand.name}
                <span className="ml-1 text-xs text-accent">(you)</span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-ink">{brandShare}%</td>
              <td className="px-4 py-3 text-right font-mono text-xs text-ink">{brandHits}</td>
              <td className="px-4 py-3 text-right text-xs text-muted">
                {engine.stats.avgPosition ?? "—"}
              </td>
            </tr>
            {competitors.slice(0, 15).map((c) => {
              const share = total > 0 ? Math.round((c.mentions / total) * 100) : 0;
              const avgPos =
                c.positions.length > 0
                  ? (c.positions.reduce((a, b) => a + b, 0) / c.positions.length).toFixed(1)
                  : "—";
              return (
                <tr key={c.name} className="border-b border-line/60 last:border-0 hover:bg-surface">
                  <td className="px-4 py-3 text-ink">
                    <Link
                      href={`/dashboard/b/${engine.brand.slug}/competitors`}
                      className="hover:text-accent"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink">{share}%</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                    {c.mentions}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">{avgPos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Deterministic observations — plain rules, no LLM. Each returns
// null when its trigger is absent so we don't emit a hollow card.
function buildObservations(input: {
  engine: Engine;
  total: number;
  brandShare: number;
  competitors: CompetitorAgg[];
  brandPositions: number[];
  citationCounts: CitationCounts;
}): Observation[] {
  const { engine, total, brandShare, competitors, brandPositions, citationCounts } = input;
  const out: Observation[] = [];

  // 1. Cited-but-not-quoted paradox.
  const ownShare =
    citationCounts.total > 0
      ? Math.round((citationCounts.own / citationCounts.total) * 100)
      : 0;
  const avgPos =
    brandPositions.length > 0
      ? brandPositions.reduce((a, b) => a + b, 0) / brandPositions.length
      : null;
  if (ownShare >= 50 && avgPos != null && avgPos > 3) {
    out.push({
      key: "cited-not-quoted",
      tone: "warn",
      title: "Cited but not top-of-answer",
      detail: `${engine.displayName} cites your domain in ${ownShare}% of runs but averages you at rank ${avgPos.toFixed(1)}. Rework the answer opener so you're the quoted line, not the footnote.`,
    });
  }

  // 2. Runaway competitor.
  const top = competitors[0];
  if (top && total > 0) {
    const topShare = Math.round((top.mentions / total) * 100);
    if (topShare > brandShare + 20) {
      out.push({
        key: "runaway-competitor",
        tone: "warn",
        title: `${top.name} dominates on ${engine.displayName}`,
        detail: `They lead you by ${topShare - brandShare}pp of scored runs (${topShare}% vs ${brandShare}%). Open their workspace to see why.`,
      });
    }
  }

  // 3. Engine-doesn't-cite acknowledgment.
  if (!engine.meta.cites && citationCounts.total === 0) {
    out.push({
      key: "non-citing-engine",
      tone: "info",
      title: `${engine.displayName} rarely cites`,
      detail: "Optimize for being IN the answer, not linked to. FAQ pages + comparison content earn mentions here.",
    });
  }

  // 4. Positive: you outperform your cross-engine average.
  if (engine.stats.mentionRate != null && engine.stats.mentionRate7d != null) {
    // Note: cross-engine avg isn't in this scope; use the 7d delta as a proxy for direction.
    if ((engine.stats.mentionRate7dDelta ?? 0) >= 8) {
      out.push({
        key: "trending-up",
        tone: "win",
        title: `Trending up ${engine.stats.mentionRate7dDelta}pp`,
        detail: `Whatever you shipped is landing on ${engine.displayName} — worth doubling down.`,
      });
    }
  }

  return out.slice(0, 3);
}
