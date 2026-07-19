"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// ============================================================
// SavePromptGate — a persistent floating "save your report" bar that
// appears after the user has scrolled past 40% of the report.
//
// Rationale (from the redesign): the signup wall triggers AFTER value
// has been delivered, not before. We don't gate reading, we gate saving.
// ============================================================

export function SavePromptGate({ scanId }: { scanId: string }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastRun = 0;
    function onScroll() {
      const now = Date.now();
      if (now - lastRun < 100) return; // throttle
      lastRun = now;
      const doc = document.documentElement;
      const scrolled = window.scrollY / Math.max(1, doc.scrollHeight - doc.clientHeight);
      setVisible(scrolled > 0.4);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed || !visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 pl-5 shadow-2xl backdrop-blur md:inset-x-auto md:left-1/2 md:right-auto md:-translate-x-1/2 md:gap-4 md:p-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">Save this report</p>
        <p className="hidden truncate text-xs text-muted md:block">
          Track weekly, draft fixes, watch competitors. Signup takes 10 seconds.
        </p>
      </div>
      <Link
        href={`/signup?scan=${scanId}`}
        className="btn-primary !h-10 !px-4 !text-sm"
      >
        Save with Google
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="hidden shrink-0 rounded-full p-2 text-muted hover:bg-line/50 md:block"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      </button>
    </div>
  );
}
