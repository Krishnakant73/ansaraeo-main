import { cn } from "@/lib/utils";
import type { HeaderProps } from "../core";

// ============================================================
// StatusBadge — object status pill (priority / active / paused …).
// Tone maps to a subdued color; falls back to neutral so custom
// statuses never blow out the surface language.
// ============================================================

type Tone = NonNullable<HeaderProps["statusTone"]>;

const TONE: Record<Tone, string> = {
  neutral: "border-line bg-surface text-ink",
  accent: "border-accent/20 bg-accent/10 text-accent",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
