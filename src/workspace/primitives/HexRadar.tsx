import Link from "next/link";

// ============================================================
// HexRadar — six-axis radial SVG glyph shared across workspaces.
//
// The competitor workspace uses it to overlay a competitor's DNA
// against your own; the engine workspace uses it to overlay an
// engine's personality against the cross-engine baseline. Same
// visual shape, different labels + colors.
//
// Consumers pass:
//   - axes: label + optional href + polar angle (deg)
//   - primary/overlay scores (0..100 keyed by axis key)
//   - color tokens for the two paths
// ============================================================

export type HexAxis = {
  key: string;
  label: string;
  angle: number;                         // polar angle in degrees
  href?: string;                         // makes the axis label clickable
};

export type HexScores = Record<string, number>; // 0..100 per axis.key

export default function HexRadar({
  axes,
  primary,
  overlay,
  primaryLabel = "Them",
  overlayLabel = "You",
  primaryClasses = "fill-rose-500/25 stroke-rose-500",
  overlayClasses = "fill-accent/20 stroke-accent",
  size = 300,
  caption,
  ariaLabel,
}: {
  axes: HexAxis[];
  primary: HexScores;
  overlay: HexScores;
  primaryLabel?: string;
  overlayLabel?: string;
  primaryClasses?: string;
  overlayClasses?: string;
  size?: number;
  caption?: string;
  ariaLabel: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size / 2 - 40;

  const pointFor = (score: number, angleDeg: number) => {
    const r = (Math.max(0, Math.min(100, score)) / 100) * rMax;
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };

  const buildPath = (scores: HexScores) =>
    axes
      .map((a, i) => {
        const [x, y] = pointFor(scores[a.key] ?? 0, a.angle);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <div className="grid gap-4 sm:grid-cols-[300px_1fr]">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${size} ${size}`}
        className="max-w-[300px]"
      >
        {/* Concentric guide polygons at 1/3, 2/3, 3/3 radius */}
        {[0.33, 0.66, 1].map((s) => (
          <polygon
            key={s}
            points={axes
              .map((a) => {
                const [x, y] = pointFor(100 * s, a.angle);
                return `${x},${y}`;
              })
              .join(" ")}
            className="fill-none stroke-line"
            strokeDasharray="2 2"
          />
        ))}
        {/* Spokes */}
        {axes.map((a) => {
          const [x, y] = pointFor(100, a.angle);
          return (
            <line
              key={a.key}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              className="stroke-line"
              strokeDasharray="1 3"
            />
          );
        })}
        {/* Primary + overlay paths */}
        <path d={buildPath(primary)} className={primaryClasses} strokeWidth="1.5" />
        <path d={buildPath(overlay)} className={overlayClasses} strokeWidth="1.5" />
        {/* Labels */}
        {axes.map((a) => {
          const rad = (a.angle * Math.PI) / 180;
          const lx = cx + (rMax + 22) * Math.cos(rad);
          const ly = cy + (rMax + 22) * Math.sin(rad);
          return (
            <text
              key={a.key}
              x={lx}
              y={ly}
              textAnchor={Math.abs(Math.cos(rad)) < 0.3 ? "middle" : lx > cx ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-muted text-[10px] font-semibold"
            >
              {a.label}
            </text>
          );
        })}
      </svg>

      <div className="flex flex-col gap-2 text-sm">
        {caption && <p className="text-ink/90">{caption}</p>}
        <ul className="mt-1 flex flex-col gap-1 text-[11px]">
          {axes.map((a) => {
            const p = primary[a.key] ?? 0;
            const o = overlay[a.key] ?? 0;
            const row = (
              <span className="font-mono text-muted">
                <span className="text-rose-600">{Math.round(p)}</span>
                <span className="mx-1 opacity-60">vs</span>
                <span className="text-accent">{Math.round(o)}</span>
              </span>
            );
            return (
              <li key={a.key} className="flex items-center justify-between gap-2">
                {a.href ? (
                  <Link href={a.href} className="text-muted hover:text-accent">
                    {a.label}
                  </Link>
                ) : (
                  <span className="text-muted">{a.label}</span>
                )}
                {row}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
          <span className="text-rose-600">{primaryLabel}</span>
          <span className="mx-1 opacity-60">·</span>
          <span className="text-accent">{overlayLabel}</span>
        </p>
      </div>
    </div>
  );
}
