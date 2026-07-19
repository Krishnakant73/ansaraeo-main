import { createClient } from "@/lib/supabase/server";
import type { Prompt } from "@/lib/prompt-workspace";

// ============================================================
// Prompt › Sources — the authority explorer. Which domains do AI
// engines cite when answering THIS prompt? Aggregated across every
// citation attached to every run of the prompt. Sorted by frequency
// with authority + trust indicators from citation-quality.
// ============================================================

type CitationRow = {
  cited_domain: string | null;
  cited_url: string | null;
  is_own_domain: boolean | null;
  is_competitor_domain: boolean | null;
  is_trusted_source: boolean | null;
  authority_score: number | null;
  authority_source: string | null;
  source_quality: number | null;
  run_id: string;
};

type DomainAgg = {
  domain: string;
  count: number;
  isOwn: boolean;
  isCompetitor: boolean;
  isTrusted: boolean;
  authority: number | null;
  authoritySource: string | null;
  urls: Set<string>;
};

export default async function SourcesBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();

  // Two-step: get run ids for the prompt, then citations for those runs.
  // Kept as-two-queries because the citations table has no direct prompt_id.
  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id")
    .eq("prompt_id", prompt.id)
    .limit(1000);
  const runIds = ((runs as { id: string }[] | null) ?? []).map((r) => r.id);

  let citations: CitationRow[] = [];
  if (runIds.length > 0) {
    const { data } = await supabase
      .from("citations")
      .select(
        "cited_domain, cited_url, is_own_domain, is_competitor_domain, is_trusted_source, authority_score, authority_source, source_quality, run_id",
      )
      .in("run_id", runIds);
    citations = (data as CitationRow[] | null) ?? [];
  }

  const agg = new Map<string, DomainAgg>();
  for (const c of citations) {
    const key = c.cited_domain ?? c.cited_url;
    if (!key) continue;
    const cur =
      agg.get(key) ??
      ({
        domain: key,
        count: 0,
        isOwn: false,
        isCompetitor: false,
        isTrusted: false,
        authority: null as number | null,
        authoritySource: null as string | null,
        urls: new Set<string>(),
      } as DomainAgg);
    cur.count += 1;
    if (c.is_own_domain) cur.isOwn = true;
    if (c.is_competitor_domain) cur.isCompetitor = true;
    if (c.is_trusted_source) cur.isTrusted = true;
    if (c.authority_score != null && (cur.authority == null || c.authority_score > cur.authority)) {
      cur.authority = c.authority_score;
      cur.authoritySource = c.authority_source ?? null;
    }
    if (c.cited_url) cur.urls.add(c.cited_url);
    agg.set(key, cur);
  }

  const sorted = Array.from(agg.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Sources</h2>
        <p className="mt-1 text-sm text-muted">
          Every domain AI engines cite when answering this prompt. Higher-authority sources
          are more likely to earn a mention.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No citations recorded yet.</p>
          <p className="mt-1 text-xs text-muted">
            Perplexity and Grok cite by default; ChatGPT and Gemini rarely do. Try running a
            Perplexity scan.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.slice(0, 30).map((d) => (
            <div
              key={d.domain}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink" title={d.domain}>
                    {d.domain}
                  </span>
                </div>
                <span className="chip">{d.count}×</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.isOwn && <span className="chip chip-accent">Own</span>}
                {d.isCompetitor && (
                  <span className="chip border-rose-200 bg-rose-50 text-rose-600">Competitor</span>
                )}
                {d.isTrusted && (
                  <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                    Trusted
                  </span>
                )}
                {!d.isOwn && !d.isCompetitor && !d.isTrusted && (
                  <span className="chip">Neutral</span>
                )}
              </div>
              {d.authority != null && (
                <p className="text-[11px] text-muted" title={d.authoritySource ?? undefined}>
                  Authority <span className="font-semibold text-ink">{Math.round(d.authority)}</span>
                  {d.authoritySource && (
                    <span className="ml-1 text-muted">· {d.authoritySource}</span>
                  )}
                </p>
              )}
              {d.urls.size > 0 && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-muted hover:text-ink">
                    {d.urls.size} cited URL{d.urls.size === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {Array.from(d.urls)
                      .slice(0, 8)
                      .map((u) => (
                        <li key={u} className="truncate">
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                            title={u}
                          >
                            {u}
                          </a>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
