"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { QuickAction } from "../core";

// ============================================================
// QuickActionsBar — client bar rendered from descriptor.quickActions.
// Actions are serializable: each is either an <Link href> or a client
// CustomEvent dispatched by name (so a listener elsewhere can handle
// it without importing anything from UWE).
//
// Each action can bind a single keyboard letter. Uniqueness is a
// descriptor contract (validated in dev via a warning if duplicates
// ship). Shortcuts skip when an editable/modal has focus.
// ============================================================

export default function QuickActionsBar({
  actions,
}: {
  actions: QuickAction[];
}) {
  const fire = useCallback((a: QuickAction) => {
    if (a.href) {
      // Let the browser + Next router handle it via anchor click.
      window.location.assign(a.href);
      return;
    }
    if (a.event && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(a.event.name, { detail: a.event.detail }));
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const seen = new Set<string>();
      for (const a of actions) {
        if (a.keyboard) {
          if (seen.has(a.keyboard)) {
             
            console.warn(`[workspace] duplicate quick action key "${a.keyboard}"`);
          }
          seen.add(a.keyboard);
        }
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector("[data-modal-open], [data-palette-open]")) return;
      const hit = actions.find(
        (a) => a.keyboard && a.keyboard.toLowerCase() === e.key.toLowerCase(),
      );
      if (hit) {
        e.preventDefault();
        fire(hit);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, fire]);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        const variant = a.variant ?? "ghost";
        const tone =
          variant === "primary"
            ? "btn-sm"
            : variant === "danger"
              ? "btn-xs bg-rose-600 text-white hover:bg-rose-700"
              : "btn-ghost";
        const kbd = a.keyboard ? (
          <kbd className="ml-1 rounded border border-line bg-white px-1 text-[10px] text-muted">
            {a.keyboard.toUpperCase()}
          </kbd>
        ) : null;
        const body = (
          <>
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            <span>{a.label}</span>
            {kbd}
          </>
        );
        if (a.href) {
          return (
            <Link
              key={a.id}
              href={a.href}
              className={cn(tone, "gap-1.5")}
              title={a.keyboard ? `Shortcut: ${a.keyboard.toUpperCase()}` : undefined}
            >
              {body}
            </Link>
          );
        }
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => fire(a)}
            className={cn(tone, "gap-1.5")}
            title={a.keyboard ? `Shortcut: ${a.keyboard.toUpperCase()}` : undefined}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
