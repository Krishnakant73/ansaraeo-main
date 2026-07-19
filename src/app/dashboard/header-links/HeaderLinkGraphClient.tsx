"use client";

import { useState } from "react";
import { Link2, FileSearch, AlertTriangle, CheckCircle2, XCircle, Network } from "lucide-react";
import type { HeaderLinkGraphResult, HeaderLinkFinding } from "@/lib/header-link-graph";

const SEV_COLOR: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-blue-600",
  info: "text-slate-500",
};

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export default function HeaderLinkGraphClient({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HeaderLinkGraphResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/header-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  const s = result?.summary;

  return (
    <div className="space-y-6">
      <button onClick={run} disabled={loading} className="btn-primary !h-11 disabled:opacity-60">
        {loading ? "Reading headers…" : result ? "Re-scan" : "Analyze header links"}
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
              <p className="text-xs font-medium text-muted">Pages scanned</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.crawledPages}</p>
              <p className="mt-1 text-[11px] text-muted">of {result.sitemapPages} in sitemap</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Link edges</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.edges.length}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">AI-blocking</p>
              <p className={`mt-1 text-3xl font-extrabold tracking-tight ${s && s.blockingAi > 0 ? "text-red-500" : "text-emerald-600"}`}>
                {s?.blockingAi ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-muted">X-Robots-Tag</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Advertising AI index</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-600">{s?.advertisingLlmsTxt ?? 0}</p>
              <p className="mt-1 text-[11px] text-muted">llms.txt / ai.txt</p>
            </div>
          </div>

          {result.findings.length > 0 && (
            <div className="card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-accent" /> Findings
                <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">{result.findings.length}</span>
              </p>
              <ul className="mt-3 space-y-3">
                {result.findings.map((f: HeaderLinkFinding, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${SEV_COLOR[f.severity]}`} />
                    <div>
                      <p className={`text-sm font-semibold ${SEV_COLOR[f.severity]}`}>{f.pattern}</p>
                      <p className="text-xs text-muted">{f.detail}</p>
                      {f.pages && f.pages.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {f.pages.slice(0, 8).map((p) => (
                            <li key={p} className="truncate text-[11px] text-muted">
                              • {p.replace(/^https?:\/\/[^/]+/, "") || "/"}
                            </li>
                          ))}
                          {f.pages.length > 8 && <li className="text-[11px] text-muted">+ {f.pages.length - 8} more…</li>}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileSearch className="h-4 w-4 text-accent" /> Per-page discovery
              <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">{result.pages.length}</span>
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 pr-4 font-medium">Page</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Canonical</th>
                    <th className="py-2 pr-4 font-medium">llms.txt</th>
                    <th className="py-2 pr-4 font-medium">X-Robots-Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {result.pages.map((p) => (
                    <tr key={p.url} className="border-b border-line/60">
                      <td className="py-2 pr-4 font-medium" title={p.url}>
                        {pathOf(p.url) || "/"}
                      </td>
                      <td className="py-2 pr-4">
                        {p.status === null ? (
                          <span className="text-slate-400">err</span>
                        ) : p.status >= 400 ? (
                          <span className="text-red-500">{p.status}</span>
                        ) : (
                          <span className="text-emerald-600">{p.status}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {p.canonical ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {p.advertisesLlmsTxt ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted">
                        {p.xRobotsTag ? (
                          <span className={p.blocksAi ? "font-semibold text-red-500" : ""}>{p.xRobotsTag}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Network className="h-4 w-4 text-accent" /> Header link graph
              <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">{result.edges.length}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Directed <code>Link:</code> relationships found in response headers (canonical, alternate, preload, section/hub,
              llms.txt…).
            </p>
            <ul className="mt-3 divide-y divide-line/60">
              {result.edges.slice(0, 60).map((e, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="truncate text-xs text-muted" title={e.from}>
                    {pathOf(e.from) || "/"}
                  </span>
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="shrink-0 rounded-full bg-grid px-2 py-0.5 text-[11px] font-semibold text-muted">{e.rel}</span>
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="truncate text-xs text-muted" title={e.to}>
                    {pathOf(e.to) || "/"}
                  </span>
                  {!e.internal && <span className="ml-auto shrink-0 text-[11px] text-slate-400">ext</span>}
                </li>
              ))}
              {result.edges.length === 0 && <li className="text-sm text-muted">No graphable Link-header relationships found.</li>}
              {result.edges.length > 60 && (
                <li className="text-xs text-muted">+ {result.edges.length - 60} more edges…</li>
              )}
            </ul>
            {result.summary.orphanHeaderLinks > 0 && (
              <p className="mt-3 text-xs text-amber-600">
                {result.summary.orphanHeaderLinks} header-linked internal target(s) are not in the sitemap — AI crawlers may
                not discover them via the crawl path.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
