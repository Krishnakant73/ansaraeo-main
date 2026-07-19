import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KPI } from "../core";

// ============================================================
// KpiCard — one Executive Summary tile.
//
// Consumes the descriptor's KPI shape. Delta sign and format
// (pp / pct / raw) drive tone; explicit `tone` overrides.
// Server component; the value + delta are rendered from props.
// ============================================================

function formatDelta(d: number | undefined, format: KPI["deltaFormat"]): string | null {
  if (d == null) return null;
  const sign = d > 0 ? "+" : "";
  if (format === "pct") return `${sign}${d.toFixed(1)}%`;
  if (format === "raw") return `${sign}${d}`;
  return `${sign}${d.toFixed(1)}pp`;
}

function deltaTone(d: number | undefined, tone: KPI["tone"]): string {
  if (tone === "positive") return "text-emerald-600";
  if (tone === "negative") return "text-rose-600";
  if (d == null || d === 0) return "text-muted";
  return d > 0 ? "text-emerald-600" : "text-rose-600";
}

export default function KpiCard({ kpi }: { kpi: KPI }) {
  const deltaLabel = formatDelta(kpi.delta, kpi.deltaFormat);
  const toneClass = deltaTone(kpi.delta, kpi.tone);
  const body = (
    <div className="group flex flex-col gap-1 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-accent/40">
      <div className="flex items-start justify-between gap-2">
        <p className="section-label">{kpi.label}</p>
        {kpi.href && (
          <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-accent" />
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight text-ink">{kpi.value}</p>
      <div className="flex items-baseline gap-2">
        {deltaLabel && <span className={cn("text-xs font-semibold", toneClass)}>{deltaLabel}</span>}
        {kpi.hint && <span className="text-[11px] text-muted">{kpi.hint}</span>}
      </div>
    </div>
  );
  return kpi.href ? (
    <Link href={kpi.href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      {body}
    </Link>
  ) : (
    body
  );
}
