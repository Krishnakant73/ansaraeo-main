import Link from "next/link";
import { ArrowUpRight, Lightbulb, AlertTriangle, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ============================================================
// InsightCard — single AI/analytics insight tile.
// Used inside sidebars and rich tab bodies. Variant sets tone
// only; content is plain text (never HTML — insights come from
// LLMs and stay untrusted at render time).
// ============================================================

type Variant = "opportunity" | "warning" | "win" | "info";

const VARIANT: Record<
  Variant,
  { ring: string; icon: typeof Lightbulb; iconClass: string; label: string }
> = {
  opportunity: {
    ring: "border-accent/20 bg-accent/5",
    icon: Lightbulb,
    iconClass: "text-accent",
    label: "Opportunity",
  },
  warning: {
    ring: "border-amber-200 bg-amber-50/50",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    label: "Attention",
  },
  win: {
    ring: "border-emerald-200 bg-emerald-50/50",
    icon: Trophy,
    iconClass: "text-emerald-600",
    label: "Win",
  },
  info: {
    ring: "border-line bg-white",
    icon: Sparkles,
    iconClass: "text-muted",
    label: "Insight",
  },
};

export default function InsightCard({
  variant = "info",
  title,
  description,
  href,
  action,
  meta,
  className,
}: {
  variant?: Variant;
  title: string;
  description?: string;
  href?: string;
  action?: ReactNode;
  meta?: string;
  className?: string;
}) {
  const cfg = VARIANT[variant];
  const Icon = cfg.icon;
  const body = (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-2xl border p-3 transition-colors",
        cfg.ring,
        href && "cursor-pointer hover:border-accent/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", cfg.iconClass)} aria-hidden />
          <span className="section-label">{cfg.label}</span>
        </div>
        {href && (
          <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-accent" />
        )}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="text-xs text-muted">{description}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        {meta && <span className="text-[11px] text-muted">{meta}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
    >
      {body}
    </Link>
  ) : (
    body
  );
}
