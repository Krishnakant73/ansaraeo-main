import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import type { Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Content Strategy — the "how are they publishing"
// view. Aggregated from citations whose cited_domain matches the
// competitor's domain. Deterministic-first: format inference and
// cluster tags derive from URL path shape, not LLM guesses.
//
// If competitor.domain is null we render an empty state instead
// of guessing — honesty design.
// ============================================================

type CitationRow = {
  cited_url: string | null;
  cited_domain: string | null;
  first_seen_at: string | null;
};

type PageAgg = {
  url: string;
  format: string;
  cluster: string;
  lastSeen: string | null;
};

const FORMAT_RULES: { label: string; test: (path: string) => boolean }[] = [
  { label: "Comparison", test: (p) => /(-vs-|\/vs\/|comparison|alternatives)/i.test(p) },
  { label: "How-to", test: (p) => /(how-to|how_to|guide|tutorial|steps?)/i.test(p) },
  { label: "Review", test: (p) => /(review|rating|rank(?:ed|ing)?|best-)/i.test(p) },
  { label: "Pricing", test: (p) => /(pricing|price|plans|cost)/i.test(p) },
  { label: "Product", test: (p) => /(product|features?|solution|platform)/i.test(p) },
];

function inferFormat(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
  for (const rule of FORMAT_RULES) if (rule.test(path)) return rule.label;
  return "Other";
}

function inferCluster(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
  const seg = path.split("/").filter(Boolean)[0] ?? "root";
  return seg.replace(/[-_]/g, " ").slice(0, 24) || "root";
}

export default async function ContentStrategyBody({ competitor }: { competitor: Competitor }) {
  if (!competitor.domain) {
    return (
      <div className="space-y-4">
        <Intro competitor={competitor} />
        <EmptyStateCoach
          title="No domain on file"
          description={`We can't map content strategy without ${competitor.name}'s domain. Add it in the Competitors list.`}
          action={{
            label: "Manage competitors",
            href: `/dashboard/b/${competitor.brand.slug}/competitors`,
          }}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);
  if (promptIds.length === 0) return <Intro competitor={competitor} />;

  const { data: runs } = await supabase
    .from("visibility_runs")
    .select("id")
    .in("prompt_id", promptIds);
  const runIds = ((runs as { id: string }[] | null) ?? []).map((r) => r.id);
  if (runIds.length === 0) return <Intro competitor={competitor} />;

  const { data: cits } = await supabase
    .from("citations")
    .select("cited_url, cited_domain, first_seen_at")
    .in("run_id", runIds);

  const domainLower = competitor.domain.toLowerCase();
  const pages = new Map<string, PageAgg>();
  for (const c of (cits as CitationRow[] | null) ?? []) {
    const url = c.cited_url;
    const dom = (c.cited_domain ?? "").toLowerCase();
    if (!url || !dom || !dom.includes(domainLower)) continue;
    if (pages.has(url)) continue;
    pages.set(url, {
      url,
      format: inferFormat(url),
      cluster: inferCluster(url),
      lastSeen: c.first_seen_at ?? null,
    });
  }

  const list = Array.from(pages.values());

  // Format mix.
  const formatMix = new Map<string, number>();
  for (const p of list) formatMix.set(p.format, (formatMix.get(p.format) ?? 0) + 1);
  const formatRows = Array.from(formatMix.entries()).sort((a, b) => b[1] - a[1]);

  // Topic clusters.
  const clusterMix = new Map<string, number>();
  for (const p of list) clusterMix.set(p.cluster, (clusterMix.get(p.cluster) ?? 0) + 1);
  const clusterRows = Array.from(clusterMix.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);

  if (list.length === 0) {
    return (
      <div className="space-y-4">
        <Intro competitor={competitor} />
        <EmptyStateCoach
          title="No content pages tracked yet"
          description={`No citations pointing to ${competitor.domain} have been captured in the runs we've done. Try a Perplexity or Google AI Overview scan to seed content signals.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Intro competitor={competitor} />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Format mix</p>
          <ul className="mt-3 space-y-2">
            {formatRows.map(([label, count]) => (
              <li key={label} className="flex items-center gap-3">
                <span className="w-24 text-xs text-ink">{label}</span>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${Math.min(100, (count / list.length) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right font-mono text-xs text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Topic clusters</p>
          <p className="mt-1 text-xs text-muted">Click a cluster to draft a comparison in Studio.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {clusterRows.map(([label, count]) => {
              const targets = list
                .filter((p) => p.cluster === label)
                .slice(0, 3)
                .map((p) => p.url);
              const params = new URLSearchParams({
                cluster: label,
                competitor: competitor.id,
                targets: targets.join("\n"),
              });
              return (
                <Link
                  key={label}
                  href={`/dashboard/b/${competitor.brand.slug}/content?${params.toString()}`}
                  className="chip capitalize hover:border-accent/40 hover:text-ink"
                  style={{ fontSize: `${Math.min(14, 11 + count / 2)}px` }}
                  aria-label={`Draft a comparison brief for the ${label} cluster (${count} competitor pages)`}
                >
                  {label}
                  <span className="ml-1 text-muted">{count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="section-label">Recent pages</p>
          <span className="text-xs text-muted">{list.length} total</span>
        </div>
        <ul className="divide-y divide-line/60">
          {list.slice(0, 20).map((p) => (
            <li key={p.url} className="flex items-center justify-between gap-3 py-2.5">
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent"
                title={p.url}
              >
                {p.url}
              </a>
              <span className="chip shrink-0">{p.format}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Intro({ competitor }: { competitor: Competitor }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">Content Strategy</h2>
      <p className="mt-1 text-sm text-muted">
        How {competitor.name} publishes — format mix, topic clusters, and every page an AI engine
        has cited them on.
      </p>
    </div>
  );
}
