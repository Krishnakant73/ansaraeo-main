// ============================================================
// DataReadinessCard.tsx — Reusable, platform-wide readiness panel.
//
// Renders the professional "we're still collecting data" information
// panel that replaces empty/placeholder dashboards. Every advanced
// module surfaces this (via getReadiness()) when its data isn't yet
// statistically reliable — so users always see honest progress instead
// of fake insights.
//
// Server component (no "use client"): it composes the client <Badge />
// primitive, which is fine for a server-rendered island.
// ============================================================

import { Check, CircleDashed, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReadinessRequirementView, ReadinessStatus } from "@/lib/data-readiness/types";

type BadgeVariant = "info" | "warning" | "success";

const STATUS_META: Record<ReadinessStatus, { label: string; variant: BadgeVariant }> = {
  COLLECTING: { label: "Collecting data", variant: "info" },
  BUILDING: { label: "Building dataset", variant: "warning" },
  PARTIAL: { label: "Partially ready", variant: "warning" },
  READY: { label: "Ready", variant: "success" },
  HIGH_CONFIDENCE: { label: "High confidence", variant: "success" },
};

function confidenceLevel(value: number): { label: string; className: string } {
  if (value < 40) return { label: "Low", className: "text-amber-600" };
  if (value < 75) return { label: "Medium", className: "text-sky-600" };
  return { label: "High", className: "text-emerald-600" };
}

/** Human-friendly formatting for a requirement's current/target value. */
function formatMetric(current: number, target: number, unit?: string): string {
  if (unit === "%") {
    return `${Math.round(current)}% / ${Math.round(target)}%`;
  }
  if (target < 1) {
    // fractional ratios (e.g. ecosystem coverage) → show as a percentage
    return `${Math.round(current * 100)}% / ${Math.round(target * 100)}%`;
  }
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n)));
  const suffix = unit ? ` ${unit}` : "";
  return `${fmt(current)}${suffix} / ${fmt(target)}${suffix}`;
}

export type DataReadinessCardProps = {
  title: string;
  status: ReadinessStatus;
  progress: number;
  confidence: number;
  requirements: ReadinessRequirementView[];
  estimatedCompletion?: string;
  message?: string;
};

export function DataReadinessCard({
  title,
  status,
  progress,
  confidence,
  requirements,
  estimatedCompletion,
  message,
}: DataReadinessCardProps) {
  const meta = STATUS_META[status];
  const conf = confidenceLevel(confidence);
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden />
            {title}
          </CardTitle>
          <CardDescription>Feature readiness</CardDescription>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Current Progress</span>
            <span className="tabular-nums text-muted-foreground">Current Readiness: {pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-grid" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Estimated Confidence</span>
            <span className={`font-medium ${conf.className}`}>{conf.label}</span>
          </div>
        </div>

        {/* Requirements checklist */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Requirements</div>
          <ul className="space-y-2">
            {requirements.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  {r.met ? (
                    <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={r.met ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {r.met ? "Ready" : formatMetric(r.current, r.target, r.unit)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Message */}
        {message ? <p className="text-sm leading-relaxed text-muted-foreground">{message}</p> : null}

        {/* Footer */}
        <div className="border-t border-line/60 pt-4 text-sm text-muted-foreground">
          No action is required. This feature will activate automatically.
          {estimatedCompletion ? <span className="ml-1">{estimatedCompletion}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
