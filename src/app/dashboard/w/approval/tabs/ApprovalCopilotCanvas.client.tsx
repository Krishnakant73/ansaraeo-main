"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, User } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "What am I actually approving?",
  "Are there risks I should check before signing off?",
  "Why was this rejected?",
  "How long has this been pending?",
];

export default function ApprovalCopilotCanvas({
  approvalId,
  targetLabel,
  approverRole,
  status,
  brandName,
}: {
  approvalId: string;
  targetLabel: string;
  approverRole: string;
  status: string;
  brandName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/agent/chat?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          message: text,
          context: {
            workspace: {
              kind: "approval",
              id: approvalId,
              label: targetLabel,
              summary: `Approval for ${targetLabel} on brand ${brandName}. Requires ${approverRole}. Status: ${status}.`,
              hints: [
                "Answer from the approval row + target row only.",
                "Never invent a rejection reason not present in the note field.",
                "Suggest what to inspect before approving; never approve on the user's behalf.",
              ],
            },
          },
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Copilot request failed: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\n\n/);
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as { type: string; delta?: string; error?: string };
            if (parsed.type === "token" && parsed.delta) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + parsed.delta };
                }
                return copy;
              });
            } else if (parsed.type === "error") {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: `Error: ${parsed.error}` };
                return copy;
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `Error: ${String(e)}` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex min-h-[520px] flex-col rounded-2xl border border-line bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Ask anything about this approval:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-2xl border border-line bg-white p-3 text-left text-sm text-ink transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex items-start gap-2">
            <div
              className={
                m.role === "user"
                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
                  : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-muted"
              }
            >
              {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-ink">
              {m.content ||
                (streaming && i === messages.length - 1 ? <span className="text-muted">…</span> : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          placeholder="Ask about this approval…"
          className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="btn-sm inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" /> Send
        </button>
      </form>
    </div>
  );
}
