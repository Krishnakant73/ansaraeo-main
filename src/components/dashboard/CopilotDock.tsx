"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, ChevronRight, CornerDownLeft, Loader2, Send, Sparkles, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// UWE context contract — when a Universal Workspace Engine shell
// is mounted, its root emits `data-copilot-context="<json>"` with
// { kind, id, label, summary?, hints? }. We prefer this over path
// derivation because the workspace knows its object semantically
// (Brand id, not just slug), and its own hints tell Copilot how to
// stay honest ("Never invent citations"). Zero import from UWE.
// ============================================================
type DomCopilotContext = {
  kind: string;
  id: string;
  label: string;
  summary?: string;
  hints?: string[];
};

function readDomCopilotContext(): DomCopilotContext | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>("[data-copilot-context]");
  if (!el) return null;
  const raw = el.getAttribute("data-copilot-context");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.kind && parsed.id) {
      return parsed as DomCopilotContext;
    }
  } catch {
    // fall through
  }
  return null;
}

// ============================================================
// CopilotDock — always-visible, context-bound right dock.
//
// Ownership boundaries:
//   • This component owns the dock lifecycle (open/closed, thread state).
//   • It reads current-object context from the URL — the Object model
//     lives in the URL, so we don't need a shared React context yet.
//   • It POSTs to /api/agent/chat and streams the reply back.
//     (The current API returns non-streaming JSON — see route.ts. When
//     that switches to SSE, only the fetch() call below needs to change.)
//
// Threads are keyed by (currentObjectKind, currentObjectId). Switching to
// a new object opens a fresh thread; returning restores the prior one.
// State is per-session (memory only) — no backend churn for Phase 1.
// ============================================================

type Msg = { role: "user" | "assistant"; content: string; ts: number };
type Thread = { messages: Msg[]; conversationId?: string };

const SEED_PROMPTS = [
  "What should I do today?",
  "Why did visibility drop this week?",
  "Which competitor is winning where?",
  "Summarize the last scan",
];

// Derive a short "object context" from the current URL — used to key threads
// and to render the dock header (so the user always sees what Copilot is
// looking at). Handles both legacy `/dashboard/<module>` and Phase-2
// `/dashboard/b/<slug>/<module>` grammars.
function objectFromPath(pathname: string): { kind: string; label: string; key: string } {
  const seg = pathname.split("/").filter(Boolean);
  // seg[0] is always "dashboard" for anything we care about.

  // Phase 3: /dashboard/w/<kind>/<slug>[/<tab>] — UWE also emits
  // data-copilot-context on the shell root; this path derivation is only
  // the fallback until that DOM read lands.
  if (seg[1] === "w" && seg[2] && seg[3]) {
    const kind = seg[2];
    const slug = seg[3];
    const tab = seg[4];
    const label = tab ? `${slug.slice(0, 12)} · ${tab}` : slug.slice(0, 24);
    return {
      kind: kind.charAt(0).toUpperCase() + kind.slice(1),
      label,
      key: `w:${kind}:${slug}${tab ? `:${tab}` : ""}`,
    };
  }

  // Phase 2: /dashboard/b/<slug>[/<module>...]
  if (seg[1] === "b" && seg[2]) {
    const slug = seg[2];
    const module = seg[3];
    if (!module) return { kind: "Mission Control", label: slug, key: `mc:${slug}` };
    const label = module.replace(/-/g, " ");
    return {
      kind: label.charAt(0).toUpperCase() + label.slice(1),
      label: `${slug} · ${label}`,
      key: `${slug}:${module}`,
    };
  }

  if (pathname === "/dashboard") return { kind: "Mission Control", label: "everything", key: "mc" };

  // Legacy /dashboard/<module>[/<id>] — kept working for the 33 pages not
  // yet migrated under /b/[slug].
  const module = seg[1] ?? "brand";
  const id = seg[2] ?? "";
  const label = module.replace(/-/g, " ");
  return {
    kind: label.charAt(0).toUpperCase() + label.slice(1),
    label: id ? `${label} · ${id.slice(0, 8)}` : label,
    key: `${module}:${id || "root"}`,
  };
}

