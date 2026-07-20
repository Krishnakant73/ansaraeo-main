"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, CornerDownLeft, Loader2, Megaphone, MessageSquare, Search, Swords, Target,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  filterCommands,
  resolveHref,
  type Command,
  type CommandGroup,
} from "@/lib/command-registry";

// ============================================================
// CommandPalette — the ⌘K IA.
//
// Groups results into DO / GO / JUMP / ASK / RECENT / HELP.
// Recent selections persist to localStorage (client-only; a proper
// recent_objects server table lands in Phase 2).
//
// The palette dispatches three action shapes:
//   • href                     → router.push
//   • action: "copilot:<cmd>"  → window.dispatchEvent("copilot:open")
//   • action: "<endpoint>"     → POST + toast, refresh on 2xx
//
// The Copilot dock listens for "copilot:open" and takes ownership.
// ============================================================

const RECENT_KEY = "aeo.palette.recent.v1";
const RECENT_MAX = 8;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const cur = readRecent().filter((x) => x !== id);
    cur.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
  } catch {
    /* quota; ignore */
  }
}

const GROUP_LABEL: Record<CommandGroup | "recent" | "ask" | "objects", string> = {
  do: "Do",
  go: "Go",
  jump: "Jump",
  ask: "Ask Copilot",
  recent: "Recent",
  help: "Help",
  objects: "Open object",
};

const GROUP_ORDER: (keyof typeof GROUP_LABEL)[] = ["recent", "objects", "do", "go", "jump", "ask", "help"];

// Kinds returned by /api/palette/search. Kept in sync with the API route.
type ObjectKind = "brand" | "prompt" | "competitor" | "mission" | "campaign";
type ObjectResult = { kind: ObjectKind; id: string; label: string; sublabel?: string };

const OBJECT_ICONS: Record<ObjectKind, typeof Search> = {
  brand: Building2,
  prompt: MessageSquare,
  competitor: Swords,
  mission: Target,
  campaign: Megaphone,
};

// The workspace's first tab varies by kind; default to "overview" — every
// registered workspace exposes an overview tab as the first entry.
function objectHref(kind: ObjectKind, id: string): string {
  return `/dashboard/w/${kind}/${id}/overview`;
}

