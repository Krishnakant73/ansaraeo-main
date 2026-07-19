import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Citations — the citation-gap lens. Two columns:
//
//   1. They're on. You're not.  — sort by frequency; each row
//      offers a "Draft outreach" affordance that lands in Content
//      Studio pre-filled with the URL.
//
//   2. Both.  — co-cited pages. Often the highest ROI: same URL,
//      better anchor phrase gets you promoted.
//
// Nothing hides. Data is fully derived from `citations` joined
// against visibility_runs whose competitor_mentions include this
// competitor.
// ============================================================

type Row = {
  id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean }[] | null;
};

type CitationRow = {
  cited_url: string | null;
  cited_domain: string | null;
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

export default async function CitationsBody({ competitor }: { competitor: Competitor }) {
  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

  const only: Map<string, DomainAgg> = new Map();
  const both: Map<string, DomainAgg> = new Map();
  let totalGapRuns = 0;

  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, brand_mentioned, competitor_mentions")
      .in("prompt_id", promptIds);
    const rows = (runs as Row[] | null) ?? [];
    const nameLower = competitor.name.toLowerCase();

    const gapRunIds = rows
      .filter(
        (r) =>
          r.brand_mentioned === false &&
          (r.competitor_mentions ?? []).some(
            (m) => m.mentioned && m.name.toLowerCase() === nameLower,
          ),
      )
      .map((r) => r.id);
    const bothRunIds = rows
      .filter(
        (r) =>
          r.brand_mentioned === true &&
          (r.competitor_mentions ?? []).some(
            (m) => m.mentioned && m.name.toLowerCase() === nameLower,
          ),
      )
      .map((r) => r.id);
    totalGapRuns = gapRunIds.length;

    if (gapRunIds.length + bothRunIds.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select("cited_url, cited_domain, is_own_domain, is_trusted_source, authority_score, run_id")
        .in("run_id", [...gapRunIds, ...bothRunIds]);
      const citRows = (cits as CitationRow[] | null) ?? [];
      const gapSet = new Set(gapRunIds);

      const push = (map: Map<string, DomainAgg>, c: CitationRow) => {
        if (c.is_own_domain) return;
        const key = c.cited_domain ?? c.cited_url;
        if (!key) return;
        const cur =
          map.get(key) ??
          ({
            domain: key,
            count: 0,
            trusted: false,
            authority: null,
            urls: new Set<string>(),
          } as DomainAgg);
        cur.count += 1;
        if (c.is_trusted_source) cur.trusted = true;
        if (
          c.authority_score != null &&
          (cur.authority == null || c.authority_score > cur.authority)
        ) {
          cur.authority = c.authority_score;
        }
        if (c.cited_url) cur.urls.add(c.cited_url);
        map.set(key, cur);
      };
      for (const c of citRows) {
        if (gapSet.has(c.run_id)) push(only, c);
        else push(both, c);
      }
    }
  }

  const onlyList = Array.from(only.values()).sort((a, b) => b.count - a.count);
  const bothList = Array.from(both.values()).sort((a, b) => b.count - a.count);

  if (totalGapRuns === 0 && bothList.length === 0) {
    return (
      <div className="space-y-4">
        <Intro competitor={competitor} />
        <EmptyStateCoach
          title="No citations recorded yet"
          description="We only know about citations when an engine actually returns one. Run Perplexity or Google AI Overview scans on more prompts to grow this list."
          action={{
            label: "Run visibility scan",
            href: `/dashboard/b/${competitor.brand.slug}/visibility`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Intro competitor={competitor} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ColumnCard
          title="They're on. You're not."
          subtitle="Outreach targets — earn a citation here and the gap closes."
          list={onlyList}
          brandSlug={competitor.brand.slug}
          tone="gap"
        />
        <ColumnCard
          title="Both"
          subtitle="Co-cited pages — strengthen your anchor to get promoted."
          list={bothList}
          brandSlug={competitor.brand.slug}
          tone="shared"
        />
      </div>
    </div>
  );
}

function Intro({ competitor }: { competitor: Competitor }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">Citations</h2>
      <p className="mt-1 text-sm text-muted">
        Where {competitor.name}&rsquo;s citation gravity comes from — and where yours meets it.
      </p>
    </div>
  );
}

function ColumnCard({
  title,
  subtitle,
  list,
  brandSlug,
  tone,
}: {
  title: string;
  subtitle: string;
  list: DomainAgg[];
  brandSlug: string;
  tone: "gap" | "shared";
}) {
  const emptyMsg =
    tone === "gap"
      ? "No outreach gaps identified. Either coverage is even, or you're leading."
      : "No pages have cited both of you yet.";
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3">
        <p className="section-label">{title}</p>
        <p className="mt-1 text-xs text-muted">{subtitle}</p>
      </div>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line/70 bg-white/50 p-4 text-center text-[11px] text-muted">
          {emptyMsg}
        </p>
      ) : (
        <ul className="divide-y divide-line/60">
          {list.slice(0, 20).map((d) => (
            <li key={d.domain} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink" title={d.domain}>
                  {d.domain}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span>{d.count} run{d.count === 1 ? "" : "s"}</span>
                  {d.trusted && (
                    <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                      Trusted
                    </span>
                  )}
                  {d.authority != null && <span>Authority {Math.round(d.authority)}</span>}
                </div>
              </div>
              {tone === "gap" ? (
                <Link
                  href={`/dashboard/b/${brandSlug}/content?outreach=${encodeURIComponent(d.domain)}`}
                  className="btn-xs btn-xs-accent shrink-0"
                >
                  Draft outreach
                </Link>
              ) : (
                <Link
                  href={`/dashboard/b/${brandSlug}/citations`}
                  className="btn-xs btn-xs-ghost shrink-0"
                >
                  Inspect
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
