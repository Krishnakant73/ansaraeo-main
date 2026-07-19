// ============================================================
// command-registry.ts — single source of truth for palette commands.
//
// Every action reachable in the app registers here. The Command Palette
// (⌘K) and the Copilot slash-commands both hydrate from this registry —
// no per-feature routing table to keep in sync.
//
// Commands come in three flavors:
//   • do   — a verb ("Run scan", "Draft answer"). Optional POST endpoint.
//   • go   — navigate to a route (an object or a workspace tab).
//   • jump — same as go, but only shown when scoped to the current object.
//
// Objects (brands, competitors, prompts, campaigns, engines, reports) are
// resolved dynamically by the palette, not registered here. This file is
// static-only.
// ============================================================

import type { ComponentType, SVGProps } from "react";
import {
  Activity, AlertTriangle, BarChart3, Bell, Bot, Building2, ChartLine,
  CheckCheck, Compass, Eye, FileCode2, FileDown, FileSearch, FileText,
  Flag, GitCompare, IndianRupee, Inbox, Keyboard, Layers, LayoutList,
  Lightbulb, LineChart, ListChecks, ListTodo, MapPin, Megaphone, MessageSquare,
  Network, Package, Play, Plug, Radio, Rocket, Search, Share2, ShieldCheck,
  SpellCheck, Store, Swords, Target, Trophy, User, Users, Wand2, Workflow,
} from "lucide-react";

export type CommandGroup = "do" | "go" | "jump" | "help";

export type Command = {
  id: string;                       // stable ID for telemetry / bindings
  group: CommandGroup;
  label: string;                    // primary display
  aliases?: string[];               // extra keywords for fuzzy match
  hint?: string;                    // one-line description
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  keywords?: string;                // pre-joined search haystack (auto-derived if omitted)
  // Navigation:
  href?: string;                    // static route (go)
  brandScoped?: boolean;            // if true, href is `/<suffix>` and gets rewritten to `/dashboard/b/<slug><suffix>` (or `/dashboard/b/<slug>` when suffix is empty)
  // Action:
  action?: string;                  // POST endpoint or "copilot:<slash>" (do)
  actionPayload?: Record<string, unknown>;
  // Scoping:
  requiresBrand?: boolean;          // hide when no brand is selected
  featureKey?: string;              // hide when feature is locked
  // Ranking:
  weight?: number;                  // higher = ranked higher when tied
};

// ---------- The 8 Objects (rail order) ----------
// Phase 2: brand-scoped routes live under /dashboard/b/[slug]/**. These
// suffixes get prefixed with `/dashboard/b/<slug>` at render time via
// `resolveHref()`. Empty string = Mission Control home for the brand.
export const OBJECT_SUFFIXES = {
  missionControl: "",
  brand: "/visibility",
  competitors: "/competitors",
  prompts: "/prompts",
  campaigns: "/campaigns",
  engines: "/prompts",            // Engines list lives under prompts today; separate tab in Phase 3
  reports: "/reports",
  benchmark: "/benchmark",
} as const;

export function resolveHref(cmd: Command, slug: string | null): string | undefined {
  if (!cmd.href) return undefined;
  if (!cmd.brandScoped) return cmd.href;
  if (!slug) return "/dashboard/welcome";
  // brandScoped hrefs are suffixes ("", "/visibility", ...). Prefix them.
  return `/dashboard/b/${slug}${cmd.href}`;
}

