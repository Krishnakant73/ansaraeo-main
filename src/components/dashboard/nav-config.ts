import {
  Home, MessageSquare, Activity, Eye, ListChecks, Network, LayoutList, SpellCheck, Flag, Inbox, ListTodo,
  Swords, Target, GitCompare, FileSearch, ShieldCheck, MapPin, FileCode2, FileCheck2,
  Compass, Megaphone, CalendarRange, Workflow, Users, BookOpen,
  Braces, Share2, FileStack, FileLock2, Link2, FileText, Wand2, Lightbulb, Package,
  Store, Search, Radio, IndianRupee, Bot, BarChart3, Plug, Settings, Bell, History,
  Trophy,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: typeof Home };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workflow",
    items: [
      { label: "Mission Control", href: "/dashboard/mission-control", icon: Flag },
      { label: "Opportunity Queue", href: "/dashboard/opportunities", icon: Inbox },
      { label: "Task Board", href: "/dashboard/tasks", icon: ListTodo },
      { label: "Approvals", href: "/dashboard/approvals", icon: ShieldCheck },
      { label: "Workflow Analytics", href: "/dashboard/workflow-analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Scale",
    items: [
      { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
      { label: "Sprints", href: "/dashboard/sprints", icon: CalendarRange },
      { label: "Automations", href: "/dashboard/automations", icon: Workflow },
      { label: "Teams", href: "/dashboard/teams", icon: Users },
      { label: "Playbooks", href: "/dashboard/playbooks", icon: BookOpen },
    ],
  },
  {
    label: "Monitor",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Home },
      { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
      { label: "Prompts", href: "/dashboard/prompts", icon: MessageSquare },
      { label: "Mention Consistency", href: "/dashboard/consistency", icon: Activity },
      { label: "Positioning", href: "/dashboard/positioning", icon: Compass },
      { label: "Blind Discovery", href: "/dashboard/blind-discovery", icon: Eye },
      { label: "Prompt Suite", href: "/dashboard/prompt-suite", icon: ListChecks },
      { label: "Fan-Out Coverage", href: "/dashboard/fanout", icon: Network },
      { label: "Answer Blocks", href: "/dashboard/answer-blocks", icon: LayoutList },
      { label: "GEO Linter", href: "/dashboard/geo-lint", icon: SpellCheck },
    ],
  },
  {
    label: "Competitive",
    items: [
      { label: "Competitors", href: "/dashboard/competitors", icon: Swords },
      { label: "Competitor Intel", href: "/dashboard/competitors/intelligence", icon: Target },
      { label: "Topic Gaps", href: "/dashboard/competitor-topics", icon: GitCompare },
      { label: "Citations", href: "/dashboard/citations", icon: FileSearch },
    ],
  },
  {
    label: "Technical & Site",
    items: [
      { label: "Site Audit", href: "/dashboard/site-audit", icon: ShieldCheck },
      { label: "Local SEO", href: "/dashboard/gbp", icon: MapPin },
      { label: "AI Index", href: "/dashboard/ai-index", icon: FileCode2 },
      { label: "llms.txt Validator", href: "/dashboard/llms-txt", icon: FileCheck2 },
      { label: "Schema-for-AI", href: "/dashboard/schema", icon: Braces },
      { label: "Internal Links", href: "/dashboard/internal-links", icon: Share2 },
      { label: "Token Bloat", href: "/dashboard/token-bloat", icon: FileStack },
      { label: "Robots Check", href: "/dashboard/robots", icon: FileLock2 },
      { label: "Header & Link Graph", href: "/dashboard/header-links", icon: Link2 },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Content Studio", href: "/dashboard/content", icon: FileText },
      { label: "Content Optimizer", href: "/dashboard/content/optimizer", icon: Wand2 },
      { label: "Content Gaps", href: "/dashboard/content/gaps", icon: Lightbulb },
      { label: "PDP Generator", href: "/dashboard/pdp", icon: Package },
      { label: "Price Fact-Check", href: "/dashboard/price-factcheck", icon: Store },
    ],
  },
  {
    label: "Growth & Data",
    items: [
      { label: "GSC Index", href: "/dashboard/gsc", icon: Search },
      { label: "Brand Signals", href: "/dashboard/signals", icon: Radio },
      { label: "Revenue", href: "/dashboard/revenue", icon: IndianRupee },
      { label: "Agent", href: "/dashboard/agent", icon: Bot },
      { label: "History", href: "/dashboard/history", icon: History },
      { label: "Benchmark Center", href: "/dashboard/benchmark", icon: Trophy },
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Leadership",
    items: [
      { label: "Executive Dashboard", href: "/dashboard/executive", icon: BarChart3 },
      { label: "Agency Workspace", href: "/dashboard/agency", icon: Store },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Integrations", href: "/dashboard/settings/integrations", icon: Plug },
      { label: "Billing", href: "/dashboard/settings/billing", icon: Settings },
    ],
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