export default function CopilotDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // DOM context is the source of truth when UWE has mounted a shell;
  // path derivation is a fallback for the 33 legacy pages that haven't
  // moved into a workspace yet. We recompute on route change and on the
  // workspace:tab-switched event fired by TabNavigation.
  const [domCtx, setDomCtx] = useState<DomCopilotContext | null>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDomCtx(readDomCopilotContext()));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
  useEffect(() => {
    function onSwitch() {
      setDomCtx(readDomCopilotContext());
    }
    window.addEventListener("workspace:tab-switched", onSwitch as EventListener);
    return () => window.removeEventListener("workspace:tab-switched", onSwitch as EventListener);
  }, []);

  const objectCtx = useMemo(() => {
    if (domCtx) {
      const kindLabel = domCtx.kind.charAt(0).toUpperCase() + domCtx.kind.slice(1);
      return {
        kind: kindLabel,
        label: domCtx.label,
        key: `${domCtx.kind}:${domCtx.id}`,
        // Optional grounding forwarded to the server so the LLM has
        // a one-line description of what the user is looking at.
        summary: domCtx.summary,
        hints: domCtx.hints,
      };
    }
    return objectFromPath(pathname);
  }, [domCtx, pathname]);
  const thread = threads[objectCtx.key] ?? { messages: [] };

  // Toggle via keyboard `t` (unless typing) and via palette event.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
      }
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onOpen(evt: Event) {
      setOpen(true);
      setCollapsed(false);
      const seed = (evt as CustomEvent).detail?.seed;
      if (typeof seed === "string" && seed.trim()) {
        setInput(seed);
        // Auto-focus the input; user hits Enter to send.
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    }
    window.addEventListener("copilot:open", onOpen as EventListener);
    return () => window.removeEventListener("copilot:open", onOpen as EventListener);
  }, []);

  // Keep list scrolled to bottom as messages arrive.
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread.messages.length, busy]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setBusy(true);
      const now = Date.now();
      // Optimistic append user turn.
      setThreads((prev) => {
        const t = prev[objectCtx.key] ?? { messages: [] };
        return { ...prev, [objectCtx.key]: { ...t, messages: [...t.messages, { role: "user", content: text, ts: now }] } };
      });
      setInput("");
      // Append an empty assistant placeholder — tokens stream into it.
      const assistantTs = Date.now() + 1;
      setThreads((prev) => {
        const t = prev[objectCtx.key] ?? { messages: [] };
        return {
          ...prev,
          [objectCtx.key]: {
            ...t,
            messages: [...t.messages, { role: "assistant", content: "", ts: assistantTs }],
          },
        };
      });
      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            message: text,
            conversationId: thread.conversationId,
            // Object context is served as a message prefix; the server route
            // rebuilds full grounding from Supabase, but this hint tells it
            // which object the user is looking at right now.
            context: {
              path: pathname,
              object: objectCtx.kind,
              // UWE contract: pass the descriptor's semantic id, label, and
              // any hints straight through so the server can ground on the
              // exact object without re-parsing the URL.
              ...(domCtx
                ? {
                    workspace: {
                      kind: domCtx.kind,
                      id: domCtx.id,
                      label: domCtx.label,
                      summary: domCtx.summary,
                      hints: domCtx.hints,
                    },
                  }
                : {}),
            },
          }),
        });
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          throw new Error(`Copilot error (${res.status}): ${detail.slice(0, 200)}`);
        }

        // Consume SSE — server emits `meta`, `token`, `done`, `error`.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let convFromServer: string | undefined;
        outer: while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const lines = frame.split("\n");
            let event = "message";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) event = line.slice(7).trim();
              else if (line.startsWith("data: ")) data += line.slice(6);
            }
            if (!data) continue;
            try {
              const obj = JSON.parse(data);
              if (event === "meta" && obj?.conversationId) {
                convFromServer = obj.conversationId;
              } else if (event === "token" && typeof obj?.delta === "string") {
                const delta = obj.delta;
                setThreads((prev) => {
                  const t = prev[objectCtx.key] ?? { messages: [] };
                  const msgs = [...t.messages];
                  const last = msgs[msgs.length - 1];
                  if (last && last.role === "assistant" && last.ts === assistantTs) {
                    msgs[msgs.length - 1] = { ...last, content: last.content + delta };
                  }
                  return { ...prev, [objectCtx.key]: { ...t, messages: msgs } };
                });
              } else if (event === "done") {
                break outer;
              } else if (event === "error") {
                throw new Error(String(obj?.error ?? "stream_error"));
              }
            } catch (parseErr) {
              // Bad frame — surface to catch block if it's an error event.
              if (event === "error") throw parseErr;
            }
          }
        }
        if (convFromServer) {
          setThreads((prev) => {
            const t = prev[objectCtx.key] ?? { messages: [] };
            return { ...prev, [objectCtx.key]: { ...t, conversationId: convFromServer } };
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Copilot error";
        // Replace the empty streaming placeholder with the error (rather
        // than appending — otherwise we leak a blank bubble on failure).
        setThreads((prev) => {
          const t = prev[objectCtx.key] ?? { messages: [] };
          const msgs = [...t.messages];
          const last = msgs[msgs.length - 1];
          const errMsg = { role: "assistant" as const, content: `⚠ ${msg}`, ts: Date.now() };
          if (last && last.role === "assistant" && last.ts === assistantTs) {
            msgs[msgs.length - 1] = errMsg;
          } else {
            msgs.push(errMsg);
          }
          return { ...prev, [objectCtx.key]: { ...t, messages: msgs } };
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, thread.conversationId, objectCtx.key, objectCtx.kind, pathname],
  );

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  // ── Closed state — a slim edge tab (desktop) / floating pill (mobile).
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-float transition hover:bg-accent-hover xl:bottom-6 xl:right-6"
        aria-label="Open Copilot (t)"
      >
        <Bot className="h-4 w-4" />
        <span className="hidden sm:inline">Copilot</span>
        <kbd className="hidden rounded border border-white/30 bg-white/10 px-1 text-[10px] font-semibold sm:inline">t</kbd>
      </button>
    );
  }

  // ── Open state.
  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm xl:hidden"
      />

      <aside
        role="complementary"
        aria-label="AI Copilot"
        className={cn(
          "fixed z-50 flex flex-col border-line bg-white shadow-float transition-all",
          // Mobile: bottom sheet.
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t",
          // Tablet / desktop: right column, full height.
          "xl:inset-y-0 xl:right-0 xl:max-h-none xl:rounded-none xl:border-l xl:border-t-0",
          collapsed ? "xl:w-[52px]" : "xl:w-[380px]",
        )}
      >
        {/* Header */}
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">Copilot</p>
              <p className="truncate text-[11px] text-muted">
                In context: <span className="text-ink">{objectCtx.kind}</span>
              </p>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="hidden h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink xl:grid"
              aria-label={collapsed ? "Expand Copilot" : "Collapse Copilot"}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
              aria-label="Close Copilot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {!collapsed && (
          <>
            {/* Message list */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {thread.messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Ask about this {objectCtx.kind.toLowerCase()}. Copilot answers with real data from your brand — never invents citations.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SEED_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => void send(p)}
                        className="rounded-xl border border-line bg-white px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-accent/40 hover:bg-accent/5"
                      >
                        <CornerDownLeft className="mr-1.5 inline h-3 w-3 opacity-60" />
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {thread.messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-auto bg-accent/10 text-ink"
                      : "mr-auto border border-line bg-white text-ink",
                  )}
                >
                  {m.content.split("\n").map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-1.5" : undefined}>
                      {line || " "}
                    </p>
                  ))}
                </div>
              ))}

              {busy && (
                <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-line px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  rows={1}
                  placeholder={`Ask about ${objectCtx.kind}…`}
                  className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => void send(input)}
                  disabled={busy || !input.trim()}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted">
                Answers grounded in your brand's real data. Copilot never invents citations.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
