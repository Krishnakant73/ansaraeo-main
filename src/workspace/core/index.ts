// ============================================================
// Universal Workspace Engine — public API surface.
//
// Consumers (descriptor files, shell components) import from
// "@/workspace/core" — never from individual modules. This lets us
// reshape internals without churning consumers.
// ============================================================

export { defineWorkspace } from "./defineWorkspace";
export { register, get, list, has } from "./registry";
export type {
  ObjectKind,
  WorkspaceDescriptor,
  HeaderProps,
  KPI,
  TabDef,
  TimelineSource,
  TimelineEntry,
  ActivitySource,
  ActivityEntry,
  RelatedGraphSource,
  CopilotContext,
  QuickAction,
  ExportPlan,
  HealthStatus,
  ListItem,
  ListOptions,
} from "./types";
