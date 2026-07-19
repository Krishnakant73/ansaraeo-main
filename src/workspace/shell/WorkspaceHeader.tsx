import type { WorkspaceDescriptor, HeaderProps, QuickAction } from "../core";
import HealthIndicator from "../primitives/HealthIndicator";
import StatusBadge from "../primitives/StatusBadge";
import QuickActionsBar from "./QuickActions.client";

// ============================================================
// WorkspaceHeader — object title, status, health, chips, quick
// actions. Extracted from WorkspaceShell so it can evolve
// independently (breadcrumbs, workspace switcher, etc.).
// Server component; the QuickActions row is a client sibling.
// ============================================================

export default function WorkspaceHeader<T>({
  descriptor,
  object,
}: {
  descriptor: WorkspaceDescriptor<T>;
  object: T;
}) {
  const header: HeaderProps = descriptor.header(object);
  const actions: QuickAction[] = descriptor.quickActions?.(object) ?? [];

  return (
    <header
      className="workspace-header border-b border-line bg-white px-6 py-5"
      style={{ minHeight: "var(--ws-header-h)" }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="section-label capitalize">{descriptor.kind}</p>
            {header.updatedAt && (
              <span className="text-[11px] text-muted">· updated {header.updatedAt}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight text-ink">
              {header.title}
            </h1>
            {header.status && (
              <StatusBadge label={header.status} tone={header.statusTone} />
            )}
            {header.health && <HealthIndicator status={header.health} />}
          </div>
          {header.subtitle && (
            <p className="mt-1 truncate text-sm text-muted">{header.subtitle}</p>
          )}
          {header.chips && header.chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {header.chips.map((c) => (
                <span key={c.label} className="chip border-line">
                  {c.label}
                  {c.value && <span className="ml-1 text-muted">· {c.value}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        {actions.length > 0 && (
          <div className="shrink-0">
            <QuickActionsBar actions={actions} />
          </div>
        )}
      </div>
    </header>
  );
}
