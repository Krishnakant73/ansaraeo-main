"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================
// CopyHandle — shell-level cross-workspace copy action.
//
// One mount per workspace (via WorkspaceShell). Listens for:
//   - keyboard `y` (vim-style yank; unused elsewhere)
//   - programmatic CustomEvent `workspace:copy-handle`
//
// On fire, reads the shell's `data-copilot-context` (already emitted
// by WorkspaceShell for CopilotDock) and copies BOTH a markdown link
// `[Label](absolute-url)` and the plain absolute URL to the clipboard.
// Markdown paste-anywhere means Copilot / Slack / notes / another
// workspace all render the object as a real link — the whole point of
// cross-workspace copy.
//
// The `y` shortcut is inert while an editable/modal has focus, matching
// QuickActionsBar's rules so we never eat typing in the palette or a
// Copilot input.
// ============================================================

type CopilotCtx = {
  kind?: string;
  label?: string;
  id?: string;
};

function readCtx(): CopilotCtx | null {
  if (typeof document === "undefined") return null;
  const root = document.querySelector<HTMLElement>("[data-workspace-kind][data-copilot-context]");
  if (!root) return null;
  const raw = root.getAttribute("data-copilot-context");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CopilotCtx;
  } catch {
    return null;
  }
}

async function writeClipboard(text: string, html?: string): Promise<boolean> {
  try {
    // Rich paste (markdown + plain) when the browser supports it: paste into
    // apps that respect text/html gets the anchor tag; anything else falls
    // back to the markdown source. Both are useful.
    if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyHandle() {
  const [toast, setToast] = useState<string | null>(null);

  const copy = useCallback(async () => {
    const ctx = readCtx();
    const label = ctx?.label?.trim() || document.title || "Workspace";
    const url = window.location.href;
    const markdown = `[${label}](${url})`;
    const escaped = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<a href="${url}">${escaped}</a>`;
    const ok = await writeClipboard(markdown, html);
    setToast(ok ? `Copied — ${label}` : "Copy failed");
    setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector("[data-modal-open], [data-palette-open]")) return;
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        void copy();
      }
    }
    function onEvent() {
      void copy();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("workspace:copy-handle", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("workspace:copy-handle", onEvent);
    };
  }, [copy]);

  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-white/95 px-4 py-2 text-sm text-ink shadow-lg backdrop-blur"
    >
      {toast}
    </div>
  );
}
