"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, Copy, RefreshCw, PenSquare } from "lucide-react";

// ============================================================
// RunReplayDrawer — right-side drawer that shows a specific visibility
// run when ?run=<id> is in the URL. Fetches the run + citations from
// /api/prompt-workspace/run/[id] (no new endpoint — see route file).
// ============================================================

type Verification = {
  brand?: { agreed?: boolean; llmSaid?: boolean; textMatchSaid?: boolean };
  competitors?: { name: string; agreed: boolean }[];
  recommendation_alignment?: string;
};

type CompetitorMention = { name: string; mentioned: boolean; position: number | null };

type RunPayload = {
  id: string;
  engine_name: string;
  run_at: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment: string | null;
  recommendation_alignment: string | null;
  raw_response: string | null;
  competitor_mentions: CompetitorMention[] | null;
  mention_verification: Verification | null;
  citations: {
    cited_domain: string | null;
    cited_url: string | null;
    is_own_domain: boolean | null;
    is_competitor_domain: boolean | null;
  }[];
};

export default function RunReplayDrawer({
  brandName,
  promptId,
}: {
  brandName: string;
  promptId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");
  const [payload, setPayload] = useState<RunPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reRunning, setReRunning] = useState(false);

  useEffect(() => {
    if (!runId) {
      setPayload(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/prompt-workspace/run/${runId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed to load run");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setPayload(json as RunPayload);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  // Close on Esc.
  useEffect(() => {
    if (!runId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("run");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }

  async function copyAnswer() {
    if (!payload?.raw_response) return;
    await navigator.clipboard.writeText(payload.raw_response);
  }

  async function rerun() {
    if (!payload) return;
    setReRunning(true);
    try {
      await fetch("/api/visibility-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      });
      router.refresh();
    } finally {
      setReRunning(false);
    }
  }

  if (!runId) return null;

  const mentioned = payload?.brand_mentioned === true;
  const skipped = payload?.brand_mentioned === null;
  const alignment = payload?.recommendation_alignment;
  const highlighted = highlightBrand(payload?.raw_response ?? "", brandName);

  return (
    <>
      <div
        onClick={close}
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
        aria-hidden="true"
        data-modal-open
      />
      <aside
        role="dialog"
        aria-label="Run replay"
        data-modal-open
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-2xl flex-col border-l border-line bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <p className="section-label">Run replay</p>
            <h3 className="mt-1 text-lg font-bold text-ink">
              {payload ? formatEngine(payload.engine_name) : loading ? "Loading…" : "Run"}
            </h3>
            {payload && (
              <p className="mt-1 text-xs text-muted">
                {new Date(payload.run_at).toLocaleString()}
              </p>
            )}
            {payload && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={
                    skipped
                      ? "chip"
                      : mentioned
                        ? "chip chip-accent"
                        : "chip border-rose-200 bg-rose-50 text-rose-600"
                  }
                >
                  {skipped ? "skipped" : mentioned ? "mentioned ✓" : "not mentioned"}
                </span>
                {payload.brand_position != null && (
                  <span className="chip">#{payload.brand_position}</span>
                )}
                {payload.sentiment && <span className="chip">{payload.sentiment}</span>}
                {alignment && alignment !== "neutral" && (
                  <span
                    className={
                      alignment === "aligned"
                        ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "chip border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {alignment}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={close}
            aria-label="Close replay"
            className="rounded-full border border-line p-1.5 hover:border-accent hover:text-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {loading && <p className="text-sm text-muted">Loading run…</p>}

          {payload && (
            <>
              <section>
                <p className="section-label">Raw answer</p>
                <div className="mt-2 max-h-[40vh] overflow-y-auto rounded-xl border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink">
                  {highlighted.length === 0 ? (
                    <span className="text-muted">(empty response)</span>
                  ) : (
                    highlighted.map((chunk, i) =>
                      chunk.hit ? (
                        <mark
                          key={i}
                          className="rounded-sm bg-accent/20 px-0.5 font-semibold text-ink"
                        >
                          {chunk.text}
                        </mark>
                      ) : (
                        <span key={i}>{chunk.text}</span>
                      ),
                    )
                  )}
                </div>
              </section>

              {payload.mention_verification && (
                <section>
                  <p className="section-label">Verification trail</p>
                  <VerificationSummary
                    verification={payload.mention_verification}
                    finalMentioned={payload.brand_mentioned}
                    brandName={brandName}
                  />
                </section>
              )}

              {payload.citations.length > 0 && (
                <section>
                  <p className="section-label">Citations ({payload.citations.length})</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {payload.citations.slice(0, 30).map((c, i) => (
                      <a
                        key={i}
                        href={c.cited_url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={c.cited_url ?? undefined}
                        className={
                          c.is_own_domain
                            ? "chip chip-accent"
                            : c.is_competitor_domain
                              ? "chip border-rose-200 bg-rose-50 text-rose-600"
                              : "chip"
                        }
                      >
                        {c.cited_domain ?? c.cited_url}
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {payload.competitor_mentions && payload.competitor_mentions.length > 0 && (
                <section>
                  <p className="section-label">Competitors detected</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {payload.competitor_mentions
                      .filter((c) => c.mentioned)
                      .map((c) => (
                        <span key={c.name} className="chip">
                          {c.name}
                          {c.position != null && (
                            <span className="ml-1 text-muted">#{c.position}</span>
                          )}
                        </span>
                      ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line p-4">
          <button
            onClick={copyAnswer}
            disabled={!payload?.raw_response}
            className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" /> Copy answer
          </button>
          <div className="flex items-center gap-2">
            <button className="btn-ghost inline-flex items-center gap-1.5" title="Draft an answer block for this run">
              <PenSquare className="h-3.5 w-3.5" /> Draft rebuttal
            </button>
            <button
              onClick={rerun}
              disabled={reRunning}
              className="btn-sm inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reRunning ? "animate-spin" : ""}`} />
              {reRunning ? "Re-running…" : "Re-run"}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

function formatEngine(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Break the text into chunks around case-insensitive brand-name hits so the
// UI can highlight them. Purely visual — the deterministic matcher is what
// actually drives brand_mentioned.
function highlightBrand(text: string, brand: string): { text: string; hit: boolean }[] {
  if (!brand || !text) return text ? [{ text, hit: false }] : [];
  const re = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const chunks: { text: string; hit: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    if (m.index > last) chunks.push({ text: text.slice(last, m.index), hit: false });
    chunks.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) chunks.push({ text: text.slice(last), hit: false });
  return chunks;
}

function VerificationSummary({
  verification,
  finalMentioned,
  brandName,
}: {
  verification: Verification;
  finalMentioned: boolean | null;
  brandName: string;
}) {
  const b = verification.brand;
  if (!b) return <p className="mt-2 text-sm text-muted">No verification recorded.</p>;
  const agreed = b.agreed !== false;
  const llm = b.llmSaid ? "yes" : "no";
  const det = b.textMatchSaid ? "yes" : "no";
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface p-3 text-xs text-ink">
      <p>
        LLM said <span className="font-semibold">{llm}</span>, deterministic text match said{" "}
        <span className="font-semibold">{det}</span>.{" "}
        {agreed ? (
          <>Both agreed → the run's brand_mentioned is <span className="font-semibold">{String(finalMentioned)}</span>.</>
        ) : (
          <>
            They disagreed for <span className="font-semibold">{brandName}</span>. Deterministic wins
            for literal name presence → brand_mentioned is{" "}
            <span className="font-semibold">{String(finalMentioned)}</span>.
          </>
        )}
      </p>
    </div>
  );
}
