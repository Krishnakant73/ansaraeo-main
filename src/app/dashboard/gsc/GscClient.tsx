"use client";

import { useState } from "react";
import { LinkIcon, RefreshCw, Search, AlertTriangle, CheckCircle2, XCircle, BarChart3 } from "lucide-react";
import type { IndexInspection, BrandedLift } from "@/lib/gsc";

type MonitorResult = {
  siteUrl: string;
  sitemapPath: string | null;
  inspected: IndexInspection[];
  deindexed: string[];
  stats: { indexed: number; notIndexed: number; errors: number };
  notes: string[];
};

type AnalyticsRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };

const fmtPct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v}%`);
const fmtDelta = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v}`);

export default function GscClient({
  brandId,
  connected,
  defaultSite,
  flash,
}: {
  brandId: string;
  connected: boolean;
  defaultSite: string;
  flash?: string;
}) {
  const [siteUrl, setSiteUrl] = useState(defaultSite);
  const [monitor, setMonitor] = useState<MonitorResult | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsRow[] | null>(null);
  const [brandLift, setBrandLift] = useState<BrandedLift | null>(null);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [flashMsg, setFlashMsg] = useState(flash);

  function clearFlash() {
    setFlashMsg(undefined);
    if (typeof window !== "undefined") window.history.replaceState({}, "", "/dashboard/gsc");
  }

  async function runMonitor() {
    setLoadingMonitor(true);
    setError("");
    setMonitor(null);
    const res = await fetch("/api/gsc/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, siteUrl }),
    });
    const data = await res.json();
    setLoadingMonitor(false);
    if (res.ok) setMonitor(data.result);
    else setError(data.error);
  }

  async function runAnalytics() {
    setLoadingAnalytics(true);
    setError("");
    const res = await fetch("/api/gsc/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, siteUrl, days: 28 }),
    });
    const data = await res.json();
    setLoadingAnalytics(false);
    if (res.ok) {
      setAnalytics(data.result.rows);
      setBrandLift(data.result.brandedLift ?? null);
    } else setError(data.error);
  }

  async function reindex(url: string) {
    setReindexing(url);
    setError("");
    const res = await fetch("/api/gsc/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, url, siteUrl }),
    });
    const data = await res.json();
    setReindexing(null);
    if (!res.ok) setError(data.error);
    else alert(`Reindex requested for ${url}`);
  }

  if (!connected) {
    return (
      <div className="card space-y-4 p-6">
        {flashMsg && flashMsg !== "connected" && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" onClick={clearFlash}>
            GSC connection failed: {flashMsg}. Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars and that the
            Google Cloud OAuth client has <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/gsc/callback</code>{" "}
            as an authorized redirect URI.
          </div>
        )}
        <p className="text-sm text-muted">
          Connect the Google account that <strong>owns</strong> this brand&rsquo;s Search Console property. We request
          read-only Search Console + Indexing scopes; the refresh token is encrypted at rest.
        </p>
        <a href={`/api/gsc/auth?brandId=${brandId}`} className="btn-primary inline-flex !h-11 items-center gap-2">
          <LinkIcon className="h-4 w-4" /> Connect Google Search Console
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {flashMsg === "connected" && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" onClick={clearFlash}>
          ✓ Google Search Console connected.
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="card space-y-4 p-5">
        <label className="text-sm">
          <span className="font-medium">Search Console property (siteUrl)</span>
          <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} className="input mt-1 w-full" placeholder="https://example.com or sc-domain:example.com" />
          <span className="mt-1 block text-xs text-muted">
            URL-prefix property (<code>https://example.com</code>) or domain property (<code>sc-domain:example.com</code>).
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={runMonitor} disabled={loadingMonitor} className="btn-primary !h-11 disabled:opacity-60">
            <Search className="mr-1 h-4 w-4" /> {loadingMonitor ? "Inspecting…" : "Run index monitor"}
          </button>
          <button onClick={runAnalytics} disabled={loadingAnalytics} className="btn-primary !h-11 disabled:opacity-60">
            <BarChart3 className="mr-1 h-4 w-4" /> {loadingAnalytics ? "Loading…" : "Search analytics (28d)"}
          </button>
        </div>
      </div>

      {monitor && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Inspected</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{monitor.inspected.length}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Indexed</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-600">{monitor.stats.indexed}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Not indexed</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-amber-600">{monitor.stats.notIndexed}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Errors</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-red-500">{monitor.stats.errors}</p>
            </div>
          </div>

          {monitor.deindexed.length > 0 && (
            <div className="card border border-red-200 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-600">
                <AlertTriangle className="h-4 w-4" /> De-indexed since last run ({monitor.deindexed.length})
              </p>
              <ul className="mt-2 space-y-1">
                {monitor.deindexed.map((u) => (
                  <li key={u} className="truncate text-xs text-muted">{u}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-grid text-left text-xs font-semibold text-muted">
                <tr>
                  <th className="p-3">URL</th>
                  <th className="p-3">Coverage</th>
                  <th className="p-3">Rich results</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {monitor.inspected.map((r) => (
                  <tr key={r.url}>
                    <td className="max-w-xs truncate p-3" title={r.url}>{r.url.replace(/^https?:\/\//, "")}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 ${r.indexed ? "text-emerald-600" : "text-amber-600"}`}>
                        {r.indexed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {r.coverageState ?? r.error ?? "—"}
                      </span>
                    </td>
                    <td className="p-3">{r.richResults ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted" />}</td>
                    <td className="p-3">{r.mobileUsable ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted" />}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => reindex(r.url)} disabled={reindexing === r.url} className="inline-flex items-center gap-1 rounded-lg bg-grid px-2 py-1 text-xs font-semibold text-ink disabled:opacity-60">
                        <RefreshCw className="h-3 w-3" /> {reindexing === r.url ? "…" : "Reindex"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-3 text-xs text-muted">
            {monitor.notes.map((n, i) => (
              <p key={i}>• {n}</p>
            ))}
          </div>
        </>
      )}

      {analytics && (
        <div className="card overflow-x-auto p-0">
          <p className="p-4 text-sm font-semibold">Top queries (28d)</p>
          <table className="w-full text-sm">
            <thead className="bg-grid text-left text-xs font-semibold text-muted">
              <tr>
                <th className="p-3">Query</th>
                <th className="p-3">Clicks</th>
                <th className="p-3">Impr.</th>
                <th className="p-3">CTR</th>
                <th className="p-3">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {analytics.map((row) => (
                <tr key={row.query}>
                  <td className="p-3">{row.query}</td>
                  <td className="p-3">{row.clicks}</td>
                  <td className="p-3">{row.impressions}</td>
                  <td className="p-3">{(row.ctr * 100).toFixed(1)}%</td>
                  <td className="p-3">{row.position.toFixed(1)}</td>
                </tr>
              ))}
              {analytics.length === 0 && (
                <tr><td colSpan={5} className="p-3 text-muted">No Search Analytics data returned.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {brandLift && (
        <div className="card space-y-4 p-5">
          <p className="text-sm font-semibold">Branded-search lift <span className="font-normal text-muted">(baseline vs comparison half — connects AI visibility to demand)</span></p>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xs font-medium text-muted">Branded impr. share</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{brandLift.brandedImpressionSharePct ?? "—"}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-muted">Branded impr. lift</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{fmtPct(brandLift.branded.impressionsLiftPct)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-muted">Branded clicks lift</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{fmtPct(brandLift.branded.clicksLiftPct)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-muted">Branded position Δ</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{fmtDelta(brandLift.branded.positionDelta)}</p>
            </div>
          </div>
          {brandLift.topBrandedQueries.length > 0 && (
            <div className="text-xs text-muted">
              Top branded queries: {brandLift.topBrandedQueries.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
