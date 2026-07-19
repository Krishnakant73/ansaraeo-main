import { createClient } from "@/lib/supabase/server";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Competitors — competitor share-of-voice on THIS engine,
// aggregated over the brand's prompts. Answers "who does <engine>
// prefer to recommend for our category?"
// ============================================================

type Row = {
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

type Agg = { name: string; mentions: number; positions: number[] };

export default async function CompetitorsBody({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

  let rows: Row[] = [];
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("brand_mentioned, competitor_mentions")
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds);
    rows = (runs as Row[] | null) ?? [];
  }
  const nonSkipped = rows.filter((r) => r.brand_mentioned !== null);
  const total = nonSkipped.length;
  const brandMentions = nonSkipped.filter((r) => r.brand_mentioned === true).length;
  const brandShare = total > 0 ? Math.round((brandMentions / total) * 100) : 0;

  const agg = new Map<string, Agg>();
  for (const r of nonSkipped) {
    for (const m of r.competitor_mentions ?? []) {
      if (!m.mentioned) continue;
      const cur = agg.get(m.name) ?? { name: m.name, mentions: 0, positions: [] };
      cur.mentions += 1;
      if (m.position != null && m.position > 0) cur.positions.push(m.position);
      agg.set(m.name, cur);
    }
  }
  const sorted = Array.from(agg.values()).sort((a, b) => b.mentions - a.mentions);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Who wins on {engine.displayName}</h2>
        <p className="mt-1 text-sm text-muted">
          Share of voice across {total} scored run{total === 1 ? "" : "s"} on {engine.displayName}.
        </p>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No scored runs yet.</p>
        </div>
      ) : (
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
                  {engine.brand.name} <span className="ml-1 text-xs text-accent">(you)</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-ink">{brandShare}%</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-ink">{brandMentions}</td>
                <td className="px-4 py-3 text-right text-xs text-muted">—</td>
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
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink">{share}%</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted">{c.mentions}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted">{avgPos}</td>
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
