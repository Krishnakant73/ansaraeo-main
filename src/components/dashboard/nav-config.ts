import {
  Flag, Bell, Inbox, LineChart, FileDown, Eye, Network, ListChecks, User,
  Swords, Target, Compass, Radio, FileSearch, GitCompare,
  ShieldCheck, FileCode2, MapPin, Search, FileText, Wand2, Lightbulb,
  Package, LayoutList, SpellCheck, Store, MessageSquare, Activity,
  ListTodo, CheckCheck, Workflow, CalendarRange, Megaphone, Users,
  BookOpen, History, BarChart3, Bot, Rocket, Building2, Trophy,
  Plug, Terminal, IndianRupee, Braces, FileCheck2, FileLock2,
  Share2, FileStack, Link2,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: typeof Flag };
export type NavGroup = { label: string; items: NavItem[]; advanced?: boolean };

// Primary navigation is organized by JOBS-TO-BE-DONE, not engineering modules.
// The 9 jobs are the only top-level mental model a user must learn.
// "Advanced" holds power tools (deep validators) — collapsed out of the default
// mental model; they surface contextually when an audit flags them (Phase 2).
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Mission Control",
    items: [
      { label: "Mission Control", href: "/dashboard", icon: Flag },
      { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
      { label: "Opportunity Queue", href: "/dashboard/opportunities", icon: Inbox },
      { label: "Executive View", href: "/dashboard/executive", icon: LineChart },
      { label: "Reports (PDF)", href: "/dashboard/reports", icon: FileDown },
    ],
  },
  {
    label: "Discovery",
    items: [
      { label: "Organic Recall", href: "/dashboard/blind-discovery", icon: Eye },
      { label: "Fan-Out Coverage", href: "/dashboard/fanout", icon: Network },
      { label: "Prompt Suite", href: "/dashboard/prompt-suite", icon: ListChecks },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Competitors", href: "/dashboard/competitors", icon: Swords },
      { label: "Battlecards / Why They Win", href: "/dashboard/competitors/intelligence", icon: Target },
      { label: "Positioning", href: "/dashboard/positioning", icon: Compass },
      { label: "Brand Signals", href: "/dashboard/signals", icon: Radio },
      { label: "Citations", href: "/dashboard/citations", icon: FileSearch },
      { label: "Topic Gaps", href: "/dashboard/competitor-topics", icon: GitCompare },
    ],
  },
  {
    label: "Optimization",
    items: [
      { label: "Site Audit", href: "/dashboard/site-audit", icon: ShieldCheck },
      { label: "AI Index", href: "/dashboard/ai-index", icon: FileCode2 },
      { label: "Local SEO", href: "/dashboard/gbp", icon: MapPin },
      { label: "GSC Index", href: "/dashboard/gsc", icon: Search },
      { label: "Content Studio", href: "/dashboard/content", icon: FileText },
      { label: "Content Optimizer", href: "/dashboard/content/optimizer", icon: Wand2 },
      { label: "Content Gaps", href: "/dashboard/content/gaps", icon: Lightbulb },
      { label: "PDP Generator", href: "/dashboard/pdp", icon: Package },
      { label: "Answer Blocks", href: "/dashboard/answer-blocks", icon: LayoutList },
      { label: "GEO Linter", href: "/dashboard/geo-lint", icon: SpellCheck },
      { label: "Price Fact-Check", href: "/dashboard/price-factcheck", icon: Store },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Prompts", href: "/dashboard/prompts", icon: MessageSquare },
      { label: "Mention Consistency", href: "/dashboard/consistency", icon: Activity },
      { label: "Tasks", href: "/dashboard/tasks", icon: ListTodo },
      { label: "Approvals", href: "/dashboard/approvals", icon: CheckCheck },
      { label: "Automations", href: "/dashboard/automations", icon: Workflow },
      { label: "Sprints", href: "/dashboard/sprints", icon: CalendarRange },
      { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
      { label: "Teams", href: "/dashboard/teams", icon: Users },
      { label: "Playbooks", href: "/dashboard/playbooks", icon: BookOpen },
      { label: "History", href: "/dashboard/history", icon: History },
      { label: "Workflow Analytics", href: "/dashboard/workflow-analytics", icon: BarChart3 },
      { label: "Copilot", href: "/dashboard/agent", icon: Bot },
      { label: "Onboarding", href: "/dashboard/onboarding", icon: Rocket },
    ],
  },
  {
    label: "Agency",
    items: [
      { label: "Agency Workspace", href: "/dashboard/agency", icon: Building2 },
      { label: "Client Reports", href: "/dashboard/reports", icon: FileDown },
    ],
  },
  {
    label: "Intelligence Network",
    items: [
      { label: "Benchmark & Leaderboard", href: "/dashboard/benchmark", icon: Trophy },
      { label: "Citation Network", href: "/dashboard/citation-network", icon: Share2 },
    ],
  },
  {
    label: "Ecosystem",
    items: [
      { label: "Integrations", href: "/dashboard/settings/integrations", icon: Plug },
      { label: "API & Developer", href: "/dashboard/ecosystem", icon: Terminal },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Plan & Billing", href: "/dashboard/settings/billing", icon: IndianRupee },
      { label: "Profile", href: "/dashboard/settings/profile", icon: User },
      { label: "Organization", href: "/dashboard/settings/org", icon: Building2 },
      { label: "Members", href: "/dashboard/settings/members", icon: Users },
      { label: "Notifications", href: "/dashboard/settings/notifications", icon: Bell },
      { label: "Security", href: "/dashboard/settings/security", icon: ShieldCheck },
    ],
  },
  {
    label: "Advanced",
    advanced: true,
    items: [
      { label: "Schema-for-AI", href: "/dashboard/schema", icon: Braces },
      { label: "llms.txt Validator", href: "/dashboard/llms-txt", icon: FileCheck2 },
      { label: "Robots Check", href: "/dashboard/robots", icon: FileLock2 },
      { label: "Internal Links", href: "/dashboard/internal-links", icon: Share2 },
      { label: "Token Bloat", href: "/dashboard/token-bloat", icon: FileStack },
      { label: "Header & Link Graph", href: "/dashboard/header-links", icon: Link2 },
    ],
  },
];

