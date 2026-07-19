import { createClient } from "@/lib/supabase/server";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// Engine › Sources — which domains does THIS engine cite when
// answering the brand's prompts? Sorted by frequency; own/trusted
// badges. High signal for citing engines (Perplexity, Grok); low
// signal for non-citing ones (surfaces the "empty" state honestly).
// ============================================================

type CitationRow = {
  cited_domain: string | null;
  cited_url: string | null;
  is_own_domain: boolean | null;
  is_competitor_domain: boolean | null;
  is_trusted_source: boolean | null;
  authority_score: number | null;
};

type Agg = {
  domain: string;
  count: number;
  isOwn: boolean;
  isCompetitor: boolean;
  isTrusted: boolean;
  authority: number | null;
  urls: Set<string>;
};

export default async function SourcesBody({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

  let citations: CitationRow[] = [];
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id")
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds)
      .limit(1000);
    const runIds = ((runs as { id: string }[] | null) ?? []).map((r) => r.id);
    if (runIds.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select(
          "cited_domain, cited_url, is_own_domain, is_competitor_domain, is_trusted_source, authority_score",
        )
        .in("run_id", runIds);
      citations = (cits as CitationRow[] | null) ?? [];
    }
  }

  const agg = new Map<string, Agg>();
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
        authority: null,
        urls: new Set<string>(),
      } as Agg);
    cur.count += 1;
    if (c.is_own_domain) cur.isOwn = true;
    if (c.is_competitor_domain) cur.isCompetitor = true;
    if (c.is_trusted_source) cur.isTrusted = true;
    if (c.authority_score != null && (cur.authority == null || c.authority_score > cur.authority)) {
      cur.authority = c.authority_score;
    }
    if (c.cited_url) cur.urls.add(c.cited_url);
    agg.set(key, cur);
  }
  const sorted = Array.from(agg.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Sources cited by {engine.displayName}</h2>
        <p className="mt-1 text-sm text-muted">
          Domains {engine.displayName} pulls from when answering questions about{" "}
          {engine.brand.name}.{" "}
          {!engine.meta.cites && (
            <span className="italic">
              {engine.displayName} rarely surfaces citations — expect sparse data.
            </span>
          )}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No citations recorded from {engine.displayName}.</p>
          <p className="mt-1 text-xs text-muted">
            {engine.meta.cites
              ? "Run more scans to populate."
              : "This engine's answers rarely include citation links."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.slice(0, 30).map((d) => (
            <div key={d.domain} className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink" title={d.domain}>
                  {d.domain}
                </span>
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
                {!d.isOwn && !d.isCompetitor && !d.isTrusted && <span className="chip">Neutral</span>}
              </div>
              {d.authority != null && (
                <p className="text-[11px] text-muted">
                  Authority <span className="font-semibold text-ink">{Math.round(d.authority)}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
