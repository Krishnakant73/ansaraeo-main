import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { ENGINE_META_MAP } from "@/lib/engine-workspace";

export const dynamic = "force-dynamic";

// ============================================================
// Engine × Competitor Matrix
//
// The crossroads view: rows = competitors (+ your brand), cols =
// active engines, cells = share-of-voice for that (competitor,
// engine) pair across the brand's scored runs.
//
// Answers "which competitor wins on which engine?" — a single
// glance surface for the pattern that the engine and competitor
// workspaces both hint at but neither pins down.
//
// Deterministic; reads visibility_runs.competitor_mentions +
// brand_mentioned. No LLM, no cache — recomputed per request.
// The dataset is bounded (≤500 prompts × ≤2000 recent runs).
// ============================================================

type RunRow = {
  engine_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions:
    | { name: string; mentioned: boolean; position: number | null }[]
    | null;
};

type EngineCol = { id: string; name: string; display: string };

type Cell = { share: number | null; hits: number; scored: number; avgPos: number | null };

export default async function EngineMatrixPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();

  const [enginesRes, competitorsRes, promptsRes] = await Promise.all([
    supabase.from("engines").select("id, name").eq("is_active", true),
    supabase
      .from("competitors")
      .select("id, name")
      .eq("brand_id", brand.id)
      .eq("confirmed", true)
      .limit(30),
    supabase.from("prompts").select("id").eq("brand_id", brand.id).limit(500),
  ]);
  const engines: EngineCol[] = (
    (enginesRes.data as { id: string; name: string }[] | null) ?? []
  ).map((e) => ({
    id: e.id,
    name: e.name,
    display: ENGINE_META_MAP[e.name]?.displayName ?? e.name,
  }));
  const competitors = (competitorsRes.data as { id: string; name: string }[] | null) ?? [];
  const promptIds = ((promptsRes.data as { id: string }[] | null) ?? []).map((p) => p.id);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <p className="section-label">Cross-tabulation</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Engine × Competitor matrix</h1>
          <p className="mt-1 text-sm text-muted">
            Which competitor wins on which engine for {brand.name}. Share of voice per pair,
            highest concentration first.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={`/dashboard/b/${slug}/visibility`}
            className="chip hover:border-accent/40 hover:text-ink"
          >
            Visibility
          </Link>
          <Link
            href={`/dashboard/b/${slug}/competitors`}
            className="chip hover:border-accent/40 hover:text-ink"
          >
            Competitors
          </Link>
        </div>
      </header>

      <MatrixBody
        brand={brand}
        engines={engines}
        competitors={competitors}
        promptIds={promptIds}
      />
    </div>
  );
}

