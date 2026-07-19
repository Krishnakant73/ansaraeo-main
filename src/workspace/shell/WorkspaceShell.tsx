import type { ReactNode } from "react";
import { Suspense } from "react";
import ExecutiveSummary from "./ExecutiveSummary";
import WorkspaceHeader from "./WorkspaceHeader";
import TabNavigation from "./TabNavigation.client";
import RightSidebar from "./RightSidebar";
import Timeline from "./Timeline";
import FooterActions from "./FooterActions";
import CopyHandle from "./CopyHandle.client";
import { KpiSkeleton, SidebarSkeleton, TabBodySkeleton } from "../primitives/SkeletonLoader";
import { WorkspaceErrorBoundary } from "../primitives/ErrorBoundary.client";
import type { WorkspaceDescriptor } from "../core";

// ============================================================
// WorkspaceShell — the layout every workspace inherits.
//
// Composition order (top → bottom):
//   1. WorkspaceHeader        title, status, health, chips, quick actions
//   2. ExecutiveSummary       KPI grid (streamed via Suspense)
//   3. TabNavigation.client   sticky bar with keyboard shortcuts
//   4. Grid                   main body (children) + right sidebar
//   5. Timeline               optional, full width, opt-in via descriptor
//   6. FooterActions          export / share / report / api gates
//
// The `data-copilot-context` DOM contract is emitted on the root so
// CopilotDock (living in the app-shell) can read this workspace's
// object context without importing anything from UWE. TabNavigation
// re-fires that DOM signal on every tab switch.
// ============================================================

export default async function WorkspaceShell<T>({
  descriptor,
  object,
  activeTabKey,
  baseHref,
  children,
  sidebarExtra,
  reportHref,
}: {
  descriptor: WorkspaceDescriptor<T>;
  object: T;
  activeTabKey?: string;
  baseHref: string;
  children: ReactNode;
  sidebarExtra?: ReactNode;
  reportHref?: string;
}) {
  const copilotCtx = descriptor.copilotContext(object);
  const timelineSource = descriptor.timeline?.(object);
  const hasSidebar =
    !!descriptor.activity || !!descriptor.related || !!sidebarExtra;

  return (
    <div
      className="workspace-shell"
      data-workspace-kind={descriptor.kind}
      data-copilot-context={JSON.stringify(copilotCtx)}
    >
      <CopyHandle />
      <WorkspaceHeader descriptor={descriptor} object={object} />

      <div style={{ minHeight: "var(--ws-summary-h)" }}>
        <Suspense
          fallback={
            <section className="px-6 py-4">
              <KpiSkeleton />
            </section>
          }
        >
          <WorkspaceErrorBoundary label="Executive summary">
            <section className="px-6 py-4">
              <ExecutiveSummary descriptor={descriptor} object={object} />
            </section>
          </WorkspaceErrorBoundary>
        </Suspense>
      </div>

      <TabNavigation
        tabs={descriptor.tabs}
        activeKey={activeTabKey ?? descriptor.tabs[0]?.key}
        baseHref={baseHref}
        kindLabel={descriptor.kind}
      />

      <div
        className="workspace-grid grid gap-[var(--ws-gutter)] px-6 py-6"
        style={
          hasSidebar
            ? {
                gridTemplateColumns:
                  "minmax(0, 1fr) minmax(0, var(--ws-sidebar-w-lg))",
              }
            : undefined
        }
      >
        <main className="min-w-0">
          <WorkspaceErrorBoundary label="Tab content">
            <Suspense fallback={<TabBodySkeleton />}>{children}</Suspense>
          </WorkspaceErrorBoundary>
          {timelineSource && (
            <Suspense fallback={null}>
              <WorkspaceErrorBoundary label="Timeline">
                <Timeline source={timelineSource} />
              </WorkspaceErrorBoundary>
            </Suspense>
          )}
          <FooterActions
            descriptor={descriptor}
            object={object}
            reportHref={reportHref}
          />
        </main>
        {hasSidebar && (
          <Suspense fallback={<SidebarSkeleton />}>
            <RightSidebar
              descriptor={descriptor}
              object={object}
              extra={sidebarExtra}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// Responsive: on <xl viewports we collapse to single-column via a
// media query on the workspace-grid class. Tailwind arbitrary values
// are avoided inline so the responsive rules stay in one place.
