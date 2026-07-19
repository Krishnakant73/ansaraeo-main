import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PromptHeatmap from "../features/PromptHeatmap";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Prompts — mention rate per tracked prompt on this engine.
// Rank descending by miss count so the most impactful gaps sit at
// the top; sample winning prompts show at the bottom.
// ============================================================

type Row = {
  prompt_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
};

type Agg = {
  promptId: string;
  text: string;
  total: number;
  wins: number;
  positions: number[];
};

export default async function PromptsBody({
  engine,
  searchParams,
}: {
  engine: Engine;
  searchParams?: URLSearchParams;
}) {
  const view = (searchParams?.get("view") ?? "table") as "table" | "heatmap";
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, intent")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptList =
    (prompts as { id: string; text: string; intent: string | null }[] | null) ?? [];
  const promptMap = new Map(promptList.map((p) => [p.id, p]));
  const promptIds = promptList.map((p) => p.id);

  let rows: Row[] = [];
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("prompt_id, brand_mentioned, brand_position")
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds);
    rows = (runs as Row[] | null) ?? [];
  }

  const agg = new Map<string, Agg>();
  for (const r of rows) {
    if (r.brand_mentioned === null) continue;
    const p = promptMap.get(r.prompt_id);
    if (!p) continue;
    const cur =
      agg.get(r.prompt_id) ??
      ({ promptId: r.prompt_id, text: p.text, total: 0, wins: 0, positions: [] } as Agg);
    cur.total += 1;
    if (r.brand_mentioned === true) cur.wins += 1;
    if (r.brand_position != null && r.brand_position > 0) cur.positions.push(r.brand_position);
    agg.set(r.prompt_id, cur);
  }
  const sorted = Array.from(agg.values())
    .filter((a) => a.total > 0)
    .sort((a, b) => a.wins / a.total - b.wins / b.total); // worst rate first

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Prompt coverage on {engine.displayName}</h2>
          <p className="mt-1 text-sm text-muted">
            {view === "heatmap"
              ? `Mention rate per prompt × week for the last 8 weeks.`
              : `Every tracked prompt scored on ${engine.displayName}, worst gaps first.`}
          </p>
        </div>
        <nav aria-label="Prompt view" className="flex gap-1.5">
          <Link
            href={`/dashboard/w/engine/${engine.name}/prompts`}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              view === "table"
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-muted hover:border-accent/40 hover:text-ink"
            }`}
            aria-current={view === "table" ? "true" : undefined}
          >
            Table
          </Link>
          <Link
            href={`/dashboard/w/engine/${engine.name}/prompts?view=heatmap`}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              view === "heatmap"
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-muted hover:border-accent/40 hover:text-ink"
            }`}
            aria-current={view === "heatmap" ? "true" : undefined}
          >
            Heatmap
          </Link>
        </nav>
      </div>
      {view === "heatmap" ? (
        <PromptHeatmap engine={engine} />
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No scored runs on {engine.displayName} yet.</p>
          <p className="mt-1 text-xs text-muted">Run a scan on any prompt to populate this view.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Prompt</th>
                <th className="px-4 py-3 text-right font-semibold">Rate</th>
                <th className="px-4 py-3 text-right font-semibold">Wins</th>
                <th className="px-4 py-3 text-right font-semibold">Runs</th>
                <th className="px-4 py-3 text-right font-semibold">Avg pos</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 60).map((a) => {
                const rate = Math.round((a.wins / a.total) * 100);
                const avgPos =
                  a.positions.length > 0
                    ? (a.positions.reduce((x, y) => x + y, 0) / a.positions.length).toFixed(1)
                    : "—";
                return (
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
                      <span
                        className={
                          rate === 0
                            ? "text-rose-600"
                            : rate < 34
                              ? "text-amber-600"
                              : rate < 67
                                ? "text-ink"
                                : "text-emerald-700"
                        }
                      >
                        {rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted">{a.wins}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted">{a.total}</td>
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
