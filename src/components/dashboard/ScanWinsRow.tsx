import type { LucideIcon } from "lucide-react";
import { CheckCircle2, FileEdit, Search, Users, Zap } from "lucide-react";

// ============================================================
// ScanWinsRow — small chips proving the product has already done work.
//
// Never shows an empty state; each chip only renders when its count > 0.
// ============================================================

type Chip = {
  icon: LucideIcon;
  label: string;
  count: number;
};

export function ScanWinsRow(props: {
  answersAnalyzed: number;
  competitorsDetected: number;
  opportunitiesQueued: number;
  draftsInProgress: number;
  promptsTracked: number;
}) {
  const chips: Chip[] = [
    { icon: Search, label: "answers analyzed", count: props.answersAnalyzed },
    { icon: Users, label: "competitors detected", count: props.competitorsDetected },
    { icon: Zap, label: "opportunities queued", count: props.opportunitiesQueued },
    { icon: FileEdit, label: "drafts in progress", count: props.draftsInProgress },
    { icon: CheckCircle2, label: "prompts tracked", count: props.promptsTracked },
  ].filter((c) => c.count > 0);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const Icon = c.icon;
        return (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm"
          >
            <Icon className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-semibold tabular-nums">{c.count}</span>
            <span className="text-muted">{c.label}</span>
          </span>
        );
      })}
    </div>
  );
}
