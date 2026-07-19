"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell, Bot, Building2, Flag, FileDown, IndianRupee, LayoutGrid, LineChart, Megaphone,
  MessageSquare, Plug, ShieldCheck, Swords, Trophy, User, Users,
  ChevronDown, MoreHorizontal, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType, SVGProps } from "react";

// ============================================================
// ObjectsRail — 8 pinned Objects + Recent Objects + Settings.
//
// Replaces the flat 10-group nav with the object-first mental model.
// Everything else the user could reach in the old nav is now reachable
// via the Command Palette (⌘K) — see CommandPalette.tsx.
//
// "Recent" is client-only in Phase 1 (localStorage), server-backed in
// Phase 2 (recent_objects table, RLS-scoped, capped per user).
// ============================================================

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type RailItem = { label: string; href: string; icon: Icon; kbd?: string };

// Phase 2: pinned items are brand-scoped. Suffixes are prefixed with
// `/dashboard/b/<slug>` at render time. When no brand is active, we
// fall back to /dashboard/welcome so the rail still resolves.
type PinnedDef = { label: string; suffix: string; icon: Icon; kbd?: string };
const PINNED_DEFS: PinnedDef[] = [
  { label: "Mission Control", suffix: "",             icon: Flag,          kbd: "M" },
  { label: "Brand",           suffix: "/visibility",  icon: LineChart,     kbd: "B" },
  { label: "Competitors",     suffix: "/competitors", icon: Swords,        kbd: "C" },
  { label: "Prompts",         suffix: "/prompts",     icon: MessageSquare, kbd: "P" },
  { label: "Campaigns",       suffix: "/campaigns",   icon: Megaphone,     kbd: "X" },
  { label: "Reports",         suffix: "/reports",     icon: FileDown,      kbd: "R" },
  { label: "Benchmark",       suffix: "/benchmark",   icon: Trophy,        kbd: "N" },
];

function buildPinned(slug: string | null): RailItem[] {
  return PINNED_DEFS.map((p) => ({
    label: p.label,
    icon: p.icon,
    kbd: p.kbd,
    href: slug ? `/dashboard/b/${slug}${p.suffix}` : "/dashboard/welcome",
  }));
}

// Phase 2b: "More tools" items that need a brand — surfaced brand-scoped
// like the pinned ones. Copilot fullscreen is org-level (URL-agnostic).
type SecondaryDef = { label: string; suffix?: string; href?: string; icon: Icon };
const SECONDARY_DEFS: SecondaryDef[] = [
  { label: "Alerts",           suffix: "/alerts",         icon: Bell },
  { label: "Opportunities",    suffix: "/opportunities",  icon: Search },
  { label: "Site Audit",       suffix: "/site-audit",     icon: ShieldCheck },
  { label: "Workspaces",       href: "/dashboard/w",      icon: LayoutGrid },
  { label: "Copilot",          href: "/dashboard/agent",  icon: Bot },
];

function buildSecondary(slug: string | null): RailItem[] {
  return SECONDARY_DEFS.map((d) => ({
    label: d.label,
    icon: d.icon,
    href: d.href ?? (slug ? `/dashboard/b/${slug}${d.suffix}` : "/dashboard/welcome"),
  }));
}

const SETTINGS_ITEMS: RailItem[] = [
  { label: "Plan & Billing",   href: "/dashboard/settings/billing",       icon: IndianRupee },
  { label: "Profile",          href: "/dashboard/settings/profile",       icon: User },
  { label: "Organization",     href: "/dashboard/settings/org",           icon: Building2 },
  { label: "Members",          href: "/dashboard/settings/members",       icon: Users },
  { label: "Integrations",     href: "/dashboard/settings/integrations",  icon: Plug },
];

const RECENT_KEY = "aeo.rail.recent.v1";
const RECENT_MAX = 5;

