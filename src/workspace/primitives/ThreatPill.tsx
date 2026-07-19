import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// ThreatPill — the object-level threat indicator shown in the
// Competitor workspace header (and reusable anywhere threat / risk
// severity needs a pairing of colour + word + icon).
//
// Derivation lives in `src/lib/competitor-traits.ts`; this component
// only renders. The pairing of colour + word + icon is required —
// colour alone doesn't pass WCAG SC 1.4.1 (Use of Color).
// ============================================================

export type ThreatLevel = "low" | "medium" | "high" | "critical";

const LEVELS: Record<ThreatLevel, {
  label: string;
  ring: string;
  bg: string;
  text: string;
  icon: typeof Shield;
}> = {
  low: {
    label: "Low",
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    icon: ShieldCheck,
  },
  medium: {
    label: "Medium",
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-800",
    icon: Shield,
  },
  high: {
    label: "High",
    ring: "ring-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-700",
    icon: ShieldAlert,
  },
  critical: {
    label: "Critical",
    ring: "ring-rose-300",
    bg: "bg-rose-100",
    text: "text-rose-900",
    icon: AlertTriangle,
  },
};

export function levelFromScore(score: number): ThreatLevel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "medium";
  return "low";
}

export default function ThreatPill({
  level,
  score,
  className,
  title,
}: {
  level: ThreatLevel;
  score?: number;
  className?: string;
  title?: string;
}) {
  const cfg = LEVELS[level];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1",
        cfg.bg,
        cfg.text,
        cfg.ring,
        className,
      )}
      title={title ?? `Threat level: ${cfg.label}${score != null ? ` (${score}/100)` : ""}`}
      aria-label={`Threat level ${cfg.label}${score != null ? `, score ${score} out of 100` : ""}`}
    >
      <Icon aria-hidden className="h-3 w-3" />
      Threat: {cfg.label}
      {score != null && (
        <span className="opacity-60" aria-hidden>
          · {score}
        </span>
      )}
    </span>
  );
}
