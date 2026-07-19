import { createClient } from "@/lib/supabase/server";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Battlecard — sentiment + position ladder + engine
// breakdown. Everything is deterministic — sourced from the JSONB
// competitor_mentions arrays on the brand's visibility_runs, no LLM
// synthesis. If the "AI battlecard" endpoint exists it can slot in
// later as a section here without touching this file's shape.
// ============================================================

type Row = {
  engine_id: string;
  competitor_mentions:
    | { name: string; mentioned: boolean; position: number | null }[]
    | null;
  brand_mentioned: boolean | null;
};

export default async function BattlecardBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

  let rows: Row[] = [];
  const engineMap = new Map<string, string>();
  if (promptIds.length > 0) {
    const [runsRes, enginesRes] = await Promise.all([
      supabase
        .from("visibility_runs")
        .select("engine_id, competitor_mentions, brand_mentioned")
        .in("prompt_id", promptIds),
      supabase.from("engines").select("id, name"),
    ]);
    rows = (runsRes.data as Row[] | null) ?? [];
    for (const e of (enginesRes.data as { id: string; name: string }[] | null) ?? []) {
      engineMap.set(e.id, e.name);
    }
  }

  const nameLower = competitor.name.toLowerCase();
  const positions: number[] = [];
  const perEngine = new Map<string, { total: number; them: number; you: number }>();

  for (const r of rows) {
    if (r.brand_mentioned === null) continue;
    const engineName = engineMap.get(r.engine_id) ?? "unknown";
    const cur = perEngine.get(engineName) ?? { total: 0, them: 0, you: 0 };
    cur.total += 1;
    if (r.brand_mentioned === true) cur.you += 1;
    const hit = (r.competitor_mentions ?? []).find(
      (m) => m.mentioned && m.name.toLowerCase() === nameLower,
    );
    if (hit) {
      cur.them += 1;
      if (hit.position != null && hit.position > 0) positions.push(hit.position);
    }
    perEngine.set(engineName, cur);
  }
  positions.sort((a, b) => a - b);
  const avgPos =
    positions.length > 0
      ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)
      : "—";
  const bestPos = positions.length > 0 ? String(positions[0]) : "—";
  const p50Pos = positions.length > 0 ? String(positions[Math.floor(positions.length / 2)]) : "—";

  const engineRows = Array.from(perEngine.entries())
    .map(([name, s]) => ({
      name,
      themRate: s.total > 0 ? Math.round((s.them / s.total) * 100) : 0,
      youRate: s.total > 0 ? Math.round((s.you / s.total) * 100) : 0,
      total: s.total,
    }))
    .sort((a, b) => b.themRate - a.themRate);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Battlecard</h2>
        <p className="mt-1 text-sm text-muted">
          Head-to-head numbers between {competitor.brand.name} and {competitor.name}, computed
          from every recorded run.
        </p>
      </div>

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Tile label="Their mentions" value={String(competitor.stats.mentionCount)} hint={`across ${competitor.stats.runCount} runs`} />
        <Tile label="Best position" value={bestPos} hint={`avg ${avgPos} · p50 ${p50Pos}`} />
        <Tile
          label="Gap vs you"
          value={competitor.stats.vsYouGap7d == null ? "—" : `${competitor.stats.vsYouGap7d}pp`}
          hint="7d competitor% minus your%"
        />
        <Tile
          label="Their SoV"
          value={competitor.stats.shareOfVoice7d == null ? "—" : `${competitor.stats.shareOfVoice7d}%`}
          hint="last 7d"
        />
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Per-engine mention rates</p>
        {engineRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No engine data yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {engineRows.map((e) => (
              <li key={e.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="capitalize text-ink">{e.name.replace(/_/g, " ")}</span>
                  <span className="text-muted">
                    them <span className="font-semibold text-rose-600">{e.themRate}%</span>
                    <span className="mx-1">·</span>
                    you <span className="font-semibold text-accent">{e.youRate}%</span>
                  </span>
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div className="bg-rose-500/70" style={{ width: `${e.themRate}%` }} />
                  <div className="bg-accent/60" style={{ width: `${Math.min(100 - e.themRate, e.youRate)}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-muted">{e.total} scored runs</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="section-label">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
