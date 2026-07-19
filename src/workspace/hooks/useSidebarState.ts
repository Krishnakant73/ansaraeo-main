"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================
// useSidebarState — collapse state for the workspace right sidebar.
// Persisted per-kind so switching Brand → Prompt keeps user intent.
// `.` toggles when no editable/modal has focus (see useTabKeyboard).
// ============================================================

const STORAGE_KEY = "uwe:sidebar-collapsed";

function readCollapsed(kind: string, def: boolean): boolean {
  if (typeof window === "undefined") return def;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${kind}`);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // ignore
  }
  return def;
}

function writeCollapsed(kind: string, collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${kind}`, collapsed ? "1" : "0");
  } catch {
    // ignore
  }
}

export function useSidebarState(kind: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  useEffect(() => {
    setCollapsed(readCollapsed(kind, defaultCollapsed));
  }, [kind, defaultCollapsed]);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      writeCollapsed(kind, next);
      return next;
    });
  }, [kind]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector("[data-modal-open], [data-palette-open]")) return;
      if (e.key === ".") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { collapsed, setCollapsed, toggle };
}
