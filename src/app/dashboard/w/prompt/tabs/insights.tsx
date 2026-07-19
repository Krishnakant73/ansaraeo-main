import { createClient } from "@/lib/supabase/server";
import type { Prompt } from "@/lib/prompt-workspace";

// ============================================================
// Prompt › Insights — the Bloomberg view of this prompt's health.
// Four KPI tiles + three summary panels. Everything computed from
// visibility_runs + citations attached to this prompt; no cross-org
// benchmark queries (that's the brand-level Insights tab).
// ============================================================

type Row = {
  id: string;
  engine_id: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
  mention_verification: { brand?: { agreed?: boolean } } | null;
  run_at: string;
};

export default async function InsightsBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();

  const [runsRes, enginesRes] = await Promise.all([
    supabase
      .from("visibility_runs")
      .select(
        "id, engine_id, brand_mentioned, brand_position, sentiment, recommendation_alignment, mention_verification, run_at",
      )
      .eq("prompt_id", prompt.id)
      .order("run_at", { ascending: false })
      .limit(500),
    supabase.from("engines").select("id, name"),
  ]);

  const rows = (runsRes.data as Row[] | null) ?? [];
  const engines = new Map<string, string>();
  for (const e of (enginesRes.data as { id: string; name: string }[] | null) ?? []) {
    engines.set(e.id, e.name);
  }

  const nonSkipped = rows.filter((r) => r.brand_mentioned !== null);
  const mentioned = nonSkipped.filter((r) => r.brand_mentioned === true);

  // KPI 1: Alignment rate — share of "aligned".
  const withAlign = nonSkipped.filter((r) => r.recommendation_alignment);
  const aligned = withAlign.filter((r) => r.recommendation_alignment === "aligned").length;
  const misaligned = withAlign.filter((r) => r.recommendation_alignment === "misaligned").length;
  const alignmentRate = withAlign.length > 0 ? Math.round((aligned / withAlign.length) * 100) : null;

  // KPI 2: sentiment mix — from mentioned runs only.
  const withSent = mentioned.filter((r) => r.sentiment);
  const sentMix = {
    positive: withSent.filter((r) => r.sentiment === "positive").length,
    neutral: withSent.filter((r) => r.sentiment === "neutral").length,
    negative: withSent.filter((r) => r.sentiment === "negative").length,
  };
  const sentTotal = sentMix.positive + sentMix.neutral + sentMix.negative;

  // KPI 3: position ladder — avg / p50 / best.
  const positions = mentioned
    .map((r) => r.brand_position)
    .filter((p): p is number => p != null && p > 0)
    .sort((a, b) => a - b);
  const posAvg = positions.length > 0 ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1) : "—";
  const posP50 = positions.length > 0 ? String(positions[Math.floor(positions.length / 2)]) : "—";
  const posBest = positions.length > 0 ? String(positions[0]) : "—";

  // KPI 4: verification agreement.
  const withVerify = rows.filter((r) => r.mention_verification?.brand);
  const agreed = withVerify.filter((r) => r.mention_verification?.brand?.agreed !== false).length;
  const agreementRate = withVerify.length > 0 ? Math.round((agreed / withVerify.length) * 100) : null;

  // Engine breakdown — for the chart panel.
  const engineStats = new Map<string, { total: number; mentioned: number }>();
  for (const r of nonSkipped) {
    const name = engines.get(r.engine_id) ?? "unknown";
    const cur = engineStats.get(name) ?? { total: 0, mentioned: 0 };
    cur.total += 1;
    if (r.brand_mentioned === true) cur.mentioned += 1;
    engineStats.set(name, cur);
  }
  const perEngine = Array.from(engineStats.entries())
    .map(([name, s]) => ({ name, rate: s.total > 0 ? Math.round((s.mentioned / s.total) * 100) : 0, total: s.total }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Insights</h2>
        <p className="mt-1 text-sm text-muted">
          The full picture of how AI engines answer this prompt for {prompt.brand.name}.
        </p>
      </div>

      {rows.length < 3 && (
        <div className="rounded-2xl border border-dashed border-line bg-white p-4 text-sm text-muted">
          Need 3+ runs before insights become meaningful. Currently: {rows.length}.
        </div>
      )}

      {/* KPI tiles */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Tile
          label="Alignment"
          value={alignmentRate == null ? "—" : `${alignmentRate}%`}
          hint={`${aligned}/${withAlign.length} aligned · ${misaligned} misaligned`}
        />
        <Tile
          label="Sentiment"
          value={sentTotal > 0 ? `${Math.round((sentMix.positive / sentTotal) * 100)}%` : "—"}
          hint={
            sentTotal > 0
              ? `+${sentMix.positive} · =${sentMix.neutral} · −${sentMix.negative}`
              : "no mentioned runs"
          }
        />
        <Tile label="Best position" value={posBest} hint={`avg ${posAvg} · p50 ${posP50}`} />
        <Tile
          label="Verification agreement"
          value={agreementRate == null ? "—" : `${agreementRate}%`}
          hint={`${agreed}/${withVerify.length} agreed`}
        />
      </section>

      {/* Engine breakdown */}
      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="section-label">Mention rate by engine</p>
          <span className="text-xs text-muted">{nonSkipped.length} scored runs</span>
        </div>
        {perEngine.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No engines have run this prompt yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {perEngine.map((e) => (
              <li key={e.name}>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="capitalize text-ink">{e.name.replace(/_/g, " ")}</span>
                  <span>
                    {e.rate}% · {e.total} run{e.total === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${e.rate}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Prompt-level forecast</p>
        <p className="mt-2 text-sm text-muted">
          Prompt-scoped forecasts arrive with the next intelligence migration. Until then,
          look at the trend on the Brand › Insights tab, filtered by this prompt&rsquo;s intent.
        </p>
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
