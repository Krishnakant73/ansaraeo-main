import type { ReactNode } from "react";
import { Suspense } from "react";
import { SidebarSkeleton } from "../primitives/SkeletonLoader";
import { WorkspaceErrorBoundary } from "../primitives/ErrorBoundary.client";
import type { WorkspaceDescriptor } from "../core";
import ActivityFeed from "./ActivityFeed";
import RelatedObjects from "./RelatedObjects";

// ============================================================
// RightSidebar — the workspace's context rail. Composes:
//   • Activity feed (recent scans, mentions, ownership changes)
//   • Related objects (competitors of a brand, prompts on a competitor)
//   • Slot for descriptor-supplied extras
//
// Copilot lives OUTSIDE this rail — the top-level CopilotDock reads
// data-copilot-context off the shell root and renders itself. The
// sidebar is for structured context, not conversation.
// ============================================================

export default function RightSidebar<T>({
  descriptor,
  object,
  extra,
}: {
  descriptor: WorkspaceDescriptor<T>;
  object: T;
  extra?: ReactNode;
}) {
  const activity = descriptor.activity?.(object);
  const related = descriptor.related?.(object);
  const hasAnything = !!activity || !!related || !!extra;
  if (!hasAnything) return null;

  return (
    <aside
      aria-label={`${descriptor.kind} context`}
      className="space-y-4"
      style={{ width: "100%", maxWidth: "var(--ws-sidebar-w-lg)" }}
    >
      {activity && (
        <WorkspaceErrorBoundary label="Activity">
          <Suspense fallback={<SidebarSkeleton />}>
            <ActivityFeed source={activity} />
          </Suspense>
        </WorkspaceErrorBoundary>
      )}
      {related && (
        <WorkspaceErrorBoundary label="Related objects">
          <Suspense fallback={<SidebarSkeleton />}>
            <RelatedObjects
              source={related}
              centerKind={descriptor.kind}
              centerLabel={descriptor.header(object).title}
            />
          </Suspense>
        </WorkspaceErrorBoundary>
      )}
      {extra}
    </aside>
  );
}
