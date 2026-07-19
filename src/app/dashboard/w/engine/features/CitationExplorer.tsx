import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// CitationExplorer — the Citations tab body. Two-column layout:
//   left  : "Domains this engine cites for your brand" — ranked
//           with own / competitor / trusted badges.
//   right : per-domain drill-down when ?domain=... is present —
//           lists the prompts + runs that led to that citation.
//
// Same primitive style as Competitor › Citations two-column tab.
// ============================================================

type CitationRow = {
  run_id: string;
  cited_domain: string | null;
  cited_url: string | null;
  is_own_domain: boolean | null;
  is_competitor_domain: boolean | null;
  is_trusted_source: boolean | null;
  authority_score: number | null;
};

type RunRow = {
  id: string;
  run_at: string;
  prompt_id: string;
};

type DomainAgg = {
  domain: string;
  count: number;
  isOwn: boolean;
  isCompetitor: boolean;
  isTrusted: boolean;
  authority: number | null;
  runIds: Set<string>;
  urls: Set<string>;
};

export default async function CitationExplorer({
  engine,
  activeDomain,
}: {
  engine: Engine;
  activeDomain?: string;
}) {
  const supabase = await createClient();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptText = new Map(
    ((prompts as { id: string; text: string }[] | null) ?? []).map((p) => [p.id, p.text]),
  );
  const promptIds = Array.from(promptText.keys());

  let citations: CitationRow[] = [];
  let runsById = new Map<string, RunRow>();
  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, run_at, prompt_id")
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds)
      .order("run_at", { ascending: false })
      .limit(1000);
    const runList = (runs as RunRow[] | null) ?? [];
    runsById = new Map(runList.map((r) => [r.id, r]));
    if (runList.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select(
          "run_id, cited_domain, cited_url, is_own_domain, is_competitor_domain, is_trusted_source, authority_score",
        )
        .in(
          "run_id",
          runList.map((r) => r.id),
        );
      citations = (cits as CitationRow[] | null) ?? [];
    }
  }

  const agg = new Map<string, DomainAgg>();
  for (const c of citations) {
    const key = c.cited_domain ?? c.cited_url ?? "";
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
        runIds: new Set<string>(),
        urls: new Set<string>(),
      } as DomainAgg);
    cur.count += 1;
    if (c.is_own_domain) cur.isOwn = true;
    if (c.is_competitor_domain) cur.isCompetitor = true;
    if (c.is_trusted_source) cur.isTrusted = true;
    if (c.authority_score != null && (cur.authority == null || c.authority_score > cur.authority)) {
      cur.authority = c.authority_score;
    }
    cur.runIds.add(c.run_id);
    if (c.cited_url) cur.urls.add(c.cited_url);
    agg.set(key, cur);
  }
  const sorted = Array.from(agg.values()).sort((a, b) => b.count - a.count);
  const active = activeDomain ? agg.get(activeDomain) : sorted[0];

  if (sorted.length === 0) {
    return (
      <EmptyStateCoach
        title={engine.meta.cites ? "No citations recorded yet" : `${engine.displayName} rarely cites`}
        description={
          engine.meta.cites
            ? `Run scans on ${engine.displayName} to populate the citation map.`
            : `${engine.displayName}'s answers rarely include citation links — expect this view to stay sparse.`
        }
        action={{
          label: "Run visibility scan",
          href: `/dashboard/b/${engine.brand.slug}/visibility`,
        }}
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="section-label">Cited domains</p>
          <span className="text-[11px] text-muted">Top 20 of {sorted.length}</span>
        </div>
        <ul className="space-y-1.5">
          {sorted.slice(0, 20).map((d) => {
            const selected = active?.domain === d.domain;
            return (
              <li key={d.domain}>
                <Link
                  href={`/dashboard/w/engine/${engine.name}/citations?domain=${encodeURIComponent(d.domain)}`}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    selected
                      ? "border-accent bg-accent/5"
                      : "border-line bg-white hover:border-accent/40"
                  }`}
                  aria-current={selected ? "true" : undefined}
                >
                  <span className="min-w-0 truncate text-ink">
                    {d.domain}
                    {d.isOwn && <span className="ml-2 chip chip-accent">Own</span>}
                    {d.isCompetitor && (
                      <span className="ml-2 chip border-rose-200 bg-rose-50 text-rose-600">
                        Competitor
                      </span>
                    )}
                    {d.isTrusted && (
                      <span className="ml-2 chip border-emerald-200 bg-emerald-50 text-emerald-700">
                        Trusted
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">{d.count}×</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        {active ? (
          <article className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="section-label">{active.domain}</p>
                <p className="mt-1 text-xs text-muted">
                  Cited {active.count} times across {active.runIds.size} runs.
                </p>
              </div>
              {active.authority != null && (
                <span className="chip">Authority {Math.round(active.authority)}</span>
              )}
            </div>
            {active.urls.size > 0 && (
              <div className="mt-3">
                <p className="section-label">URLs cited</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {Array.from(active.urls)
                    .slice(0, 10)
                    .map((u) => (
                      <li key={u}>
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="line-clamp-1 text-accent hover:underline"
                        >
                          {u}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <div className="mt-3">
              <p className="section-label">Prompts that led here</p>
              <ul className="mt-2 space-y-1 text-xs">
                {Array.from(active.runIds)
                  .slice(0, 10)
                  .map((rid) => {
                    const r = runsById.get(rid);
                    if (!r) return null;
                    return (
                      <li key={rid}>
                        <Link
                          href={`/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`}
                          className="line-clamp-1 text-ink hover:text-accent"
                        >
                          {promptText.get(r.prompt_id) ?? "prompt"}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </article>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            Pick a domain on the left to drill in.
          </p>
        )}
      </div>
    </div>
  );
}
