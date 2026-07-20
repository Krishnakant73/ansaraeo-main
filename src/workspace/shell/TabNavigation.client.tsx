"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTabKeyboard } from "../hooks/useTabKeyboard";
import type { TabDef } from "../core";

// ============================================================
// TabNavigation — sticky, scrollable tab bar. Keyboard shortcuts
// (`[` `]` `1..9`) live here so they only bind when a workspace
// is mounted. The bar is client-side, but each tab is a plain
// <Link> so server components down the tree keep working.
//
// href builder is passed in so the shell owns URL grammar (this
// component works for /w/[kind]/[slug] and any future variants).
// ============================================================

 
type Tab = TabDef<any>;

export default function TabNavigation({
  tabs,
  activeKey,
  baseHref,
  kindLabel,
}: {
  tabs: Tab[];
  activeKey?: string;
  baseHref: string;
  kindLabel: string;
}) {
  // When the layout doesn't pin activeKey we read it from the URL —
  // useSelectedLayoutSegment returns the child [tab] segment, or null
  // when we're on the default tab (page.tsx at the layout's own level).
  const segment = useSelectedLayoutSegment();
  const resolvedActive = activeKey ?? segment ?? tabs[0]?.key;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === resolvedActive),
  );
  const hrefFor = useCallback(
    (t: Tab) => `${baseHref.replace(/\/$/, "")}/${t.key}`,
    [baseHref],
  );

  useTabKeyboard(tabs, activeIndex, hrefFor);

  return (
    <nav
      role="tablist"
      aria-label={`${kindLabel} workspace tabs`}
      className="workspace-tabs sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-line bg-white px-4"
      style={{ minHeight: "var(--ws-tab-h)" }}
    >
      {tabs.map((t, i) => {
        const active = t.key === resolvedActive;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            href={hrefFor(t)}
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("workspace:tab-switched", { detail: { tabKey: t.key } }),
                );
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
              active ? "border-b-2 border-accent text-accent" : "text-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            <span>{t.label}</span>
            {i < 9 && (
              <kbd className="ml-1 hidden rounded border border-line px-1 text-[10px] text-muted sm:inline">
                {i + 1}
              </kbd>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
