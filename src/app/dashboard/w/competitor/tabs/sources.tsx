import { createClient } from "@/lib/supabase/server";
import InsightCard from "@/workspace/primitives/InsightCard";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Sources — the outreach targets. Domains cited when
// this competitor is mentioned but YOU aren't. These are concrete
// "get cited here" places to invest content and PR.
// Aggregated from citations on runs where competitor_mentions has
// this competitor with mentioned=true AND brand_mentioned=false.
// ============================================================

type Row = {
  id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean }[] | null;
};

type CitationRow = {
  cited_domain: string | null;
  cited_url: string | null;
  is_own_domain: boolean | null;
  is_trusted_source: boolean | null;
  authority_score: number | null;
  run_id: string;
};

type DomainAgg = {
  domain: string;
  count: number;
  trusted: boolean;
  authority: number | null;
  urls: Set<string>;
};

export default async function SourcesBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

  let sorted: DomainAgg[] = [];
  let totalGapRuns = 0;
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, brand_mentioned, competitor_mentions")
      .in("prompt_id", promptIds);
    const nameLower = competitor.name.toLowerCase();
    const gapRunIds = ((runs as Row[] | null) ?? [])
      .filter(
        (r) =>
          r.brand_mentioned === false &&
          (r.competitor_mentions ?? []).some(
            (m) => m.mentioned && m.name.toLowerCase() === nameLower,
          ),
      )
      .map((r) => r.id);
    totalGapRuns = gapRunIds.length;

    if (gapRunIds.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select(
          "cited_domain, cited_url, is_own_domain, is_trusted_source, authority_score, run_id",
        )
        .in("run_id", gapRunIds);
      const rows = (cits as CitationRow[] | null) ?? [];

      const agg = new Map<string, DomainAgg>();
      for (const c of rows) {
        if (c.is_own_domain) continue; // your domain isn't an outreach target
        const key = c.cited_domain ?? c.cited_url;
        if (!key) continue;
        const cur =
          agg.get(key) ??
          ({ domain: key, count: 0, trusted: false, authority: null, urls: new Set<string>() } as DomainAgg);
        cur.count += 1;
        if (c.is_trusted_source) cur.trusted = true;
        if (c.authority_score != null && (cur.authority == null || c.authority_score > cur.authority)) {
          cur.authority = c.authority_score;
        }
        if (c.cited_url) cur.urls.add(c.cited_url);
        agg.set(key, cur);
      }
      sorted = Array.from(agg.values()).sort((a, b) => b.count - a.count);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Sources they win from</h2>
        <p className="mt-1 text-sm text-muted">
          Domains cited when {competitor.name} appears in AI answers but {competitor.brand.name}{" "}
          doesn&rsquo;t. These are your outreach targets — earn a mention here and you close the gap.
        </p>
      </div>

      {totalGapRuns > 0 && (
        <InsightCard
          variant="opportunity"
          title={`${sorted.length} outreach target${sorted.length === 1 ? "" : "s"} identified`}
          description={`Across ${totalGapRuns} answer${totalGapRuns === 1 ? "" : "s"} where they win. Prioritize by frequency + trust badge.`}
        />
      )}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No outreach targets found yet.</p>
          <p className="mt-1 text-xs text-muted">
            Either {competitor.name} isn&rsquo;t winning any prompts against you, or the engines that
            cite haven&rsquo;t been asked yet. Try running Perplexity scans.
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
                <span className="truncate text-sm font-semibold text-ink" title={d.domain}>
                  {d.domain}
                </span>
                <span className="chip">{d.count}×</span>
              </div>
              {d.trusted && (
                <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700 self-start">
                  Trusted source
                </span>
              )}
              {d.authority != null && (
                <p className="text-[11px] text-muted">
                  Authority <span className="font-semibold text-ink">{Math.round(d.authority)}</span>
                </p>
              )}
              {d.urls.size > 0 && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-muted hover:text-ink">
                    {d.urls.size} example URL{d.urls.size === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {Array.from(d.urls)
                      .slice(0, 6)
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
