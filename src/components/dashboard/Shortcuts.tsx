"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Keyboard, CornerDownLeft } from "lucide-react";
import { SECTION_KEYS } from "./nav-config";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================
// Shortcuts — global keyboard model.
//
// Two categories:
//   • G+letter — jump to an Object (or legacy job section)
//   • Direct   — Copilot (t), palette (⌘K), help (?)
//
// Object keys mirror the rail order: M B C P X R N.
// Legacy job keys (D/I/O/W/A/E/S) keep working via SECTION_KEYS so
// muscle memory from the old nav doesn't break.
// ============================================================

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

const OBJECT_JUMPS: { key: string; label: string }[] = [
  { key: "M", label: "Mission Control" },
  { key: "B", label: "Brand · Visibility" },
  { key: "C", label: "Competitors" },
  { key: "P", label: "Prompts" },
  { key: "X", label: "Campaigns" },
  { key: "R", label: "Reports" },
  { key: "N", label: "Benchmark" },
];

const DIRECT: { keys: string; label: string }[] = [
  { keys: "⌘K", label: "Command palette (find or run anything)" },
  { keys: "T",  label: "Toggle Copilot dock" },
  { keys: "Y",  label: "Copy link to this workspace (yank)" },
  { keys: "?",  label: "This shortcuts sheet" },
  { keys: "ESC", label: "Close palette / dock / modal" },
];

export default function Shortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  useEffect(() => {
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((s) => !s);
        return;
      }
      if (e.key.toLowerCase() === "g") {
        setPendingG(true);
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => setPendingG(false), 800);
        return;
      }
      if (pendingG) {
        const dest = SECTION_KEYS[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          setPendingG(false);
          router.push(dest);
        }
      }
    }
    function onOpen() {
      setShowHelp(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("shortcuts:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("shortcuts:open", onOpen);
    };
  }, [pendingG, router]);

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="flex items-center gap-2 text-base font-bold">
          <Keyboard className="h-4 w-4" /> Keyboard shortcuts
        </DialogTitle>
        <div className="mt-4 space-y-5 text-sm">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Jump to an object
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-muted">
              <span>Press</span>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px]">G</kbd>
              <span>then</span>
              {OBJECT_JUMPS.map((j, i) => (
                <span key={j.key} className="flex items-center gap-1.5">
                  {i > 0 && <span className="opacity-40">·</span>}
                  <kbd
                    className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px]"
                    title={j.label}
                  >
                    {j.key}
                  </kbd>
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Direct
            </p>
            <ul className="space-y-1.5 text-muted">
              {DIRECT.map((d) => (
                <li key={d.keys} className="flex items-center justify-between">
                  <span>{d.label}</span>
                  <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px]">
                    {d.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>

          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <CornerDownLeft className="h-3.5 w-3.5" /> Tip: the palette also runs actions —
            &ldquo;Run scan&rdquo;, &ldquo;Generate report&rdquo;, &ldquo;Ask Copilot&rdquo;.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
