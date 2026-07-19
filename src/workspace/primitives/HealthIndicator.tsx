import { AlertTriangle, CheckCircle2, CircleAlert, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "../core";

// ============================================================
// HealthIndicator — small dot + label for an object's health.
// Reused by WorkspaceHeader and the right sidebar summary. Kept
// deliberately compact; when a workspace has richer signals it
// composes multiple indicators rather than pushing complexity in.
// ============================================================

const CONFIG: Record<HealthStatus, { label: string; ring: string; dot: string; text: string; icon: typeof CheckCircle2 }> = {
  healthy: {
    label: "Healthy",
    ring: "border-emerald-200 bg-emerald-50",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    icon: CheckCircle2,
  },
  warning: {
    label: "Attention",
    ring: "border-amber-200 bg-amber-50",
    dot: "bg-amber-500",
    text: "text-amber-700",
    icon: AlertTriangle,
  },
  critical: {
    label: "Critical",
    ring: "border-rose-200 bg-rose-50",
    dot: "bg-rose-500",
    text: "text-rose-700",
    icon: CircleAlert,
  },
  unknown: {
    label: "Unknown",
    ring: "border-line bg-surface",
    dot: "bg-muted",
    text: "text-muted",
    icon: HelpCircle,
  },
};

export default function HealthIndicator({
  status,
  label,
  variant = "chip",
  className,
}: {
  status: HealthStatus;
  label?: string;
  variant?: "chip" | "dot" | "row";
  className?: string;
}) {
  const cfg = CONFIG[status];
  if (variant === "dot") {
    return (
      <span
        role="img"
        aria-label={label ?? cfg.label}
        className={cn("inline-block h-2 w-2 rounded-full", cfg.dot, className)}
      />
    );
  }
  if (variant === "row") {
    const Icon = cfg.icon;
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Icon className={cn("h-4 w-4", cfg.text)} aria-hidden />
        <span className={cn("text-sm font-medium", cfg.text)}>{label ?? cfg.label}</span>
      </div>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        cfg.ring,
        cfg.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} aria-hidden />
      {label ?? cfg.label}
    </span>
  );
}
