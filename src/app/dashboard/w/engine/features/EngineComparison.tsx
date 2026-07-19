import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { ENGINE_META_MAP, type Engine } from "@/lib/engine-workspace";

// ============================================================
// EngineComparison — small chart comparing THIS engine's mention
// rate + citation share against sibling active engines, scoped
// to the current brand.
//
// Server component; renders paired horizontal bars per engine.
// ============================================================

type RunRow = {
  id: string;
  engine_id: string;
  brand_mentioned: boolean | null;
};

type CitationRow = {
  run_id: string;
  is_own_domain: boolean | null;
};

export default async function EngineComparison({ engine }: { engine: Engine }) {
  const supabase = await createClient();

  const [enginesRes, promptsRes] = await Promise.all([
    supabase.from("engines").select("id, name").eq("is_active", true),
    supabase.from("prompts").select("id").eq("brand_id", engine.brand.id).limit(500),
  ]);
  const engines = (enginesRes.data as { id: string; name: string }[] | null) ?? [];
  const promptIds = ((promptsRes.data as { id: string }[] | null) ?? []).map((p) => p.id);

  if (promptIds.length === 0 || engines.length <= 1) {
    return (
      <EmptyStateCoach
        title="Not enough engines to compare"
        description="Activate more engines or run scans on the current brand's prompts to unlock side-by-side comparison."
        action={{
          label: "Run visibility scan",
          href: `/dashboard/b/${engine.brand.slug}/visibility`,
        }}
      />
    );
  }

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id, engine_id, brand_mentioned")
    .in("prompt_id", promptIds)
    .limit(3000);
  const runsList = (runs as RunRow[] | null) ?? [];

  let citList: CitationRow[] = [];
  if (runsList.length > 0) {
    const { data } = await supabase
      .from("citations")
      .select("run_id, is_own_domain")
      .in(
        "run_id",
        runsList.map((r) => r.id),
      );
    citList = (data as CitationRow[] | null) ?? [];
  }

  const byEngine = new Map<string, { scored: number; hits: number; cits: number; ownCits: number }>();
  for (const e of engines) byEngine.set(e.id, { scored: 0, hits: 0, cits: 0, ownCits: 0 });
  for (const r of runsList) {
    const b = byEngine.get(r.engine_id);
    if (!b) continue;
    if (r.brand_mentioned !== null) b.scored += 1;
    if (r.brand_mentioned === true) b.hits += 1;
  }
  const runEngine = new Map(runsList.map((r) => [r.id, r.engine_id]));
  for (const c of citList) {
    const engId = runEngine.get(c.run_id);
    if (!engId) continue;
    const b = byEngine.get(engId);
    if (!b) continue;
    b.cits += 1;
    if (c.is_own_domain === true) b.ownCits += 1;
  }

  const rows = engines
    .map((e) => {
      const b = byEngine.get(e.id)!;
      return {
        id: e.id,
        name: e.name,
        display: ENGINE_META_MAP[e.name]?.displayName ?? e.name,
        mention: b.scored > 0 ? Math.round((b.hits / b.scored) * 100) : null,
        cits: b.cits,
        ownShare: b.cits > 0 ? Math.round((b.ownCits / b.cits) * 100) : null,
      };
    })
    .sort((a, b) => (b.mention ?? -1) - (a.mention ?? -1));

  return (
    <section aria-label="Engine comparison" className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Engine comparison</p>
        <span className="text-[11px] text-muted">
          {engine.brand.name} · this brand&rsquo;s prompts
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((r) => {
          const isFocus = r.name === engine.name;
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-3 ${
                isFocus ? "border-accent bg-accent/5" : "border-line"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/dashboard/w/engine/${r.name}/overview`}
                  className="text-sm font-semibold text-ink hover:text-accent"
                >
                  {r.display}
                  {isFocus && <span className="ml-2 text-[11px] text-accent">(current)</span>}
                </Link>
                <span className="font-mono text-xs text-muted">
                  {r.mention == null ? "—" : `${r.mention}% mention`}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-[11px]">
                <BarRow label="Mention rate" value={r.mention} suffix="%" />
                <BarRow label="Own-citation share" value={r.ownShare} suffix="%" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BarRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-ink">
          {value == null ? "—" : `${value}${suffix ?? ""}`}
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-surface" aria-hidden>
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
        />
      </div>
    </div>
  );
}
