"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";

type Message = { role: "user" | "assistant"; content: string };

const STARTER_QUESTIONS = [
  "Why is our visibility low right now?",
  "Which prompts are we not being mentioned in?",
  "How are we doing on Perplexity vs ChatGPT?",
  "What should I fix first?",
];

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, conversationId }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, something went wrong: ${data.error}` }]);
      return;
    }

    setConversationId(data.conversationId);
    setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <PageHeader
        title="Agent"
        subtitle="Ask anything about your visibility data — answers are grounded in your real numbers."
      />

      <div className="mt-6 flex-1 overflow-y-auto rounded-2xl border border-line bg-white p-6">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-muted">Try asking:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-line px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink"
                >
                  <Sparkles className="mr-1.5 inline h-3 w-3 text-accent" aria-hidden />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  m.role === "user" ? "bg-ink text-white" : "bg-accent text-white"
                }`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-ink text-white" : "bg-surface text-ink"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="rounded-2xl bg-surface px-4 py-2.5 text-sm text-muted">Thinking…</div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="mt-4 flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 shadow-sm"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your visibility…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
