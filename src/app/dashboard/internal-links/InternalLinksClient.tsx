"use client";

import { useState } from "react";
import { Link2, Unlink, Network, AlertTriangle, Lightbulb, Copy } from "lucide-react";
import type { InternalLinkResult } from "@/lib/internal-link-graph";

function ListCard({
  title,
  icon,
  items,
  render,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: { url: string; title: string; extra?: string }[];
  render: (it: { url: string; title: string; extra?: string }) => React.ReactNode;
  empty: string;
}) {
  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
        <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">{items.length}</span>
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            {render(it)}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted">{empty}</li>}
      </ul>
    </div>
  );
}

export default function InternalLinksClient({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InternalLinkResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/internal-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      <button onClick={run} disabled={loading} className="btn-primary !h-11 disabled:opacity-60">
        {loading ? "Crawling site…" : result ? "Re-crawl" : "Analyze internal links"}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <>
          {result.notes.map((n, i) => (
            <div key={i} className="card p-3 text-sm text-muted">
              • {n}
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Sitemap pages</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.sitemapPages}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Crawled OK</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.crawledPages}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Orphans</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-amber-600">{result.orphans.length}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Broken links</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-red-500">{result.brokenLinks.length}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ListCard
              title="Orphan pages"
              icon={<Unlink className="h-4 w-4 text-amber-500" />}
              items={result.orphans.map((o) => ({ url: o.url, title: o.title }))}
              empty="No orphans — every page has at least one inbound internal link."
              render={(it) => (
                <span>
                  <span className="font-medium">{it.title}</span>
                  <br />
                  <span className="text-xs text-muted">{it.url}</span>
                </span>
              )}
            />
            <ListCard
              title="Dead-end pages"
              icon={<Unlink className="h-4 w-4 text-muted" />}
              items={result.deadEnds.map((o) => ({ url: o.url, title: o.title }))}
              empty="No dead-ends — every page links out internally."
              render={(it) => (
                <span>
                  <span className="font-medium">{it.title}</span>
                  <br />
                  <span className="text-xs text-muted">{it.url}</span>
                </span>
              )}
            />
            <ListCard
              title="Hubs (top in-degree)"
              icon={<Network className="h-4 w-4 text-emerald-600" />}
              items={result.hubs.map((h) => ({ url: h.url, title: h.title, extra: `${h.inDegree} in` }))}
              empty="No hub data."
              render={(it) => (
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    <span className="font-medium">{it.title}</span>
                    <br />
                    <span className="text-xs text-muted">{it.url}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                    {it.extra}
                  </span>
                </span>
              )}
            />
            <ListCard
              title="Broken internal links"
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              items={result.brokenLinks.map((b) => ({ url: b.target, title: b.target, extra: `HTTP ${b.status ?? "err"}` }))}
              empty="No broken internal links detected."
              render={(it) => (
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted">{it.url}</span>
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                    {it.extra}
                  </span>
                </span>
              )}
            />
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="h-4 w-4 text-accent" />
              TF-IDF link suggestions
              <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                {result.suggestions.length}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Pages that should link to each other based on content similarity (not already linked). Anchor = the target&rsquo;s
              heading.
            </p>
            <ul className="mt-3 divide-y divide-line/60">
              {result.suggestions.map((s, i) => (
                <li key={i} className="flex items-center gap-2 py-2 text-sm">
                  <span className="truncate text-xs text-muted" title={s.from}>
                    {s.from.replace(/^https?:\/\/[^/]+/, "")}
                  </span>
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="truncate text-xs text-muted" title={s.to}>
                    {s.to.replace(/^https?:\/\/[^/]+/, "")}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                    “{s.anchor}”
                  </span>
                </li>
              ))}
              {result.suggestions.length === 0 && <li className="text-sm text-muted">No suggestions.</li>}
            </ul>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Copy className="h-4 w-4 text-accent" />
              Keyword cannibalization
              <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                {result.cannibalization.length}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Pages competing for the same significant keyword — consolidate or differentiate their intent.
            </p>
            <ul className="mt-3 space-y-4">
              {result.cannibalization.map((c, i) => (
                <li key={i}>
                  <p className="text-sm font-semibold">
                    “{c.keyword}” <span className="text-xs font-normal text-muted">— {c.pages.length} pages</span>
                  </p>
                  <ul className="mt-1 space-y-1">
                    {c.pages.map((p) => (
                      <li key={p.url} className="truncate text-xs text-muted">
                        • {p.title} ({p.url.replace(/^https?:\/\/[^/]+/, "")})
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {result.cannibalization.length === 0 && <li className="text-sm text-muted">No cannibalization detected.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
