import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Forecast — mention rate you vs them + 90d band.
// Uses forecast_runs where dimension_type = 'competitor' if the
// row exists. When it doesn't, falls back to a naïve linear
// projection off the last 30d competitor_snapshots (migration
// 028). The chart is labelled "Modeled — not a guarantee" always.
// ============================================================

type Snapshot = {
  captured_on: string;
  mention_rate: number | null;
  brand_mention_rate: number | null;
};

export default async function ForecastBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: snapshotsRaw } = await supabase
    .from("competitor_snapshots")
    .select("captured_on, mention_rate, brand_mention_rate")
    .eq("competitor_id", competitor.id)
    .order("captured_on", { ascending: true })
    .limit(90);
  const snapshots = (snapshotsRaw as Snapshot[] | null) ?? [];

  const brandSeries = snapshots.map((s) => ({
    date: s.captured_on,
    v: s.brand_mention_rate == null ? null : Number(s.brand_mention_rate),
  }));
  const compSeries = snapshots.map((s) => ({
    date: s.captured_on,
    v: s.mention_rate == null ? null : Number(s.mention_rate),
  }));

  const cleanBrand = brandSeries.map((p) => p.v).filter((v): v is number => v != null);
  const cleanComp = compSeries.map((p) => p.v).filter((v): v is number => v != null);

  if (cleanBrand.length < 3 && cleanComp.length < 3) {
    return (
      <div className="space-y-4">
        <Intro competitor={competitor} />
        <EmptyStateCoach
          title="Not enough history yet"
          description="Forecasting needs at least 3 days of daily snapshots. The nightly cron writes these; give it a couple more nights or run a manual scan today."
          action={{
            label: "Run visibility scan",
            href: `/dashboard/b/${competitor.brand.slug}/visibility`,
          }}
        />
      </div>
    );
  }

  // Naïve linear projection: fit a line to the last N points and
  // extend 90 days. This is a placeholder; real forecasting lives
  // in a separate module (forecast_runs). We surface the modeling
  // caveat prominently so users know to trust the *direction*, not
  // the exact numeric band.
  const project = (series: number[]) => extend(series, 90);
  const brandProj = cleanBrand.length >= 3 ? project(cleanBrand) : [];
  const compProj = cleanComp.length >= 3 ? project(cleanComp) : [];

  const crossover = findCrossover(brandProj, compProj);

  return (
    <div className="space-y-4">
      <Intro competitor={competitor} />

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Mention rate · you vs them</p>
          <span className="text-[11px] uppercase tracking-wider text-amber-700">
            Modeled — not a guarantee
          </span>
        </div>
        <ForecastChart brand={cleanBrand} comp={cleanComp} brandProj={brandProj} compProj={compProj} />
        <div className="mt-3 flex items-center gap-6 text-xs">
          <Legend label="You" swatch="bg-accent" />
          <Legend label={competitor.name} swatch="bg-rose-500" />
          <Legend label="Projected" swatch="bg-muted" dashed />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">If nothing changes</p>
        <p className="mt-2 text-sm text-ink">
          {crossover != null
            ? crossover < 0
              ? `You already lead ${competitor.name} on this trajectory.`
              : `${competitor.name} is projected to overtake you in about ${Math.round(crossover)} days.`
            : `Trends are close to parallel — no crossover projected in the next 90 days.`}
        </p>
        {crossover != null && crossover > 0 && crossover < 60 && (
          <p className="mt-2 text-xs text-muted">
            Ship two to three targeted comparison pages this month to reverse the trajectory. Draft
            them from the Weaknesses tab.
          </p>
        )}
      </section>
    </div>
  );
}

function Intro({ competitor }: { competitor: Competitor }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">Forecast</h2>
      <p className="mt-1 text-sm text-muted">
        Projected mention rate for {competitor.name} vs {competitor.brand.name} over the next 90
        days. Direction over precision.
      </p>
    </div>
  );
}

function Legend({ label, swatch, dashed }: { label: string; swatch: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={`inline-block h-2 w-4 rounded-full ${swatch} ${dashed ? "opacity-50" : ""}`}
      />
      <span className="text-muted">{label}</span>
    </span>
  );
}

function ForecastChart({
  brand,
  comp,
  brandProj,
  compProj,
}: {
  brand: number[];
  comp: number[];
  brandProj: number[];
  compProj: number[];
}) {
  const width = 640;
  const height = 200;
  const pad = 12;

  const allValues = [...brand, ...comp, ...brandProj, ...compProj];
  const yMin = Math.min(0, ...allValues);
  const yMax = Math.max(100, ...allValues);
  const totalPoints = Math.max(brand.length + brandProj.length, comp.length + compProj.length, 2);

  const scaleX = (i: number) => pad + (i / Math.max(1, totalPoints - 1)) * (width - pad * 2);
  const scaleY = (v: number) => height - pad - ((v - yMin) / (yMax - yMin || 1)) * (height - pad * 2);

  const makePath = (series: number[], offset = 0) =>
    series
      .map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i + offset).toFixed(1)},${scaleY(v).toFixed(1)}`)
      .join(" ");

  return (
    <svg
      role="img"
      aria-label="Forecast chart: your mention rate vs competitor's, with 90-day projection"
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
      preserveAspectRatio="none"
    >
      {[0, 25, 50, 75, 100].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={width - pad}
          y1={scaleY(t)}
          y2={scaleY(t)}
          className="stroke-line"
          strokeDasharray="2 3"
        />
      ))}
      {/* Historical */}
      {brand.length > 1 && (
        <path d={makePath(brand)} className="fill-none stroke-accent" strokeWidth="1.5" />
      )}
      {comp.length > 1 && (
        <path d={makePath(comp)} className="fill-none stroke-rose-500" strokeWidth="1.5" />
      )}
      {/* Projected */}
      {brandProj.length > 1 && (
        <path
          d={makePath(brandProj, brand.length - 1)}
          className="fill-none stroke-accent"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />
      )}
      {compProj.length > 1 && (
        <path
          d={makePath(compProj, comp.length - 1)}
          className="fill-none stroke-rose-500"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.6"
        />
      )}
      {/* Boundary marker between historical and projected */}
      <line
        x1={scaleX(Math.max(brand.length, comp.length) - 1)}
        x2={scaleX(Math.max(brand.length, comp.length) - 1)}
        y1={pad}
        y2={height - pad}
        className="stroke-muted"
        strokeDasharray="1 3"
        opacity="0.4"
      />
    </svg>
  );
}

// ── math helpers ─────────────────────────────────────────

function extend(series: number[], days: number): number[] {
  if (series.length < 2) return [];
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const out: number[] = [];
  const last = ys[n - 1];
  out.push(last);
  for (let i = 1; i <= days; i++) {
    const v = intercept + slope * (n - 1 + i);
    out.push(Math.max(0, Math.min(100, v)));
  }
  return out;
}

function findCrossover(brand: number[], comp: number[]): number | null {
  const len = Math.min(brand.length, comp.length);
  if (len < 2) return null;
  const initial = brand[0] - comp[0];
  for (let i = 1; i < len; i++) {
    const d = brand[i] - comp[i];
    if ((initial >= 0 && d < 0) || (initial < 0 && d >= 0)) return i;
  }
  return null;
}
