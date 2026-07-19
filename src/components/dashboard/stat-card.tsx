import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  icon?: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  const showDelta = typeof delta === "number" && !Number.isNaN(delta);
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn("kpi", accent && "ring-1 ring-accent/20")}>
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {showDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              positive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
        {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
        {hint && !showDelta && <span className="text-muted">{hint}</span>}
      </div>
    </div>
  );
}
