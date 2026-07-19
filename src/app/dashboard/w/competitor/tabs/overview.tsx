import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Overview — SoV vs your brand + prompts they're
// winning + latest engine snapshots. The whole "who is this
// competitor and where do I lose to them" answer in 15 seconds.
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
  const promptIds = ((prompts as { id: string; text: string }[] | null) ?? []).map((p) => p.id);
  const promptText = new Map(((prompts as { id: string; text: string }[] | null) ?? []).map((p) => [p.id, p.text]));

  let winningPrompts: { promptId: string; text: string; wins: number }[] = [];
  let latestMentions: { promptId: string; text: string; when: string; position: number | null }[] = [];

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
      (r.competitor_mentions ?? []).find(
        (m) => m.mentioned && m.name.toLowerCase() === nameLower,
      );

    // Prompts where THEY show up but you don't — the highest-value gaps.
    const winMap = new Map<string, number>();
    for (const r of rows) {
      const hit = isMention(r);
      if (!hit) continue;
      if (r.brand_mentioned === true) continue; // they mentioned + you also mentioned = split, not a "win against"
      winMap.set(r.prompt_id, (winMap.get(r.prompt_id) ?? 0) + 1);
    }
    winningPrompts = Array.from(winMap.entries())
      .map(([pid, wins]) => ({ promptId: pid, text: promptText.get(pid) ?? "prompt", wins }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);

    // Latest 5 mentions overall.
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

  const brandRate = 100 - (competitor.stats.vsYouGap7d ?? 0) - (competitor.stats.shareOfVoice7d ?? 0);
  const youShare = competitor.stats.shareOfVoice7d != null && competitor.stats.vsYouGap7d != null
    ? competitor.stats.shareOfVoice7d - competitor.stats.vsYouGap7d
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <p className="section-label">Competitor</p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{competitor.name}</h2>
            {competitor.domain && (
              <a
                href={`https://${competitor.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                {competitor.domain} ↗
              </a>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">SoV last 7d</p>
            <p className="text-2xl font-bold tracking-tight text-ink">
              {competitor.stats.shareOfVoice7d == null ? "—" : `${competitor.stats.shareOfVoice7d}%`}
            </p>
          </div>
        </div>

        {competitor.stats.vsYouGap7d != null && (
          <div className="mt-4 flex items-center gap-3">
            <SovBar competitorShare={competitor.stats.shareOfVoice7d ?? 0} youShare={youShare ?? 0} />
          </div>
        )}
      </section>

      {competitor.stats.vsYouGap7d != null && competitor.stats.vsYouGap7d > 0 && (
        <InsightCard
          variant="warning"
          title={`${competitor.name} is ${competitor.stats.vsYouGap7d}pp ahead of you last 7d`}
          description="Every point of gap is a prompt you're not being cited on. See the prompts below to prioritize which to fix first."
        />
      )}
      {competitor.stats.vsYouGap7d != null && competitor.stats.vsYouGap7d <= 0 && (
        <InsightCard
          variant="win"
          title={`You're leading ${competitor.name} by ${Math.abs(competitor.stats.vsYouGap7d)}pp last 7d`}
          description="Keep monitoring — schedule a weekly scan on this brand."
        />
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-ink">Prompts they win against you</h3>
          <span className="text-xs text-muted">{winningPrompts.length} prompts</span>
        </div>
        {winningPrompts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
            No prompts where they're winning against you.
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
                <span className="chip border-rose-200 bg-rose-50 text-rose-600">
                  {p.wins} win{p.wins === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                  <span>{new Date(m.when).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SovBar({ competitorShare, youShare }: { competitorShare: number; youShare: number }) {
  const total = Math.max(1, competitorShare + youShare);
  const compPct = Math.min(100, Math.round((competitorShare / total) * 100));
  const youPct = Math.min(100, Math.round((youShare / total) * 100));
  return (
    <div className="min-w-0 flex-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="bg-rose-500/80 transition-all"
          style={{ width: `${compPct}%` }}
          title={`Competitor ${competitorShare}%`}
        />
        <div
          className="bg-accent/70 transition-all"
          style={{ width: `${youPct}%` }}
          title={`You ${youShare}%`}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>Them {competitorShare}%</span>
        <span>You {Math.round(youShare)}%</span>
      </div>
    </div>
  );
}