// ---------- DO — verbs ----------
const DO: Command[] = [
  {
    id: "do.scan.run",
    group: "do",
    label: "Run visibility scan",
    aliases: ["scan", "check", "recheck", "run now"],
    hint: "Run a fresh scan across all active engines for the current brand",
    icon: Play,
    action: "/api/visibility-check",
    requiresBrand: true,
    weight: 100,
  },
  {
    id: "go.ws.brand",
    group: "go",
    label: "Open Brand workspace",
    aliases: ["workspace", "brand ws"],
    hint: "Open the full Brand workspace with all 11 tabs",
    icon: LineChart,
    href: "/dashboard/w/brand",
    weight: 76,
  },
  {
    id: "go.ws.prompt",
    group: "go",
    label: "Open a Prompt workspace",
    aliases: ["prompt workspace", "prompt ws"],
    hint: "Pick a tracked prompt to open its 9-tab workspace",
    icon: MessageSquare,
    href: "/dashboard/w/prompt",
    weight: 74,
  },
  {
    id: "go.ws.competitor",
    group: "go",
    label: "Open a Competitor workspace",
    aliases: ["competitor workspace", "competitor ws"],
    hint: "Pick a competitor to open its 7-tab workspace",
    icon: Swords,
    href: "/dashboard/w/competitor",
    weight: 73,
  },
  {
    id: "go.ws.campaign",
    group: "go",
    label: "Open a Campaign workspace",
    aliases: ["campaign workspace", "campaign ws"],
    hint: "Pick a campaign to open its 5-tab workspace",
    icon: Megaphone,
    href: "/dashboard/w/campaign",
    weight: 72,
  },
  {
    id: "go.ws.mission",
    group: "go",
    label: "Open a Mission workspace",
    aliases: ["mission workspace", "mission ws"],
    hint: "Pick a mission to open its 5-tab workspace",
    icon: Target,
    href: "/dashboard/w/mission",
    weight: 71,
  },
  {
    id: "go.ws.sprint",
    group: "go",
    label: "Open a Sprint workspace",
    aliases: ["sprint workspace", "sprint ws"],
    hint: "Pick a sprint to open its 5-tab workspace with burndown",
    icon: Rocket,
    href: "/dashboard/w/sprint",
    weight: 70,
  },
  {
    id: "go.ws.engine",
    group: "go",
    label: "Open an Engine workspace",
    aliases: ["engine workspace", "chatgpt", "perplexity", "gemini"],
    hint: "See how one AI engine covers your brand end-to-end",
    icon: Layers,
    href: "/dashboard/w/engine",
    weight: 69,
  },
  {
    id: "go.ws.content",
    group: "go",
    label: "Open a Content workspace",
    aliases: ["content workspace", "draft workspace", "content ws"],
    hint: "Edit a content draft with the E-E-A-T approval gate",
    icon: FileText,
    href: "/dashboard/w/content",
    weight: 68,
  },
  {
    id: "go.ws.opportunity",
    group: "go",
    label: "Open an Opportunity workspace",
    aliases: ["opportunity workspace", "opp ws"],
    hint: "Drill into a single recommendation with accept/dismiss actions",
    icon: Lightbulb,
    href: "/dashboard/w/opportunity",
    weight: 67,
  },
  {
    id: "go.ws.automation",
    group: "go",
    label: "Open an Automation workspace",
    aliases: ["automation workspace", "rule workspace"],
    hint: "Inspect an automation's trigger + actions and toggle it",
    icon: Workflow,
    href: "/dashboard/w/automation",
    weight: 66,
  },
  {
    id: "go.ws.alert",
    group: "go",
    label: "Open an Alert workspace",
    aliases: ["alert workspace", "alert rule"],
    hint: "See an alert rule's firing history and pause/resume it",
    icon: Bell,
    href: "/dashboard/w/alert",
    weight: 65,
  },
  {
    id: "go.ws.share",
    group: "go",
    label: "Open a Share workspace",
    aliases: ["share link", "public report", "share workspace"],
    hint: "Manage a report share link — expiry, revoke, copy URL",
    icon: Share2,
    href: "/dashboard/w/share",
    weight: 64,
  },
  {
    id: "go.ws.task",
    group: "go",
    label: "Open a Task workspace",
    aliases: ["task workspace", "task ws"],
    hint: "Pick a task to open its 4-tab workspace with verification",
    icon: ListTodo,
    href: "/dashboard/w/task",
    weight: 63,
  },
  {
    id: "go.ws.team",
    group: "go",
    label: "Open a Team workspace",
    aliases: ["team workspace", "team ws", "org team"],
    hint: "Pick a team to open its 3-tab workspace",
    icon: Users,
    href: "/dashboard/w/team",
    weight: 62,
  },
  {
    id: "go.ws.playbook",
    group: "go",
    label: "Open a Playbook workspace",
    aliases: ["playbook workspace", "playbook ws", "recipe", "template"],
    hint: "Pick a playbook template to inspect its step sequence",
    icon: ListChecks,
    href: "/dashboard/w/playbook",
    weight: 61,
  },
  {
    id: "go.ws.integration",
    group: "go",
    label: "Open an Integration workspace",
    aliases: ["integration workspace", "integration ws", "ga4", "shopify", "gsc"],
    hint: "Inspect a connected provider (GA4/Shopify/GSC) without exposing secrets",
    icon: Plug,
    href: "/dashboard/w/integration",
    weight: 60,
  },
  {
    id: "go.ws.site-audit",
    group: "go",
    label: "Open a Site Audit workspace",
    aliases: ["site audit workspace", "audit ws", "aeo audit"],
    hint: "Pick a site audit snapshot to inspect findings + score deltas",
    icon: ShieldCheck,
    href: "/dashboard/w/site-audit",
    weight: 59,
  },
  {
    id: "go.ws.approval",
    group: "go",
    label: "Open an Approval workspace",
    aliases: ["approval workspace", "sign off"],
    hint: "Pick a pending approval to review + decide",
    icon: CheckCheck,
    href: "/dashboard/w/approval",
    weight: 58,
  },
  {
    id: "do.report.generate",
    group: "do",
    label: "Generate report",
    aliases: ["export pdf", "cmo report", "download report"],
    hint: "Snapshot the current state to a PDF report",
    icon: FileDown,
    href: OBJECT_SUFFIXES.reports,
    brandScoped: true,
    requiresBrand: true,
    weight: 80,
  },
  {
    id: "do.copilot.ask",
    group: "do",
    label: "Ask Copilot",
    aliases: ["chat", "ai", "help", "why", "explain"],
    hint: "Ask the Copilot about the current object",
    icon: Bot,
    action: "copilot:open",
    weight: 90,
  },
  {
    id: "do.content.draft",
    group: "do",
    label: "Draft answer",
    aliases: ["write", "content", "answer"],
    hint: "Draft an answer for a tracked prompt in Content Studio",
    icon: Wand2,
    href: "/content",
    brandScoped: true,
    requiresBrand: true,
    weight: 70,
  },
  {
    id: "do.competitor.compare",
    group: "do",
    label: "Compare competitor",
    aliases: ["vs", "gap", "duel"],
    hint: "Compare your brand against a competitor",
    icon: Swords,
    href: OBJECT_SUFFIXES.competitors,
    brandScoped: true,
    requiresBrand: true,
    weight: 60,
  },
  {
    id: "do.campaign.launch",
    group: "do",
    label: "Launch campaign",
    aliases: ["new campaign", "start campaign"],
    hint: "Create a new campaign",
    icon: Megaphone,
    href: OBJECT_SUFFIXES.campaigns,
    brandScoped: true,
    requiresBrand: true,
    weight: 55,
  },
  {
    id: "do.opportunity.accept",
    group: "do",
    label: "Accept top opportunity",
    aliases: ["accept mission", "todays mission"],
    hint: "Accept the highest-priority opportunity as a mission",
    icon: Inbox,
    href: "/opportunities",
    brandScoped: true,
    requiresBrand: true,
    weight: 65,
  },
];

