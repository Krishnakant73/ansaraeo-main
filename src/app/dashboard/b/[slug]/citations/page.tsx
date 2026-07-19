import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { getReadiness } from "@/lib/data-readiness";
import { DataReadinessCard } from "@/components/shared/DataReadinessCard";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
} from "@/components/ui/sheet";
import SourcePanel from "@/components/dashboard/objects/SourcePanel";

export const dynamic = "force-dynamic";

export default async function CitationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brand.id);
  const readiness = await getReadiness("citation-graph", { brandId: brand.id });
  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("id, prompt_id, run_at, engines(name)")
        .in("prompt_id", promptIds)
    : { data: [] };

  const runIds = (runs ?? []).map((r) => r.id);

  const { data: citations } = runIds.length
    ? await supabase
        .from("citations")
        .select("id, run_id, cited_domain, cited_url, is_own_domain, is_competitor_domain, source_quality, authority_score, authority_source")
        .in("run_id", runIds)
    : { data: [] };

  // Enrich citations with which prompt/engine they came from
  const runById = new Map((runs ?? []).map((r) => [r.id, r]));
  const promptById = new Map((prompts ?? []).map((p) => [p.id, p]));

  const enrichedCitations = (citations ?? []).map((c) => {
    const run = runById.get(c.run_id);
    const prompt = run ? promptById.get(run.prompt_id) : undefined;
    const engineName = run ? (Array.isArray(run.engines) ? run.engines[0] : run.engines)?.name : undefined;
    return { ...c, promptText: prompt?.text ?? "—", engineName: engineName ?? "—", runAt: run?.run_at };
  });

  // Top cited domains — this is the "Citation Path Analysis" lite version:
  // which third-party domains keep showing up across your tracked prompts,
  // so you know who to try to get featured on/by.
  const domainCounts = new Map<string, number>();
  for (const c of enrichedCitations) {
    if (c.is_own_domain) continue; // only interested in third-party sources here
    domainCounts.set(c.cited_domain, (domainCounts.get(c.cited_domain) ?? 0) + 1);
  }
  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Group third-party citations by domain so each "most-cited source" row can
  // open a Source workspace panel listing the prompts it was cited for.
  const citationsByDomain: Record<string, { promptText: string; engineName: string }[]> = {};
  for (const c of enrichedCitations) {
    if (c.is_own_domain) continue;
    (citationsByDomain[c.cited_domain] ??= []).push({
      promptText: c.promptText,
      engineName: c.engineName,
    });
  }

  // ---------- Citation Decay / Trend (reads persisted data only) ----------
  const runMonthById = new Map<string, string>();
  for (const r of runs ?? []) {
    const d = r.run_at ? new Date(r.run_at) : null;
    runMonthById.set(r.id, d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : "unknown");
  }

  const buckets = new Map<string, { total: number; own: number; competitor: number }>();
  const domainMonths = new Map<string, Map<string, number>>();
  for (const c of citations ?? []) {
    const month = runMonthById.get(c.run_id);
    if (!month || month === "unknown") continue;
    const b = buckets.get(month) ?? { total: 0, own: 0, competitor: 0 };
    b.total += 1;
    if (c.is_own_domain) b.own += 1;
    if (c.is_competitor_domain) b.competitor += 1;
    buckets.set(month, b);

    const dm = domainMonths.get(c.cited_domain) ?? new Map<string, number>();
    dm.set(month, (dm.get(month) ?? 0) + 1);
    domainMonths.set(c.cited_domain, dm);
  }

  const trendPoints = Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, b]) => ({
      month,
      total: b.total,
      own: b.own,
      competitor: b.competitor,
      ownShare: b.total ? Math.round((b.own / b.total) * 100) : 0,
    }));

  const domainTrends = Array.from(domainMonths.entries())
    .map(([domain, dm]) => {
      const sorted = Array.from(dm.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
      const first = sorted[0][1];
      const last = sorted[sorted.length - 1][1];
      const total = sorted.reduce((s, e) => s + e[1], 0);
      let trend = "DATA-INSUFFICIENT";
      if (sorted.length >= 2) {
        if (last > first) trend = "GROWING";
        else if (last < first) trend = "DECLINING";
        else trend = "STABLE";
      }
      return { domain, trend, first, last, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const TREND_STYLE: Record<string, string> = {
    GROWING: "bg-emerald-50 text-emerald-600",
    STABLE: "bg-grid text-muted",
    DECLINING: "bg-red-50 text-red-600",
    "DATA-INSUFFICIENT": "bg-grid text-muted",
  };

  return (
    <div>
      <PageHeader
        title="Citations"
        subtitle={`Which sources AI engines cite for ${brand.name}`}
      />

      {readiness.available && !readiness.state.justActivated && (
        <div className="mb-6">
          <DataReadinessCard
            title="Citation Graph"
            status={readiness.state.status}
            progress={readiness.state.percentage}
            confidence={readiness.state.confidence}
            requirements={readiness.state.requirements}
            estimatedCompletion={readiness.state.estimatedCompletion}
            message={readiness.state.message}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <Panel
          title="Citations"
          description="Sources cited when answering your tracked prompts"
          bodyClassName="overflow-x-auto p-0"
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Cited domain</th>
                <th className="px-5 py-3 font-semibold">Prompt</th>
                <th className="px-5 py-3 font-semibold">Engine</th>
                <th className="px-5 py-3 font-semibold" title="Real domain authority (DataForSEO domain_rank, 0–100) when available; otherwise the deterministic source-quality proxy.">
                  Authority
                </th>
                <th className="px-5 py-3 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody>
              {enrichedCitations.map((c) => (
                <tr key={c.id} className="border-b border-line/60 transition-colors hover:bg-surface">
                  <td className="px-5 py-3 font-medium">{c.cited_domain}</td>
                  <td className="max-w-[240px] truncate px-5 py-3 text-muted">&ldquo;{c.promptText}&rdquo;</td>
                  <td className="px-5 py-3 capitalize text-muted">{c.engineName}</td>
                  <td className="px-5 py-3">
                    {c.authority_score != null ? (
                      <span
                        className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent"
                        title={`Real domain authority (${c.authority_source ?? "external feed"})`}
                      >
                        DA {Math.round(c.authority_score)}
                      </span>
                    ) : c.source_quality != null ? (
                      <span
                        className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted"
                        title="Deterministic source-quality proxy (not true domain authority)"
                      >
                        ~{Math.round(c.source_quality)} proxy
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {c.is_own_domain ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        Your domain
                      </span>
                    ) : (
                      <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                        Third-party
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {enrichedCitations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted">
                    No citations recorded yet — run some visibility checks first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Most-cited sources"
          description="Domains AI engines keep citing instead of you — worth pursuing a mention or listing on these."
        >
          <ul className="space-y-3">
            {topDomains.map(([domain, count]) => (
              <li key={domain} className="flex items-center justify-between gap-2 text-sm">
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      className="truncate text-left font-medium text-ink outline-none transition-colors hover:text-accent hover:underline focus-visible:text-accent"
                      title="Open source workspace"
                    >
                      {domain}
                    </button>
                  </SheetTrigger>
                  <SheetContent>
                    <SourcePanel
                      domain={domain}
                      count={count}
                      citations={citationsByDomain[domain] ?? []}
                    />
                  </SheetContent>
                </Sheet>
                <span className="shrink-0 rounded-full bg-grid px-2 py-0.5 text-xs font-semibold">{count}×</span>
              </li>
            ))}
            {topDomains.length === 0 && <li className="text-sm text-muted">Not enough data yet.</li>}
          </ul>
        </Panel>
      </div>

      <div className="mt-10 space-y-6">
        <Panel
          title="Citation trend over time"
          description="Your own-domain vs third-party citation share, bucketed by the month of each visibility run. Built only from recorded runs — months with no runs are omitted, never estimated."
          bodyClassName="overflow-x-auto p-0"
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Month</th>
                <th className="px-5 py-3 font-semibold">Total cites</th>
                <th className="px-5 py-3 font-semibold">Your domain</th>
                <th className="px-5 py-3 font-semibold">Competitor</th>
                <th className="px-5 py-3 font-semibold">Own-domain share</th>
              </tr>
            </thead>
            <tbody>
              {trendPoints.map((p) => (
                <tr key={p.month} className="border-b border-line/60 transition-colors hover:bg-surface">
                  <td className="px-5 py-3 font-medium">{p.month}</td>
                  <td className="px-5 py-3 text-muted">{p.total}</td>
                  <td className="px-5 py-3 text-emerald-600">{p.own}</td>
                  <td className="px-5 py-3 text-muted">{p.competitor}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.ownShare}%</span>
                      <span className="h-2 w-24 overflow-hidden rounded-full bg-grid">
                        <span className="block h-full bg-emerald-500" style={{ width: `${p.ownShare}%` }} />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {trendPoints.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted">
                    No citation data yet — run visibility checks over multiple months to see a trend.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Per-domain momentum"
          description="How each cited domain&rsquo;s citation count is moving across months (≥2 months of data required to trend)."
        >
          <ul className="space-y-3">
            {domainTrends.map((d) => (
              <li key={d.domain} className="flex items-center justify-between text-sm">
                <span className="truncate">{d.domain}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">
                    {d.first}→{d.last}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TREND_STYLE[d.trend]}`}>
                    {d.trend}
                  </span>
                </span>
              </li>
            ))}
            {domainTrends.length === 0 && <li className="text-sm text-muted">Not enough data yet.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
