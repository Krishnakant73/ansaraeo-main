import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { ArrowRight, HelpCircle } from "lucide-react";

// ============================================================
// EmptyStateCoach — the shared "nothing here yet" primitive that
// turns a dead-end into a coached next step. Every empty state in
// the workspace layer should render this instead of a bare
// "No data" line: a one-line explainer + a suggested action button
// (link) + optional doc link. Keeps the empty tone the same across
// 12 workspaces × N tabs so operators know what to do next.
//
// Variants:
//   • default — dashed border (implies "waiting on data")
//   • coach   — accent border (implies "here's what to do")
//
// Usage:
//   <EmptyStateCoach
//     title="No competitors tracked yet"
//     description="Add a competitor to compare visibility, citation share, and mention rate."
//     action={{ label: "Add competitor", href: `/dashboard/b/${slug}/competitors` }}
//   />
// ============================================================

export type EmptyStateCoachProps = {
  title: string;
  description?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  action?: {
    label: string;
    href: string;
  };
  secondary?: {
    label: string;
    href: string;
  };
  variant?: "default" | "coach";
  children?: ReactNode;
};

export default function EmptyStateCoach({
  title,
  description,
  icon: Icon = HelpCircle,
  action,
  secondary,
  variant = "default",
  children,
}: EmptyStateCoachProps) {
  const outer =
    variant === "coach"
      ? "rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center"
      : "rounded-2xl border border-dashed border-line bg-white p-8 text-center";
  const iconWrap =
    variant === "coach"
      ? "mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent"
      : "mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted";

  return (
    <div className={outer}>
      <div className={iconWrap}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-xs text-muted">{description}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
      {(action || secondary) && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {action && (
            <Link
              href={action.href}
              className="btn-sm inline-flex items-center gap-1.5"
            >
              {action.label}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="text-xs font-medium text-accent hover:underline"
            >
              {secondary.label} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