export default function CommandPalette({
  hasBrand,
  lockedFeatures,
  brandSlug,
}: {
  hasBrand: boolean;
  lockedFeatures: string[];
  brandSlug: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [objects, setObjects] = useState<ObjectResult[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);

  const lockedSet = useMemo(() => new Set(lockedFeatures), [lockedFeatures]);

  // Toggle on ⌘K / Ctrl+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Also open on custom event so the topbar chip / mobile trigger can share
  // one implementation with the shortcut.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("palette:open", onOpen);
    return () => window.removeEventListener("palette:open", onOpen);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setRecentIds(readRecent());
      setObjects([]);
    }
  }, [open]);

  // Debounced object search — hit /api/palette/search when the query is
  // at least 2 chars. AbortController cancels in-flight requests on new
  // keystrokes so the newest query always wins.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setObjects([]);
      setObjectsLoading(false);
      return;
    }
    setObjectsLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/palette/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: ObjectResult[] };
        setObjects(data.results ?? []);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") setObjects([]);
      } finally {
        setObjectsLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, query]);

  const filtered = useMemo(
    () => filterCommands(query, { hasBrand, lockedFeatures: lockedSet }),
    [query, hasBrand, lockedSet],
  );

  // Recent = filtered command list narrowed to remembered IDs, in remembered order.
  const recent = useMemo(() => {
    if (query.trim()) return [] as Command[];
    const byId = new Map(filtered.map((c) => [c.id, c]));
    return recentIds.map((id) => byId.get(id)).filter((c): c is Command => !!c);
  }, [filtered, recentIds, query]);

  // Non-recent commands, grouped by their group. When query is empty, drop
  // duplicates already surfaced in Recent to keep the list tidy.
  const grouped = useMemo(() => {
    const recentSet = new Set(recent.map((c) => c.id));
    const g: Record<CommandGroup, Command[]> = { do: [], go: [], jump: [], help: [] };
    for (const c of filtered) {
      if (recentSet.has(c.id)) continue;
      g[c.group].push(c);
    }
    return g;
  }, [filtered, recent]);

  // Should we offer an "Ask Copilot" row? Only when the query looks like a
  // question — >4 words, no exact command hit, and we have a brand.
  const askRow = useMemo<Command | null>(() => {
    const q = query.trim();
    if (!q || !hasBrand) return null;
    if (q.split(/\s+/).length < 4) return null;
    if (filtered.length > 0 && filtered[0].label.toLowerCase() === q.toLowerCase()) return null;
    return {
      id: "ask.custom",
      group: "do",
      label: `Ask Copilot: "${q.length > 60 ? q.slice(0, 60) + "…" : q}"`,
      icon: filtered[0]?.icon ?? Search,
      action: "copilot:open",
      actionPayload: { seed: q },
    };
  }, [query, filtered, hasBrand]);

  // Convert an ObjectResult to a Command-shaped row so we can reuse the
  // existing renderer + arrow-key + run() path. `href` routes into the
  // workspace's overview tab; the icon matches the object kind.
  const objectRows = useMemo<Command[]>(() => {
    return objects.map((o) => ({
      id: `obj.${o.kind}.${o.id}`,
      group: "go",
      label: o.label,
      hint: `${o.kind}${o.sublabel ? ` · ${o.sublabel}` : ""}`,
      icon: OBJECT_ICONS[o.kind],
      href: objectHref(o.kind, o.id),
    }));
  }, [objects]);

  // Flat list matches visual order — needed for arrow-key navigation.
  const flat = useMemo(() => {
    const out: { cmd: Command; groupKey: keyof typeof GROUP_LABEL }[] = [];
    if (askRow) out.push({ cmd: askRow, groupKey: "ask" });
    if (recent.length) recent.forEach((c) => out.push({ cmd: c, groupKey: "recent" }));
    // Objects come after Recent so name matches (e.g. "acme") sit above the
    // static "Open Brand workspace" verb.
    for (const c of objectRows) out.push({ cmd: c, groupKey: "objects" });
    for (const g of ["do", "go", "jump", "help"] as CommandGroup[]) {
      for (const c of grouped[g]) out.push({ cmd: c, groupKey: g });
    }
    return out;
  }, [askRow, recent, grouped, objectRows]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    // Keep the active row scrolled into view.
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Fire-and-forget palette telemetry — feeds command_events for the
  // "commands most-used" ranking that replaces our hand-tuned popularity.
  const logCommand = useCallback(
    (cmd: Command, method: "palette" | "keyboard") => {
      // Skip help/copilot events — they aren't real "commands run" for
      // the ranking. We still log DO/GO/JUMP so palette + rail get a
      // shared frequency signal later.
      if (cmd.action === "shortcuts:open") return;
      fetch("/api/telemetry/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandId: cmd.id,
          brandId: null,
          method,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [],
  );

  const run = useCallback(
    async (cmd: Command, method: "palette" | "keyboard" = "palette") => {
      writeRecent(cmd.id);
      logCommand(cmd, method);

      // Help commands are fully local — resolve, then close.
      if (cmd.action === "shortcuts:open") {
        setOpen(false);
        window.dispatchEvent(new CustomEvent("shortcuts:open"));
        return;
      }

      // Copilot-open, with an optional seed prompt.
      if (cmd.action === "copilot:open") {
        setOpen(false);
        window.dispatchEvent(
          new CustomEvent("copilot:open", { detail: cmd.actionPayload ?? {} }),
        );
        return;
      }

      // Workspace-level events (copy handle, etc.) — dispatch as a
      // CustomEvent instead of POSTing. The workspace shell listens.
      if (cmd.action && cmd.action.startsWith("workspace:")) {
        setOpen(false);
        window.dispatchEvent(
          new CustomEvent(cmd.action, { detail: cmd.actionPayload ?? {} }),
        );
        return;
      }

      // Object-scoped events (competitor:*, prompt:*, etc.) — the
      // active workspace listener claims them. Only fires when the
      // user is inside that workspace kind; safe otherwise (nobody
      // listening = no-op).
      if (cmd.action && /^[a-z]+:[a-z-]+$/.test(cmd.action) && !cmd.action.startsWith("copilot:")) {
        setOpen(false);
        window.dispatchEvent(
          new CustomEvent(cmd.action, { detail: cmd.actionPayload ?? {} }),
        );
        return;
      }

      // Direct route.
      const resolved = resolveHref(cmd, brandSlug);
      if (resolved) {
        setOpen(false);
        router.push(resolved);
        return;
      }

      // POST action (e.g. run scan).
      if (cmd.action) {
        setRunning(true);
        try {
          const res = await fetch(cmd.action, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cmd.actionPayload ?? {}),
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            toast.error(`${cmd.label} failed: ${res.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
          } else {
            toast.success(`${cmd.label} started`);
            router.refresh();
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `${cmd.label} failed`);
        } finally {
          setRunning(false);
          setOpen(false);
        }
        return;
      }

      setOpen(false);
    },
    [router, brandSlug, logCommand],
  );

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      void run(flat[active].cmd, "keyboard");
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Render row helper — flat[] is already in visual order, so we walk it
  // linearly and emit a group header whenever the group changes.
  let lastGroup: string | null = null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[12%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={flat[active] ? `palette-opt-${active}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a command, page, or question…"
            className="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
          {running && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />}
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            ESC
          </kbd>
        </div>
        <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[420px] overflow-y-auto p-2">
          {flat.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted">
              No commands match &quot;{query}&quot;. Try a different word, or press{" "}
              <kbd className="rounded border border-line bg-surface px-1 text-[10px]">Esc</kbd> to close.
            </li>
          )}
          {flat.map((row, i) => {
            const showHeader = row.groupKey !== lastGroup;
            lastGroup = row.groupKey;
            const Icon = row.cmd.icon;
            const activeRow = i === active;
            return (
              <li key={`${row.cmd.id}-${i}`}>
                {showHeader && (
                  <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted/80">
                    {GROUP_LABEL[row.groupKey]}
                  </div>
                )}
                <button
                  id={`palette-opt-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={activeRow}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => void run(row.cmd)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeRow ? "bg-accent/10 text-accent" : "text-ink hover:bg-surface"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{row.cmd.label}</span>
                    {row.cmd.hint && (
                      <span className="truncate text-[11px] text-muted">{row.cmd.hint}</span>
                    )}
                  </span>
                  {activeRow && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 py-0.5">↑</kbd>
              <kbd className="rounded border border-line bg-surface px-1 py-0.5">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface px-1 py-0.5">↵</kbd> run
            </span>
          </span>
          <span>{flat.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Small trigger chip for the topbar. Non-visual dependency: relies on the
// palette component being mounted somewhere globally.
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("palette:open"))}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-muted transition hover:border-ink/20 hover:text-ink"
      aria-label="Open command palette"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search or run…</span>
      <kbd className="hidden rounded border border-line bg-white px-1.5 text-[10px] font-semibold text-muted sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
