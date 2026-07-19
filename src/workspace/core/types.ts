// ============================================================
// Universal Workspace Engine — core types.
//
// A workspace is fully described by a WorkspaceDescriptor: the loader
// that fetches the object, the header / summary / tabs / sidebar shape,
// and the actions available on it. The framework consumes descriptors
// via the registry; nothing else defines a workspace.
//
// Concrete workspaces (brand, prompt, competitor, …) live under
// src/app/dashboard/w/<kind>/workspace.ts and call defineWorkspace().
// ============================================================

import type { ComponentType, ReactNode, SVGProps } from "react";

export type ObjectKind = string; // "brand" | "competitor" | "prompt" | …

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

// ---------- Header ----------
export type HeaderProps = {
  title: string;
  subtitle?: string;
  status?: string;                                // "priority" | "active" | "paused" …
  statusTone?: "neutral" | "accent" | "warning" | "danger";
  health?: HealthStatus;
  chips?: { label: string; value?: string }[];
  updatedAt?: string;
};

// ---------- Executive summary ----------
export type KPI = {
  key: string;
  label: string;
  value: string | number;
  delta?: number;                                 // signed pp / % / raw
  deltaFormat?: "pp" | "pct" | "raw";
  spark?: number[];                               // tiny sparkline series
  hint?: string;
  href?: string;                                  // drill-in
  tone?: "neutral" | "positive" | "negative";
};

// ---------- Tabs ----------
export type TabDef<TObject = unknown> = {
  key: string;                                    // URL segment
  label: string;
  icon?: Icon;
  hint?: string;
  gate?: string;                                  // FEATURE_KEY; hides when locked
  // Deferred import → keeps the initial render lean. The framework calls
  // this at request time and awaits the module.
  render: (ctx: {
    object: TObject;
    params: Record<string, string>;
    searchParams: URLSearchParams;
  }) => Promise<ReactNode> | ReactNode;
};

// ---------- Timeline ----------
export type TimelineEntry = {
  id: string;
  at: string;                                     // ISO
  actor?: string;
  kind: string;
  message: string;
  href?: string;
};
export type TimelineSource = {
  entries: () => Promise<TimelineEntry[]>;
};

// ---------- Activity ----------
export type ActivityEntry = TimelineEntry;
export type ActivitySource = {
  entries: () => Promise<ActivityEntry[]>;
  stream?: {                                      // optional SSE endpoint
    url: string;
  };
};

// ---------- Related objects graph ----------
export type RelatedGraphSource = {
  nodes: () => Promise<{
    kind: ObjectKind;
    id: string;
    label: string;
    relation: string;                             // "belongs_to" | "targets" | "runs_on" …
  }[]>;
};

// ---------- Copilot context ----------
export type CopilotContext = {
  kind: ObjectKind;
  id: string;
  label: string;
  summary?: string;
  hints?: string[];
};

// ---------- Quick actions ----------
// A quick action is either a navigation (href) or a client-side event
// (eventName + optional detail — dispatched as CustomEvent, so a client
// listener elsewhere in the app can handle it). Functions can't cross
// the RSC boundary, which is why we don't accept `onFire` here.
export type QuickAction = {
  id: string;
  label: string;
  icon?: Icon;
  keyboard?: string;                              // single letter; framework enforces uniqueness per descriptor
  href?: string;                                  // link-style action
  event?: { name: string; detail?: unknown };     // dispatched as CustomEvent(name, {detail})
  variant?: "primary" | "ghost" | "danger";
  destructive?: boolean;
};

// ---------- Export plan ----------
export type ExportPlan = {
  formats: ("pdf" | "csv" | "json")[];
  filename: (o: unknown) => string;
};

// ---------- Loader ----------
export type LoaderCtx = {
  slug: string;                                   // primary identifier (descriptor.slugParam)
  params: Record<string, string>;
  supabase: unknown;                              // typed at consumer; the framework passes a cookie-scoped client
};

// ---------- List (picker) ----------
// The workspace's own picker query. Optional — when absent, the picker page
// falls back to its hardcoded switch. This lets a descriptor own the "how do
// I show up in /dashboard/w/<kind>?" question, alongside header/summary/tabs.
export type ListItem = {
  id: string;                                     // becomes the slug segment in /dashboard/w/<kind>/<id>
  label: string;                                  // primary display text
  sublabel?: string;                              // secondary line
};
export type ListOptions = {
  query?: string;                                 // free-text filter (case-insensitive; caller supplies)
  limit?: number;                                 // default 50
};

// ---------- Full descriptor ----------
export type WorkspaceDescriptor<TObject = unknown> = {
  kind: ObjectKind;
  slugParam?: string;                             // defaults to "slug"
  loader: (ctx: LoaderCtx) => Promise<TObject | null>;
  header: (o: TObject) => HeaderProps;
  summary: (o: TObject) => Promise<KPI[]> | KPI[];
  tabs: TabDef<TObject>[];                        // first is default
  timeline?: (o: TObject) => TimelineSource;
  activity?: (o: TObject) => ActivitySource;
  related?: (o: TObject) => RelatedGraphSource;
  copilotContext: (o: TObject) => CopilotContext;
  quickActions?: (o: TObject) => QuickAction[];
  export?: (o: TObject) => ExportPlan;
  // Optional: descriptor-owned picker query. When present, /dashboard/w/<kind>
  // uses this instead of its hardcoded switch. Should call the cookie client
  // (RLS-safe) and return at most `opts.limit` (default 50) items.
  list?: (opts: ListOptions) => Promise<ListItem[]>;
  capabilities?: {
    share?: boolean;
    export?: boolean;
    delete?: boolean;
    api?: boolean;
  };
};
