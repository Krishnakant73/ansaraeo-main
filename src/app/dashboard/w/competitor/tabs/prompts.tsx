import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Prompts — every tracked prompt scored by who wins:
//   • them-only (they mentioned, you didn't)     ← highest-value gap
//   • both mentioned                              ← contested
//   • you-only                                    ← you're winning
//   • neither                                     ← white space
// Ordered by them-only desc so the biggest gaps sit at the top.
// ============================================================

type Row = {
  prompt_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean }[] | null;
};

type Agg = {
  promptId: string;
  text: string;
  themOnly: number;
  both: number;
  youOnly: number;
  neither: number;
  total: number;
};

export default async function PromptsBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, intent")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptList = (prompts as { id: string; text: string; intent: string | null }[] | null) ?? [];
  const promptMap = new Map(promptList.map((p) => [p.id, p]));

  const promptIds = promptList.map((p) => p.id);
  let rows: Row[] = [];
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("prompt_id, brand_mentioned, competitor_mentions")
      .in("prompt_id", promptIds);
    rows = (runs as Row[] | null) ?? [];
  }

  const nameLower = competitor.name.toLowerCase();
  const agg = new Map<string, Agg>();
  for (const r of rows) {
    if (r.brand_mentioned === null) continue; // skipped
    const you = r.brand_mentioned === true;
    const them = (r.competitor_mentions ?? []).some(
      (m) => m.mentioned && m.name.toLowerCase() === nameLower,
    );
    const p = promptMap.get(r.prompt_id);
    if (!p) continue;
    const cur =
      agg.get(r.prompt_id) ??
      { promptId: r.prompt_id, text: p.text, themOnly: 0, both: 0, youOnly: 0, neither: 0, total: 0 };
    cur.total += 1;
    if (you && them) cur.both += 1;
    else if (them) cur.themOnly += 1;
    else if (you) cur.youOnly += 1;
    else cur.neither += 1;
    agg.set(r.prompt_id, cur);
  }

  const sorted = Array.from(agg.values())
    .filter((a) => a.themOnly + a.both > 0) // hide prompts they never showed up on
    .sort((a, b) => b.themOnly - a.themOnly || b.both - a.both);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Prompts</h2>
        <p className="mt-1 text-sm text-muted">
          Every tracked prompt where {competitor.name} shows up, ranked by how often they win
          against you.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">{competitor.name} hasn't been mentioned yet.</p>
          <p className="mt-1 text-xs text-muted">
            Run scans on more prompts to build competitive data.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Prompt</th>
                <th className="px-4 py-3 text-right font-semibold text-rose-600">They win</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">Contested</th>
                <th className="px-4 py-3 text-right font-semibold text-emerald-700">You win</th>
                <th className="px-4 py-3 text-right font-semibold">Runs</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 40).map((a) => (
                <tr key={a.promptId} className="border-b border-line/60 last:border-0 hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/w/prompt/${a.promptId}/overview`}
                      className="line-clamp-2 text-sm text-ink hover:text-accent"
                    >
                      {a.text}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {a.themOnly > 0 ? (
                      <span className="text-rose-600">{a.themOnly}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">{a.both}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {a.youOnly > 0 ? (
                      <span className="text-emerald-700">{a.youOnly}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">{a.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