// ---------- GO — top-level objects (rail order) ----------
const GO: Command[] = [
  {
    id: "go.mission-control",
    group: "go",
    label: "Mission Control",
    aliases: ["home", "dashboard"],
    icon: Flag,
    href: OBJECT_SUFFIXES.missionControl,
    brandScoped: true,
    weight: 110,
  },
  {
    id: "go.brand",
    group: "go",
    label: "Brand · Visibility",
    aliases: ["visibility", "brand overview", "score"],
    icon: LineChart,
    href: OBJECT_SUFFIXES.brand,
    brandScoped: true,
    weight: 100,
  },
  {
    id: "go.competitors",
    group: "go",
    label: "Competitors",
    icon: Swords,
    href: OBJECT_SUFFIXES.competitors,
    brandScoped: true,
    weight: 90,
  },
  {
    id: "go.prompts",
    group: "go",
    label: "Prompts",
    aliases: ["tracked questions", "queries"],
    icon: MessageSquare,
    href: OBJECT_SUFFIXES.prompts,
    brandScoped: true,
    weight: 85,
  },
  {
    id: "go.campaigns",
    group: "go",
    label: "Campaigns",
    aliases: ["initiatives"],
    icon: Megaphone,
    href: OBJECT_SUFFIXES.campaigns,
    brandScoped: true,
    weight: 80,
  },
  {
    id: "go.reports",
    group: "go",
    label: "Reports",
    aliases: ["pdf", "cmo"],
    icon: FileDown,
    href: OBJECT_SUFFIXES.reports,
    brandScoped: true,
    weight: 78,
  },
  {
    id: "go.benchmark",
    group: "go",
    label: "Benchmark",
    aliases: ["leaderboard", "industry"],
    icon: Trophy,
    href: OBJECT_SUFFIXES.benchmark,
    brandScoped: true,
    weight: 75,
  },
  // Brand-scoped tabs (Phase 2b) — href is a suffix; resolveHref() prefixes /dashboard/b/<slug>.
  { id: "go.opportunities",  group: "go", label: "Opportunity Queue", aliases: ["fixes"], icon: Inbox, href: "/opportunities", brandScoped: true, requiresBrand: true, weight: 74 },
  { id: "go.alerts",         group: "go", label: "Alerts",            icon: Bell,       href: "/alerts",         brandScoped: true, requiresBrand: true, weight: 72 },
  { id: "go.citations",      group: "go", label: "Citations",         icon: FileSearch, href: "/citations",      brandScoped: true, requiresBrand: true, weight: 70 },
  { id: "go.site-audit",     group: "go", label: "Site Audit",        icon: ShieldCheck, href: "/site-audit",    brandScoped: true, requiresBrand: true, weight: 68 },
  { id: "go.ai-index",       group: "go", label: "AI Index",          icon: FileCode2,  href: "/ai-index",       brandScoped: true, requiresBrand: true, weight: 66 },
  { id: "go.content",        group: "go", label: "Content Studio",    icon: FileText,   href: "/content",        brandScoped: true, requiresBrand: true, weight: 65 },
  { id: "go.content-gaps",   group: "go", label: "Content Gaps",      icon: Lightbulb,  href: "/content/gaps",   brandScoped: true, requiresBrand: true, weight: 62 },
  { id: "go.answer-blocks",  group: "go", label: "Answer Blocks",     icon: LayoutList, href: "/answer-blocks",  brandScoped: true, requiresBrand: true, weight: 60 },
  { id: "go.pdp",            group: "go", label: "PDP Generator",     icon: Package,    href: "/pdp",            brandScoped: true, requiresBrand: true, weight: 58 },
  { id: "go.geo-lint",       group: "go", label: "GEO Linter",        icon: SpellCheck, href: "/geo-lint",       brandScoped: true, requiresBrand: true, weight: 56 },
  { id: "go.blind",          group: "go", label: "Organic Recall",    aliases: ["blind discovery"], icon: Eye, href: "/blind-discovery", brandScoped: true, requiresBrand: true, weight: 55 },
  { id: "go.fanout",         group: "go", label: "Fan-Out Coverage",  icon: Network,    href: "/fanout",         brandScoped: true, requiresBrand: true, weight: 54 },
  { id: "go.prompt-suite",   group: "go", label: "Prompt Suite",      icon: ListChecks, href: "/prompt-suite",   brandScoped: true, requiresBrand: true, weight: 53 },
  { id: "go.consistency",    group: "go", label: "Mention Consistency", icon: Activity, href: "/consistency",    brandScoped: true, requiresBrand: true, weight: 52 },
  { id: "go.positioning",    group: "go", label: "Positioning",       icon: Compass,    href: "/positioning",    brandScoped: true, requiresBrand: true, weight: 50 },
  { id: "go.signals",        group: "go", label: "Brand Signals",     icon: Radio,      href: "/signals",        brandScoped: true, requiresBrand: true, weight: 48 },
  { id: "go.gaps",           group: "go", label: "Topic Gaps",        icon: GitCompare, href: "/competitor-topics", brandScoped: true, requiresBrand: true, weight: 46 },
  { id: "go.gbp",            group: "go", label: "Local SEO (GBP)",   icon: MapPin,     href: "/gbp",            brandScoped: true, requiresBrand: true, weight: 44 },
  { id: "go.gsc",            group: "go", label: "GSC Index",         icon: Search,     href: "/gsc",            brandScoped: true, requiresBrand: true, weight: 43 },
  { id: "go.price",          group: "go", label: "Price Fact-Check",  icon: Store,      href: "/price-factcheck", brandScoped: true, requiresBrand: true, weight: 42 },
  { id: "go.tasks",          group: "go", label: "Task Board",        icon: ListTodo,   href: "/tasks",          brandScoped: true, requiresBrand: true, weight: 40 },
  { id: "go.approvals",      group: "go", label: "Approvals",         icon: CheckCheck, href: "/approvals",      brandScoped: true, requiresBrand: true, weight: 39 },
  { id: "go.automations",    group: "go", label: "Automations",       icon: Workflow,   href: "/automations",    brandScoped: true, requiresBrand: true, weight: 38 },
  { id: "go.citation-network", group: "go", label: "Citation Network", icon: Share2,   href: "/citation-network", brandScoped: true, requiresBrand: true, weight: 36 },
  { id: "go.revenue",        group: "go", label: "Revenue",           icon: IndianRupee, href: "/revenue",       brandScoped: true, requiresBrand: true, weight: 33, featureKey: "revenue_attribution" },
  // Org-level (stay outside /b/[slug]) — Executive/Agency read allBrands, settings live at org root.
  { id: "go.executive",      group: "go", label: "Executive View",    icon: BarChart3,  href: "/dashboard/executive", weight: 35 },
  { id: "go.agency",         group: "go", label: "Agency Workspace",  icon: Building2,  href: "/dashboard/agency",    weight: 34, featureKey: "agency" },
  { id: "go.integrations",   group: "go", label: "Integrations",      icon: Plug,       href: "/dashboard/settings/integrations", weight: 30 },
  { id: "go.billing",        group: "go", label: "Plan & Billing",    icon: IndianRupee, href: "/dashboard/settings/billing", weight: 28 },
  { id: "go.profile",        group: "go", label: "Profile",           icon: User,       href: "/dashboard/settings/profile", weight: 26 },
  { id: "go.members",        group: "go", label: "Members",           icon: Users,      href: "/dashboard/settings/members", weight: 25 },
  { id: "go.copilot",        group: "go", label: "Copilot (fullscreen)", icon: Bot,     href: "/dashboard/agent",     weight: 24 },
];

