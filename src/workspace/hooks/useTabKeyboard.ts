"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ============================================================
// useTabKeyboard — spec keyboard map for a workspace tab bar.
//
// Wired keys:
//   [ / ]         previous / next tab (wraps)
//   1..9          jump to tab N (1-indexed)
//   Esc           blur active input / clear focus ring
//
// Never fires while:
//   • an editable element (input, textarea, contentEditable) has focus
//   • a modal (dialog, command palette) is open (marked by [data-modal-open])
//   • ⌘ / Ctrl / Alt is held (leaves those combos to the browser + palette)
// ============================================================

// The hook only ever reads `key`, but is generic so callers can pass a
// full TabDef<T> array without an intermediate .map() to strip fields.
type MinTab = { key: string };

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function isModalOpen(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector("[data-modal-open], [data-palette-open]");
}

export function useTabKeyboard<T extends MinTab>(
  tabs: T[],
  activeIndex: number,
  hrefFor: (tab: T) => string,
) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      if (isModalOpen()) return;

      if (e.key === "[") {
        e.preventDefault();
        const next = tabs.length ? (activeIndex - 1 + tabs.length) % tabs.length : 0;
        router.push(hrefFor(tabs[next]));
        emitSwitched(tabs[next]?.key);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        const next = tabs.length ? (activeIndex + 1) % tabs.length : 0;
        router.push(hrefFor(tabs[next]));
        emitSwitched(tabs[next]?.key);
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < tabs.length) {
          e.preventDefault();
          router.push(hrefFor(tabs[idx]));
          emitSwitched(tabs[idx].key);
        }
        return;
      }
      if (e.key === "Escape") {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeIndex, hrefFor, router]);
}

function emitSwitched(tabKey: string | undefined) {
  if (!tabKey || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("workspace:tab-switched", { detail: { tabKey } }),
  );
}