async function MatrixBody({
  brand,
  engines,
  competitors,
  promptIds,
}: {
  brand: { id: string; name: string; slug: string };
  engines: EngineCol[];
  competitors: { id: string; name: string }[];
  promptIds: string[];
}) {
  if (engines.length === 0) {
    return (
      <EmptyStateCoach
        title="No active engines"
        description="Enable at least one engine before we can cross-tab it against competitors."
        action={{ label: "Manage engines", href: `/dashboard/w/engine` }}
      />
    );
  }
  if (promptIds.length === 0) {
    return (
      <EmptyStateCoach
        title="No prompts to score yet"
        description="Track a handful of prompts for this brand so we can measure share of voice."
        action={{ label: "Add prompts", href: `/dashboard/b/${brand.slug}/prompts` }}
      />
    );
  }

  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("engine_id, brand_mentioned, competitor_mentions")
    .in("prompt_id", promptIds)
    .limit(3000);
  const runList = (runs as RunRow[] | null) ?? [];
  const scoredTotal = runList.filter((r) => r.brand_mentioned !== null).length;

  if (scoredTotal === 0) {
    return (
      <EmptyStateCoach
        title="No scored runs yet"
        description={`Run visibility scans for ${brand.name} to populate the matrix.`}
        action={{ label: "Run visibility scan", href: `/dashboard/b/${brand.slug}/visibility` }}
      />
    );
  }

  // Aggregate per (row, engine) cell.
  //   rows: "brand" + one row per competitor
  //   cells[rowKey][engineId] = Cell
  const cells: Record<string, Record<string, Cell>> = {};
  const rowTotals: Record<string, { hits: number; scored: number }> = { brand: { hits: 0, scored: 0 } };
  for (const c of competitors) rowTotals[c.id] = { hits: 0, scored: 0 };

  // Prime empty cells so the render is deterministic even when a pair has 0 runs.
  for (const rowKey of ["brand", ...competitors.map((c) => c.id)]) {
    cells[rowKey] = {};
    for (const e of engines) {
      cells[rowKey][e.id] = { share: null, hits: 0, scored: 0, avgPos: null };
    }
  }

  // Per-engine scored counts (denominators).
  const scoredByEngine = new Map<string, number>();
  for (const r of runList) {
    if (r.brand_mentioned === null) continue;
    scoredByEngine.set(r.engine_id, (scoredByEngine.get(r.engine_id) ?? 0) + 1);
  }

  const nameToId = new Map(competitors.map((c) => [c.name.toLowerCase(), c.id]));

  // Accumulators for avg-position (positions[] per (row, engine)).
  const positions: Record<string, Record<string, number[]>> = {};
  for (const rowKey of ["brand", ...competitors.map((c) => c.id)]) {
    positions[rowKey] = {};
    for (const e of engines) positions[rowKey][e.id] = [];
  }

  for (const r of runList) {
    if (r.brand_mentioned === null) continue;
    if (r.brand_mentioned === true) {
      const c = cells.brand[r.engine_id];
      if (c) c.hits += 1;
      rowTotals.brand.hits += 1;
    }
    for (const m of r.competitor_mentions ?? []) {
      if (!m.mentioned) continue;
      const id = nameToId.get(m.name.toLowerCase());
      if (!id) continue;
      const cell = cells[id]?.[r.engine_id];
      if (cell) cell.hits += 1;
      const totals = rowTotals[id];
      if (totals) totals.hits += 1;
      if (typeof m.position === "number" && m.position > 0) {
        positions[id][r.engine_id]?.push(m.position);
      }
    }
  }

  // Populate scored + share + avgPos for each cell.
  for (const rowKey of ["brand", ...competitors.map((c) => c.id)]) {
    for (const e of engines) {
      const cell = cells[rowKey][e.id];
      const denom = scoredByEngine.get(e.id) ?? 0;
      cell.scored = denom;
      cell.share = denom > 0 ? Math.round((cell.hits / denom) * 100) : null;
      const pos = positions[rowKey][e.id];
      cell.avgPos = pos.length > 0 ? +(pos.reduce((a, b) => a + b, 0) / pos.length).toFixed(1) : null;
      rowTotals[rowKey === "brand" ? "brand" : rowKey].scored = scoredTotal;
    }
  }

  // Sort competitor rows by total mentions descending; brand always first.
  const orderedCompetitors = [...competitors].sort(
    (a, b) => (rowTotals[b.id]?.hits ?? 0) - (rowTotals[a.id]?.hits ?? 0),
  );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-10 min-w-[220px] bg-white px-4 py-3 font-semibold">
                Brand
              </th>
              {engines.map((e) => (
                <th key={e.id} className="px-3 py-3 text-center font-semibold">
                  <Link
                    href={`/dashboard/w/engine/${e.name}/overview`}
                    className="hover:text-accent"
                  >
                    {e.display}
                  </Link>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-semibold">Row total</th>
            </tr>
          </thead>
          <tbody>
            <MatrixRow
              rowLabel={brand.name}
              rowSubLabel="(you)"
              rowKey="brand"
              rowHref={`/dashboard/b/${brand.slug}/visibility`}
              cells={cells.brand}
              engines={engines}
              totalHits={rowTotals.brand.hits}
              totalScored={scoredTotal}
              youRow
            />
            {orderedCompetitors.map((c) => (
              <MatrixRow
                key={c.id}
                rowLabel={c.name}
                rowKey={c.id}
                rowHref={`/dashboard/w/competitor/${c.id}/overview`}
                cells={cells[c.id]}
                engines={engines}
                totalHits={rowTotals[c.id]?.hits ?? 0}
                totalScored={scoredTotal}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted">
        Cells show mention share of that (row, engine) pair across all scored runs — same
        denominator across a column, so columns are comparable but rows are not
        head-to-head. Click a competitor to open their workspace or an engine to open
        that engine&rsquo;s coverage view.
      </p>
    </>
  );
}

function MatrixRow({
  rowLabel,
  rowSubLabel,
  rowKey,
  rowHref,
  cells,
  engines,
  totalHits,
  totalScored,
  youRow,
}: {
  rowLabel: string;
  rowSubLabel?: string;
  rowKey: string;
  rowHref: string;
  cells: Record<string, Cell>;
  engines: EngineCol[];
  totalHits: number;
  totalScored: number;
  youRow?: boolean;
}) {
  const rowShare = totalScored > 0 ? Math.round((totalHits / (totalScored * engines.length)) * 100) : 0;
  return (
    <tr
      className={`border-b border-line/60 last:border-0 ${
        youRow ? "bg-accent/5" : "hover:bg-surface"
      }`}
    >
      <th
        scope="row"
        className={`sticky left-0 z-10 min-w-[220px] max-w-[280px] bg-inherit px-4 py-3 text-left ${
          youRow ? "font-semibold text-ink" : "font-normal text-ink"
        }`}
      >
        <Link href={rowHref} className="hover:text-accent">
          {rowLabel}
          {rowSubLabel && <span className="ml-1 text-[11px] text-accent">{rowSubLabel}</span>}
        </Link>
      </th>
      {engines.map((e) => {
        const cell = cells[e.id];
        return (
          <td key={`${rowKey}-${e.id}`} className="px-3 py-2 text-center">
            <MatrixCell cell={cell} />
          </td>
        );
      })}
      <td className="px-3 py-3 text-right font-mono text-xs text-muted">
        {totalHits === 0 ? "—" : `${rowShare}%`}
      </td>
    </tr>
  );
}

function MatrixCell({ cell }: { cell: Cell }) {
  if (cell.scored === 0) {
    return (
      <span
        aria-label="No scored runs"
        title="No scored runs on this engine"
        className="mx-auto block h-8 w-14 rounded border border-line bg-surface"
      />
    );
  }
  if (cell.hits === 0) {
    return (
      <span
        aria-label="No mentions"
        title={`0 of ${cell.scored} scored runs`}
        className="mx-auto block h-8 w-14 rounded border border-line bg-white text-[10px] leading-8 text-muted"
      >
        0%
      </span>
    );
  }
  const share = cell.share ?? 0;
  const tone =
    share >= 67 ? "bg-emerald-500/70 text-white"
    : share >= 34 ? "bg-amber-500/70 text-white"
    : "bg-rose-500/60 text-white";
  return (
    <span
      aria-label={`${share}% share`}
      title={`${cell.hits}/${cell.scored} runs${cell.avgPos != null ? ` · avg pos ${cell.avgPos}` : ""}`}
      className={`mx-auto flex h-8 w-14 items-center justify-center rounded font-mono text-[11px] font-semibold ${tone}`}
    >
      {share}%
    </span>
  );
}
