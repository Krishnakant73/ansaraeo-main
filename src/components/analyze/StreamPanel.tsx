"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MinusCircle, Radar } from "lucide-react";

// ============================================================
// StreamPanel — the visible loading experience.
//
// Opens an EventSource to /api/analyze/[scanId]/stream and renders the
// autofill card, prompts, and per-engine cards as events arrive. Each
// engine card holds a compact answer snippet with a mention flash when
// the brand is detected.
//
// Design principle: never spin without narration. Every second of
// latency has a labelled sub-step next to it. When engines fail we say
// so honestly ("Gemini paused — retrying in the background") and keep
// moving; a stuck engine never blocks the report.
// ============================================================

type Autofill = {
  companyName?: string;
  shortDescription?: string;
  suggestedCategory?: string;
  suggestedCompetitors?: string[];
  confidence?: "high" | "low";
};

type Prompt = { text: string; language: string; intent: string };

type CellState = {
  status: "pending" | "running" | "done" | "skipped";
  mentioned?: boolean;
  competitors?: string[];
  sentiment?: string;
  snippet?: string;
  reason?: string;
};

const ENGINE_ORDER = ["chatgpt", "perplexity", "gemini"] as const;
const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
};

function makeKey(engine: string, prompt: string) {
  return `${engine}::${prompt}`;
}

