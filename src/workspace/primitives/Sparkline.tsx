import { cn } from "@/lib/utils";

// ============================================================
// Sparkline — inline SVG micro-chart used inside KPI cards and
// header snapshots. Deliberately tiny (no axis, no tooltip); trace
// only. Empty / single-point series render an inert dot so the
// alignment holds in a grid.
//
// Server component; no state, no interactivity.
// ============================================================

export default function Sparkline({
  values,
  className,
  width = 72,
  height = 20,
  strokeClass = "stroke-accent",
  fillClass = "fill-accent/10",
  ariaLabel,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
  strokeClass?: string;
  fillClass?: string;
  ariaLabel?: string;
}) {
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length < 2) {
    // Single dot fallback so the row height stays consistent.
    return (
      <svg
        role="img"
        aria-label={ariaLabel ?? "Insufficient data for sparkline"}
        width={width}
        height={height}
        className={cn("shrink-0", className)}
      >
        <circle cx={width / 2} cy={height / 2} r={1.5} className={strokeClass} />
      </svg>
    );
  }

  const min = Math.min(...cleaned);
  const max = Math.max(...cleaned);
  const range = max - min || 1;
  const step = cleaned.length > 1 ? width / (cleaned.length - 1) : width;

  const points = cleaned.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(2)},${height} L${points[0][0].toFixed(2)},${height} Z`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? `Sparkline: ${cleaned.length} points, range ${min.toFixed(1)} to ${max.toFixed(1)}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      preserveAspectRatio="none"
    >
      <path d={area} className={cn("stroke-none", fillClass)} />
      <path d={line} className={cn("fill-none stroke-[1.5]", strokeClass)} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