// ---------- HELP ----------
const HELP: Command[] = [
  {
    id: "do.copy-handle",
    group: "do",
    label: "Copy link to this workspace",
    aliases: ["share", "yank", "url", "clipboard", "paste"],
    hint: "Copies a markdown link + URL you can paste into Copilot, Slack, or another workspace.",
    icon: Share2,
    action: "workspace:copy-handle",
  },
  {
    id: "help.shortcuts",
    group: "help",
    label: "Keyboard shortcuts",
    aliases: ["hotkeys", "keys"],
    icon: Keyboard,
    action: "shortcuts:open",
  },
];

export const COMMANDS: Command[] = [...DO, ...GO, ...HELP];

// Pre-build a lookup by ID for external consumers (Shortcuts, Copilot).
export const COMMANDS_BY_ID = new Map(COMMANDS.map((c) => [c.id, c]));

// ---------- Search + ranking ----------
function haystack(cmd: Command): string {
  return (
    cmd.keywords ??
    [cmd.label, ...(cmd.aliases ?? []), cmd.hint ?? "", cmd.href ?? "", cmd.id]
      .join(" ")
      .toLowerCase()
  );
}

// Simple + fast fuzzy score: substring match wins; token-prefix match is next.
// For a 100-command list this is 100 string ops per keystroke — well below any
// perceptible latency. If the palette ever gets slow, swap for `fuzzysort`.
export function scoreCommand(cmd: Command, query: string): number {
  if (!query) return cmd.weight ?? 0;
  const q = query.toLowerCase().trim();
  const hay = haystack(cmd);
  const label = cmd.label.toLowerCase();

  // Exact label match dominates.
  if (label === q) return 10_000 + (cmd.weight ?? 0);
  // Label starts with query.
  if (label.startsWith(q)) return 5_000 + (cmd.weight ?? 0);
  // Token in the label starts with query.
  const labelTokens = label.split(/\s+/);
  if (labelTokens.some((t) => t.startsWith(q))) return 2_000 + (cmd.weight ?? 0);
  // Alias exact.
  if ((cmd.aliases ?? []).some((a) => a.toLowerCase() === q)) return 1_500 + (cmd.weight ?? 0);
  // Substring anywhere.
  if (hay.includes(q)) return 500 + (cmd.weight ?? 0);
  // No match.
  return -1;
}

export function filterCommands(query: string, opts: { hasBrand: boolean; lockedFeatures: Set<string> }): Command[] {
  const gated = COMMANDS.filter((c) => {
    if (c.requiresBrand && !opts.hasBrand) return false;
    if (c.featureKey && opts.lockedFeatures.has(c.featureKey)) return false;
    return true;
  });
  const scored = gated
    .map((c) => ({ c, s: scoreCommand(c, query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  return scored.map((x) => x.c);
}
