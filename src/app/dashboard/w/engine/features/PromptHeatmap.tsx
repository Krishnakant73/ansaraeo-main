import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// PromptHeatmap — SVG grid, one cell per (prompt × week) for the
// last 8 weeks. Tone = mention rate; cells are click-through to
// the prompt workspace.
//
// Ships as a server component (no interactivity needed beyond
// hover title + link); the parent Prompt Coverage tab renders it
// behind a toggle to preserve the existing table view.
// ============================================================

type RunRow = {
  prompt_id: string;
  run_at: string;
  brand_mentioned: boolean | null;
};

const WEEKS_BACK = 8;

export default async function PromptHeatmap({ engine }: { engine: Engine }) {
  const supabase = await createClient();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", engine.brand.id)
    .order("priority", { ascending: false })
    .limit(30);
  const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
  if (promptList.length === 0) {
    return (
      <EmptyStateCoach
        title="No prompts to plot"
        description="Track a handful of prompts for this brand to see engine coverage by week."
        action={{ label: "Manage prompts", href: `/dashboard/b/${engine.brand.slug}/prompts` }}
      />
    );
  }

  const eightWeeksAgo = new Date(Date.now() - WEEKS_BACK * 7 * 86_400_000).toISOString();
  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("prompt_id, run_at, brand_mentioned")
    .eq("engine_id", engine.id)
    .in(
      "prompt_id",
      promptList.map((p) => p.id),
    )
    .gte("run_at", eightWeeksAgo);

  const rows = (runs as RunRow[] | null) ?? [];
  if (rows.length === 0) {
    return (
      <EmptyStateCoach
        title="No runs to heatmap yet"
        description={`Run visibility scans on ${engine.displayName} — a heatmap needs history.`}
        action={{ label: "Run visibility scan", href: `/dashboard/b/${engine.brand.slug}/visibility` }}
      />
    );
  }

  // Column labels: 8 week-starts, oldest → newest.
  const weeks: string[] = [];
  {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - diff);
    for (let i = WEEKS_BACK - 1; i >= 0; i--) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() - i * 7);
      weeks.push(d.toISOString().slice(0, 10));
    }
  }

  const bucket = new Map<string, { hits: number; total: number }>();
  for (const r of rows) {
    if (r.brand_mentioned === null) continue;
    const week = isoWeekStart(new Date(r.run_at));
    const key = `${r.prompt_id}::${week}`;
    const cur = bucket.get(key) ?? { hits: 0, total: 0 };
    cur.total += 1;
    if (r.brand_mentioned === true) cur.hits += 1;
    bucket.set(key, cur);
  }

  return (
    <section aria-label={`Prompt heatmap on ${engine.displayName}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-label">Prompt heatmap · 8 weeks</p>
        <p className="text-[11px] text-muted">
          Green = mentioned · Amber = mixed · Rose = missed · Grey = no runs
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-10 min-w-[220px] bg-white px-3 py-2 font-semibold">
                Prompt
              </th>
              {weeks.map((w) => (
                <th key={w} className="px-2 py-2 text-center font-semibold" scope="col">
                  {new Date(w).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {promptList.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-[220px] max-w-[280px] bg-white px-3 py-2 text-left"
                >
                  <Link
                    href={`/dashboard/w/prompt/${p.id}/overview`}
                    className="line-clamp-2 font-normal text-ink hover:text-accent"
                  >
                    {p.text}
                  </Link>
                </th>
                {weeks.map((w) => {
                  const cell = bucket.get(`${p.id}::${w}`);
                  return (
                    <td key={w} className="px-1.5 py-1.5 text-center">
                      <HeatmapCell hits={cell?.hits ?? 0} total={cell?.total ?? 0} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeatmapCell({ hits, total }: { hits: number; total: number }) {
  if (total === 0) {
    return (
      <span
        aria-label="No runs"
        title="No runs"
        className="mx-auto block h-5 w-5 rounded bg-surface"
      />
    );
  }
  const rate = hits / total;
  const cls =
    rate >= 0.67
      ? "bg-emerald-500/70"
      : rate >= 0.34
        ? "bg-amber-500/70"
        : "bg-rose-500/70";
  return (
    <span
      aria-label={`${Math.round(rate * 100)}% mention rate (${hits}/${total})`}
      title={`${hits}/${total} = ${Math.round(rate * 100)}%`}
      className={`mx-auto block h-5 w-5 rounded ${cls}`}
    />
  );
}

function isoWeekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}
