import HexRadar from "@/workspace/primitives/HexRadar";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// CompetitorDna — six-axis DNA overlay: this competitor vs your
// brand. Thin adapter over the shared HexRadar primitive; the same
// glyph is used by the engine workspace's AI DNA Radar.
//
// Axes: Citation gravity · Content velocity · Review presence ·
//       Community footprint · Schema fitness · Freshness cadence
// ============================================================

export type DnaAxis =
  | "citation"
  | "velocity"
  | "reviews"
  | "community"
  | "schema"
  | "freshness";

export type DnaScores = Record<DnaAxis, number>;

const AXES: {
  key: DnaAxis;
  label: string;
  angle: number;
  jump: (competitorId: string) => string;
}[] = [
  { key: "citation", label: "Citation gravity", angle: -90, jump: (id) => `/dashboard/w/competitor/${id}/citations` },
  { key: "velocity", label: "Content velocity", angle: -30, jump: (id) => `/dashboard/w/competitor/${id}/content-strategy` },
  { key: "reviews", label: "Review presence", angle: 30, jump: (id) => `/dashboard/w/competitor/${id}/strengths` },
  { key: "community", label: "Community footprint", angle: 90, jump: (id) => `/dashboard/w/competitor/${id}/strengths` },
  { key: "schema", label: "Schema fitness", angle: 150, jump: (id) => `/dashboard/w/competitor/${id}/weaknesses` },
  { key: "freshness", label: "Freshness cadence", angle: 210, jump: (id) => `/dashboard/w/competitor/${id}/timeline` },
];

export default function CompetitorDna({
  competitor,
  them,
  you,
}: {
  competitor: Competitor;
  them: DnaScores;
  you: DnaScores;
}) {
  // Top-two gap axes for the summary caption.
  const gaps = AXES.map((a) => ({
    key: a.key,
    label: a.label,
    gap: (them[a.key] ?? 0) - (you[a.key] ?? 0),
  }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 2);

  const caption = gaps
    .map((g) =>
      g.gap > 0
        ? `${competitor.name} leads on ${g.label} by ${Math.abs(g.gap).toFixed(0)} pts.`
        : g.gap < 0
          ? `You lead on ${g.label} by ${Math.abs(g.gap).toFixed(0)} pts.`
          : `Even on ${g.label}.`,
    )
    .join(" ");

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Competitor DNA</p>
        <span className="text-[11px] text-muted">Them · You overlaid</span>
      </div>
      <div className="mt-2">
        <HexRadar
          axes={AXES.map((a) => ({
            key: a.key,
            label: a.label,
            angle: a.angle,
            href: a.jump(competitor.id),
          }))}
          primary={them}
          overlay={you}
          primaryLabel={competitor.name}
          overlayLabel="You"
          caption={caption}
          ariaLabel={`Six-axis DNA glyph for ${competitor.name} with your brand overlaid`}
        />
      </div>
    </section>
  );
}
