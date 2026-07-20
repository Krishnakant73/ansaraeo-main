import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import { ThreatPill, levelFromScore, EvidenceChip } from "@/workspace/primitives";
import { scoreCompetitorThreat } from "@/lib/competitor-traits";
import { computeCompetitorDna } from "@/lib/competitor-dna";
import CompetitorDna from "../features/CompetitorDna";
import BattleSimulator from "../features/BattleSimulator";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Overview — the "why are they winning" surface.
//
// Composition:
//   • Threat pill + one-sentence verdict (auto-derived)
//   • Where they beat you: prompts × engines matrix
//   • Why they win: top 3 auto-derived contributors
//   • Competitor DNA glyph (six axes with your brand overlaid)
//   • Latest mentions
//
// Everything is derived from recorded runs / citations. No LLM
// synthesis is used at this layer — verdict copy is a template
// populated with real deltas.
// ============================================================

type Row = {
  run_at: string;
  prompt_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

export default async function OverviewBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptList = ((prompts as { id: string; text: string }[] | null) ?? []);
  const promptIds = promptList.map((p) => p.id);
  const promptText = new Map(promptList.map((p) => [p.id, p.text]));

  let winningPrompts: { promptId: string; text: string; wins: number }[] = [];
  const latestMentions: { promptId: string; text: string; when: string; position: number | null }[] = [];

  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("run_at, prompt_id, brand_mentioned, competitor_mentions")
      .in("prompt_id", promptIds)
      .order("run_at", { ascending: false })
      .limit(400);
    const rows = (runs as Row[] | null) ?? [];
    const nameLower = competitor.name.toLowerCase();
    const isMention = (r: Row) =>
      (r.competitor_mentions ?? []).find((m) => m.mentioned && m.name.toLowerCase() === nameLower);

    const winMap = new Map<string, number>();
    for (const r of rows) {
      const hit = isMention(r);
      if (!hit) continue;
      if (r.brand_mentioned === true) continue;
      winMap.set(r.prompt_id, (winMap.get(r.prompt_id) ?? 0) + 1);
    }
    winningPrompts = Array.from(winMap.entries())
      .map(([pid, wins]) => ({ promptId: pid, text: promptText.get(pid) ?? "prompt", wins }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);

    for (const r of rows) {
      const hit = isMention(r);
      if (!hit) continue;
      latestMentions.push({
        promptId: r.prompt_id,
        text: promptText.get(r.prompt_id) ?? "prompt",
        when: r.run_at,
        position: hit.position ?? null,
      });
      if (latestMentions.length >= 5) break;
    }
  }

  const threat = scoreCompetitorThreat({
    gapPp: competitor.stats.vsYouGap7d,
    citationShareDeltaPp: null,
    positionLead: null,
    contentVelocityRatio: null,
    forecastCrossoverIn: null,
  });
  const level = levelFromScore(threat.score);

  // DNA is one extra query; run in parallel with the overview data.
   
  const dna = await computeCompetitorDna(supabase as any, {
    id: competitor.id,
    brand_id: competitor.brand_id,
    name: competitor.name,
    domain: competitor.domain,
  });

  const verdict =
    competitor.stats.vsYouGap7d == null
      ? `Not enough recent runs to say who's winning against ${competitor.name}.`
      : competitor.stats.vsYouGap7d > 10
        ? `Losing to ${competitor.name} — ${competitor.stats.vsYouGap7d}pp behind on 7d mention rate.`
        : competitor.stats.vsYouGap7d > 0
          ? `Slightly behind ${competitor.name} (${competitor.stats.vsYouGap7d}pp).`
          : `Leading ${competitor.name} by ${Math.abs(competitor.stats.vsYouGap7d)}pp on 7d mention rate.`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ThreatPill level={level} score={threat.score} />
              <p className="section-label">Verdict</p>
            </div>
            <p className="mt-2 text-base text-ink">{verdict}</p>
          </div>
          <BattleSimulator competitorId={competitor.id} competitorName={competitor.name} />
        </div>

        {threat.components.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Threat score components">
            {threat.components.map((c) => (
              <li key={c.label}>
                <span className="chip" title={`${c.label}: contributes ${(c.contribution * c.weight).toFixed(0)} of the score`}>
                  {c.label}
                  <span className="ml-1 text-muted">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {competitor.stats.vsYouGap7d != null && competitor.stats.vsYouGap7d > 0 ? (
        <InsightCard
          variant="warning"
          title={`${competitor.name} leads by ${competitor.stats.vsYouGap7d}pp last 7d`}
          description="Every point of gap is a prompt you're not being cited on. See the prompts below to prioritize which to fix first."
        />
      ) : competitor.stats.vsYouGap7d != null ? (
        <InsightCard
          variant="win"
          title={`You lead ${competitor.name} by ${Math.abs(competitor.stats.vsYouGap7d)}pp last 7d`}
          description="Keep monitoring — a nightly scan on this brand is enough to catch regressions early."
        />
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-ink">Prompts they win against you</h3>
          <span className="text-xs text-muted">{winningPrompts.length} prompts</span>
        </div>
        {winningPrompts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
            No prompts where they&rsquo;re winning against you.
          </div>
        ) : (
          <ul className="space-y-2">
            {winningPrompts.map((p) => (
              <li
                key={p.promptId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3"
              >
                <Link
                  href={`/dashboard/w/prompt/${p.promptId}/overview`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent"
                >
                  {p.text}
                </Link>
                <div className="flex items-center gap-2">
                  <EvidenceChip parts={[`${p.wins} run${p.wins === 1 ? "" : "s"}`]} />
                  <span className="chip border-rose-200 bg-rose-50 text-rose-600">
                    {p.wins} win{p.wins === 1 ? "" : "s"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CompetitorDna competitor={competitor} them={dna.them} you={dna.you} />

      {latestMentions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-ink">Latest mentions</h3>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {latestMentions.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 p-3">
                <Link
                  href={`/dashboard/w/prompt/${m.promptId}/overview`}
                  className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent"
                >
                  {m.text}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {m.position != null && <span className="chip">#{m.position}</span>}
                  <time dateTime={m.when}>{new Date(m.when).toLocaleDateString()}</time>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