// Route → { label, icon } lookup for rendering Recent rows without another
// registry to keep in sync. Only SECONDARY + SETTINGS are here because
// PINNED items are dynamic per-brand and never surface in Recent (they're
// pinned; showing them twice would be silly).
// Only stable (non-brand-scoped) items go here — brand-scoped SECONDARY
// items are per-brand so they can't appear in Recent (they'd double-count
// with the pinned ones anyway).
const KNOWN_ROUTES: Record<string, { label: string; icon: Icon }> = Object.fromEntries(
  [...SETTINGS_ITEMS, { label: "Copilot", href: "/dashboard/agent", icon: Bot }]
    .map((i) => [i.href, { label: i.label, icon: i.icon }]),
);

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/dashboard/welcome") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// Record the current path in Recent — called from Rail once per pathname
// change, deduped and capped. Brand-scoped paths (/dashboard/b/*) are
// intentionally excluded — they're already pinned.
function pushRecent(pathname: string) {
  if (typeof window === "undefined") return;
  if (pathname.startsWith("/dashboard/b/")) return;
  if (!KNOWN_ROUTES[pathname]) return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const cur: string[] = raw ? JSON.parse(raw) : [];
    const next = [pathname, ...cur.filter((p) => p !== pathname)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("rail:recent-changed"));
  } catch {
    /* ignore */
  }
}

function useRecent(pathname: string): string[] {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        if (!raw) return setRecent([]);
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecent(arr.filter((p) => KNOWN_ROUTES[p]).slice(0, RECENT_MAX));
      } catch {
        setRecent([]);
      }
    }
    read();
    window.addEventListener("rail:recent-changed", read);
    return () => window.removeEventListener("rail:recent-changed", read);
  }, []);

  useEffect(() => {
    pushRecent(pathname);
  }, [pathname]);

  return recent;
}

function RailLink({ item, pathname, onNavigate }: { item: RailItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface hover:text-ink",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.kbd && (
        <span
          className={cn(
            "hidden shrink-0 rounded border px-1.5 text-[10px] font-semibold tabular-nums lg:inline-block",
            active ? "border-accent/30 text-accent/70" : "border-line text-muted/70 group-hover:text-muted",
          )}
          aria-hidden
          title={`Press G then ${item.kbd}`}
        >
          G {item.kbd}
        </span>
      )}
    </Link>
  );
}

export default function ObjectsRail({
  brandSlug,
  onNavigate,
}: {
  brandSlug: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const recent = useRecent(pathname);
  const pinned = buildPinned(brandSlug);
  const secondary = buildSecondary(brandSlug);
  // Recent list excludes anything already pinned so the rail stays clean.
  const pinnedSet = new Set(pinned.map((i) => i.href));
  const recentItems = recent
    .filter((href) => !pinnedSet.has(href))
    .map((href) => ({ href, ...KNOWN_ROUTES[href] }));

  const [showAll, setShowAll] = useState(false);

  return (
    <nav aria-label="Objects" className="space-y-4">
      <div>
        <p className="nav-group-label">Objects</p>
        <div className="space-y-0.5">
          {pinned.map((i) => (
            <RailLink key={i.href} item={i} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {recentItems.length > 0 && (
        <div>
          <p className="nav-group-label">Recent</p>
          <div className="space-y-0.5">
            {recentItems.map((i) => (
              <RailLink
                key={i.href}
                item={{ label: i.label, href: i.href, icon: i.icon }}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted/80 transition-colors hover:text-ink"
          aria-expanded={showAll}
        >
          <span className="inline-flex items-center gap-1.5">
            <MoreHorizontal className="h-3.5 w-3.5" /> More tools
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
        </button>
        {showAll && (
          <div className="mt-1 space-y-0.5">
            {secondary.map((i) => (
              <RailLink key={i.href} item={i} pathname={pathname} onNavigate={onNavigate} />
            ))}
            <div className="px-3 pt-2 text-[11px] text-muted">
              Press{" "}
              <kbd className="rounded border border-line bg-surface px-1 text-[10px] font-semibold">⌘K</kbd>{" "}
              to search 50+ tools.
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export { SETTINGS_ITEMS };