export function StreamPanel({ scanId, domain }: { scanId: string; domain: string }) {
  const router = useRouter();
  const [autofill, setAutofill] = useState<Autofill | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/analyze/${scanId}/stream`);
    esRef.current = es;

    es.addEventListener("autofill", (ev) => {
      try {
        setAutofill(JSON.parse((ev as MessageEvent<string>).data));
      } catch {}
    });
    es.addEventListener("prompts", (ev) => {
      try {
        const { prompts } = JSON.parse((ev as MessageEvent<string>).data) as { prompts: Prompt[] };
        setPrompts(prompts);
        // Prime cell state for each (engine × prompt).
        setCells((prev) => {
          const next = { ...prev };
          for (const p of prompts) {
            for (const e of ENGINE_ORDER) {
              const key = makeKey(e, p.text);
              if (!next[key]) next[key] = { status: "pending" };
            }
          }
          return next;
        });
      } catch {}
    });
    es.addEventListener("engine_start", (ev) => {
      try {
        const { engine, prompt } = JSON.parse((ev as MessageEvent<string>).data);
        setCells((prev) => ({ ...prev, [makeKey(engine, prompt)]: { status: "running" } }));
      } catch {}
    });
    es.addEventListener("engine_done", (ev) => {
      try {
        const { engine, prompt, mentioned, competitors, sentiment, snippet } = JSON.parse(
          (ev as MessageEvent<string>).data,
        );
        setCells((prev) => ({
          ...prev,
          [makeKey(engine, prompt)]: {
            status: "done",
            mentioned,
            competitors,
            sentiment,
            snippet,
          },
        }));
      } catch {}
    });
    es.addEventListener("engine_skip", (ev) => {
      try {
        const { engine, prompt, reason } = JSON.parse((ev as MessageEvent<string>).data);
        setCells((prev) => ({
          ...prev,
          [makeKey(engine, prompt)]: { status: "skipped", reason },
        }));
      } catch {}
    });
    es.addEventListener("elapsed", (ev) => {
      try {
        const { ms } = JSON.parse((ev as MessageEvent<string>).data);
        setElapsedMs(ms);
      } catch {}
    });
    es.addEventListener("done", () => {
      setDone(true);
      es.close();
      esRef.current = null;
      // Give the "Report ready" moment ~800ms to breathe, then route.
      setTimeout(() => router.push(`/analyze/${scanId}/report`), 800);
    });
    es.addEventListener("error", (ev) => {
      // EventSource surfaces both real errors and its own reconnect
      // attempts through the same event. Only treat a payload-carrying
      // error as user-visible; ignore transient reconnects.
      const anyEv = ev as MessageEvent<string>;
      if (anyEv.data) {
        try {
          const { message } = JSON.parse(anyEv.data);
          setError(message ?? "Scan failed. Please try again.");
        } catch {
          setError("Scan failed. Please try again.");
        }
      }
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [scanId, router]);

  const readyCount = useMemo(
    () => Object.values(cells).filter((c) => c.status === "done" || c.status === "skipped").length,
    [cells],
  );
  const totalCells = Object.keys(cells).length;
  const progress = totalCells ? Math.round((readyCount / totalCells) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Analyzing</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{domain}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Radar className={done ? "h-4 w-4 text-emerald-500" : "h-4 w-4 animate-pulse text-accent"} />
          <span>
            {done ? "Report ready" : `${readyCount}/${totalCells || "…"} · ${Math.round(elapsedMs / 1000)}s`}
          </span>
        </div>
      </header>

      <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${done ? 100 : Math.max(6, progress)}%` }}
        />
      </div>

      {/* Detected brand card */}
      <div className="card p-5">
        {autofill ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Detected</p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {autofill.companyName || domain}
            </p>
            {autofill.suggestedCategory && (
              <p className="text-sm text-muted">Category: {autofill.suggestedCategory}</p>
            )}
            {(autofill.suggestedCompetitors?.length ?? 0) > 0 && (
              <p className="mt-1 text-sm text-muted">
                Likely competitors: {autofill.suggestedCompetitors!.slice(0, 6).join(", ")}
              </p>
            )}
            {autofill.confidence === "low" && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                We couldn&apos;t confidently identify this brand from the domain alone — you&apos;ll be able to correct
                these details after signup.
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Detecting the brand and category…
          </div>
        )}
      </div>

      {/* Prompt rows */}
      <div className="mt-6 space-y-4">
        {prompts.length === 0 && (
          <div className="card flex items-center gap-2 p-5 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Picking three questions your customers ask AI…
          </div>
        )}
        {prompts.map((p) => (
          <div key={p.text} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Asking</p>
            <p className="mt-1 text-base font-semibold text-ink">&ldquo;{p.text}&rdquo;</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {ENGINE_ORDER.map((engine) => {
                const cell = cells[makeKey(engine, p.text)] ?? { status: "pending" };
                return (
                  <div
                    key={engine}
                    className={`rounded-lg border p-3 text-sm transition-colors ${
                      cell.status === "done" && cell.mentioned
                        ? "border-emerald-400 bg-emerald-50/50"
                        : cell.status === "done"
                          ? "border-line bg-white"
                          : cell.status === "skipped"
                            ? "border-line bg-surface/50"
                            : "border-line bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        {ENGINE_LABEL[engine]}
                      </span>
                      {cell.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
                      {cell.status === "done" && cell.mentioned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          <Check className="h-3 w-3" /> mentioned
                        </span>
                      )}
                      {cell.status === "done" && !cell.mentioned && (
                        <span className="text-[10px] font-semibold text-muted">not mentioned</span>
                      )}
                      {cell.status === "skipped" && <MinusCircle className="h-3.5 w-3.5 text-muted" />}
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                      {cell.status === "pending"
                        ? "Waiting for engine…"
                        : cell.status === "running"
                          ? "Streaming answer…"
                          : cell.status === "skipped"
                            ? cell.reason ?? "Skipped."
                            : cell.snippet ?? ""}
                    </p>
                    {cell.status === "done" && (cell.competitors?.length ?? 0) > 0 && (
                      <p className="mt-2 text-[11px] text-muted">
                        Recommended instead: {cell.competitors!.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {done && (
        <p className="mt-8 text-center text-sm text-muted">Loading your report…</p>
      )}

      {error && (
        <div className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <strong>Scan failed:</strong> {error}
        </div>
      )}
    </div>
  );
}