// Section anchors for the G+letter keyboard jump (see Shortcuts.tsx).
// Object keys (M B C P X R N) mirror the ObjectsRail order. Legacy keys
// stay mapped so muscle memory from the old jobs-to-be-done nav still
// works — no breakage on rebind.
export const SECTION_KEYS: Record<string, string> = {
  // Objects
  m: "/dashboard",
  b: "/dashboard/visibility",
  c: "/dashboard/competitors",
  p: "/dashboard/prompts",
  x: "/dashboard/campaigns",
  r: "/dashboard/reports",
  n: "/dashboard/benchmark",
  // Legacy jobs (deprecated but honored)
  d: "/dashboard/blind-discovery",
  i: "/dashboard/competitors",
  o: "/dashboard/site-audit",
  w: "/dashboard/prompts",
  a: "/dashboard/agency",
  e: "/dashboard/settings/integrations",
  s: "/dashboard/settings/billing",
};

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

// ============================================================
// FEATURE_TO_NAV_HREFS — feature-unlock gating.
//
// Maps a nav href to the FeatureKey(s) it advertises. A nav item is
// hidden if ALL of its listed features are locked; if the list is empty
// (or the href is missing from this map), the item is always visible.
// Kept as string-keyed values so this file doesn't import feature-unlock.
// ============================================================
export const FEATURE_TO_NAV_HREFS: Record<string, string[]> = {
  // Answer/content authoring — unlocked by first draft
  "/dashboard/answer-blocks": ["answer_blocks"],
  "/dashboard/geo-lint": ["geo_linter"],
  "/dashboard/schema": ["schema_for_ai"],
  "/dashboard/content/optimizer": ["content_optimizer"],
  // Citation surfaces — unlocked by first detected mention
  "/dashboard/citations": ["citations"],
  "/dashboard/citation-network": ["citation_network"],
  // Technical / site — unlocked ~week 2
  "/dashboard/site-audit": ["site_audit"],
  "/dashboard/ai-index": ["ai_index"],
  "/dashboard/llms-txt": ["llms_txt"],
  "/dashboard/robots": ["robots_check"],
  // Outcome layer — unlocked ~month 2
  "/dashboard/revenue": ["revenue_attribution"],
  "/dashboard/gsc": ["gsc"],
  "/dashboard/gbp": ["gbp"],
  "/dashboard/benchmark": ["benchmark"],
  // Agency / enterprise-only
  "/dashboard/agency": ["agency"],
  "/dashboard/campaigns": ["campaigns"],
  "/dashboard/playbooks": ["playbooks"],
  // Onboarding entry point stays discoverable only when not welcomed —
  // keeping empty list here means "always visible" so the fallback path
  // works. The welcome flow itself is not a nav item.
  "/dashboard/onboarding": [],
};
