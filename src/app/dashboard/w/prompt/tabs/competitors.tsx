import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight } from "lucide-react";
import InsightCard from "@/workspace/primitives/InsightCard";
import type { Prompt } from "@/lib/prompt-workspace";

// ============================================================
// Prompt › Competitors — WHO else gets mentioned when AI engines
// answer THIS specific prompt. Aggregates the JSONB competitor_mentions
// arrays across every visibility_run for this prompt.
// ============================================================

type Row = {
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
  brand_mentioned: boolean | null;
};

type Agg = {
  name: string;
  mentions: number;
  positions: number[];
};

export default async function CompetitorsBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("competitor_mentions, brand_mentioned")
    .eq("prompt_id", prompt.id);

  const rows = (runs as Row[] | null) ?? [];
  const total = rows.filter((r) => r.brand_mentioned !== null).length;
  const brandMentions = rows.filter((r) => r.brand_mentioned === true).length;
  const brandShare = total > 0 ? Math.round((brandMentions / total) * 100) : 0;

  const agg = new Map<string, Agg>();
  for (const r of rows) {
    for (const m of r.competitor_mentions ?? []) {
      if (!m || !m.mentioned) continue;
      const cur = agg.get(m.name) ?? { name: m.name, mentions: 0, positions: [] };
      cur.mentions += 1;
      if (m.position != null) cur.positions.push(m.position);
      agg.set(m.name, cur);
    }
  }
  const sorted = Array.from(agg.values()).sort((a, b) => b.mentions - a.mentions);
  const top = sorted[0];
  const topShare = top && total > 0 ? Math.round((top.mentions / total) * 100) : 0;
  const gap = top ? topShare - brandShare : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Competitors on this prompt</h2>
        <p className="mt-1 text-sm text-muted">
          Across {total} run{total === 1 ? "" : "s"} of &ldquo;{prompt.text.slice(0, 60)}
          {prompt.text.length > 60 ? "…" : ""}&rdquo;.
        </p>
      </div>

      {top && gap > 0 && (
        <InsightCard
          variant="warning"
          title={`${top.name} is ${gap}pp ahead of you on this prompt`}
          description={`${top.name} appears in ${topShare}% of answers vs your ${brandShare}%. See the Optimization tab for draft answer blocks.`}
          meta={`${top.mentions} vs ${brandMentions} mentions`}
        />
      )}
      {top && gap <= 0 && brandMentions > 0 && (
        <InsightCard
          variant="win"
          title={`You're leading this prompt at ${brandShare}%`}
          description={`Ahead of ${top.name} (${topShare}%). Keep monitoring — schedule a weekly scan.`}
        />
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No competitor data yet.</p>
          <p className="mt-1 text-xs text-muted">Run a scan and add competitors on the Brand workspace.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Competitor</th>
                <th className="px-4 py-3 text-right font-semibold">Mentions</th>
                <th className="px-4 py-3 text-right font-semibold">Share</th>
                <th className="px-4 py-3 text-right font-semibold">Avg position</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60 bg-accent/5">
                <td className="px-4 py-3 font-semibold text-ink">
                  {prompt.brand.name} <span className="ml-1 text-xs text-accent">(you)</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-ink">{brandMentions}</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-ink">{brandShare}%</td>
                <td className="px-4 py-3 text-right text-xs text-muted">—</td>
                <td className="px-4 py-3"></td>
              </tr>
              {sorted.slice(0, 15).map((c) => {
                const share = total > 0 ? Math.round((c.mentions / total) * 100) : 0;
                const avgPos =
                  c.positions.length > 0
                    ? (c.positions.reduce((a, b) => a + b, 0) / c.positions.length).toFixed(1)
                    : "—";
                return (
                  <tr key={c.name} className="border-b border-line/60 last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 text-ink">{c.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink">{c.mentions}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink">{share}%</td>
                    <td className="px-4 py-3 text-right text-xs text-muted">{avgPos}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/w/brand/${prompt.brand.slug}/competitors`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                      >
                        Details <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
