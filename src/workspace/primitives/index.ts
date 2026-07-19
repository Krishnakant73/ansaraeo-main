// ============================================================
// Public primitives surface for the Universal Workspace Engine.
// Concrete workspaces should import from here rather than deep
// paths so the internal file layout can move freely.
// ============================================================

export { default as KpiCard } from "./KpiCard";
export { default as MetricsGrid } from "./MetricsGrid";
export { default as InsightCard } from "./InsightCard";
export { default as HealthIndicator } from "./HealthIndicator";
export { default as StatusBadge } from "./StatusBadge";
export { default as TimelineList } from "./TimelineList";
export type { TimelineListEntry } from "./TimelineList";
export { default as EmptyStateCoach } from "./EmptyStateCoach";
export type { EmptyStateCoachProps } from "./EmptyStateCoach";
export {
  SkeletonLine,
  SkeletonBlock,
  KpiSkeleton,
  TabBodySkeleton,
  SidebarSkeleton,
} from "./SkeletonLoader";
export { WorkspaceErrorBoundary } from "./ErrorBoundary.client";
