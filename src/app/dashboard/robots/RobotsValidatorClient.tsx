"use client";

import { useState } from "react";
import { Bot, CheckCircle2, XCircle, AlertTriangle, FileLock2, ListChecks } from "lucide-react";
import type { RobotsValidationResult } from "@/lib/robots-validator";

const SEV_COLOR: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-blue-600",
  info: "text-slate-500",
};

export default function RobotsValidatorClient({ brandId, brandDomain }: { brandId: string; brandDomain?: string }) {
  const [url, setUrl] = useState(brandDomain ? (brandDomain.startsWith("http") ? brandDomain : `https://${brandDomain}`) : "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RobotsValidationResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/robots-validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, brandId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  const blockedCount = result?.bots.filter((b) => b.blanketBlocked).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-domain.com"
          className="input flex-1"
        />
        <button onClick={run} disabled={loading || !url} className="btn-primary !h-11 disabled:opacity-60">
          {loading ? "Validating…" : result ? "Re-validate" : "Validate robots.txt"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && !result.ok && (
        <div className="card p-5 text-sm text-muted">
          {result.notes.map((n, i) => (
            <p key={i}>• {n}</p>
          ))}
        </div>
      )}

      {result && result.ok && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">robots.txt</p>
              <p className={`mt-1 text-3xl font-extrabold tracking-tight ${result.fetched ? "text-emerald-600" : "text-slate-500"}`}>
                {result.fetched ? "Found" : "None"}
              </p>
              <p className="mt-1 text-[11px] text-muted">{result.groups.length} group(s)</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">AI crawlers</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.bots.length}</p>
              <p className="mt-1 text-[11px] text-muted">evaluated</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Blocked</p>
              <p className={`mt-1 text-3xl font-extrabold tracking-tight ${blockedCount > 0 ? "text-red-500" : "text-emerald-600"}`}>
                {blockedCount}
              </p>
              <p className="mt-1 text-[11px] text-muted">blanket-disallowed</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Sitemaps</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.sitemaps.length}</p>
            </div>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-accent" /> Per-crawler allow / disallow
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 pr-4 font-medium">AI crawler</th>
                    <th className="py-2 pr-4 font-medium">Group</th>
                    <th className="py-2 pr-4 font-medium">Homepage</th>
                    <th className="py-2 pr-4 font-medium">/sitemap.xml</th>
                  </tr>
                </thead>
                <tbody>
                  {result.bots.map((b) => (
                    <tr key={b.bot} className="border-b border-line/60">
                      <td className="py-2 pr-4 font-medium">{b.bot}</td>
                      <td className="py-2 pr-4 text-xs text-muted">
                        {b.group === "specific" ? `specific (${b.matchedUserAgent})` : b.group === "wildcard" ? "*" : "— (allowed)"}
                      </td>
                      <td className="py-2 pr-4">
                        {b.homepageAllowed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> allow
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500">
                            <XCircle className="h-4 w-4" /> disallow
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {b.sitemapAllowed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> allow
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500">
                            <XCircle className="h-4 w-4" /> disallow
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.sitemaps.length > 0 && (
              <p className="mt-3 text-xs text-muted">
                Sitemap(s): {result.sitemaps.map((s) => `${s}`).join(", ")}
              </p>
            )}
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-accent" /> Findings
              <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">{result.findings.length}</span>
            </p>
            <ul className="mt-3 space-y-3">
              {result.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${SEV_COLOR[f.severity]}`} />
                  <div>
                    <p className={`text-sm font-semibold ${SEV_COLOR[f.severity]}`}>{f.pattern}</p>
                    <p className="text-xs text-muted">{f.detail}</p>
                  </div>
                </li>
              ))}
              {result.findings.length === 0 && (
                <li className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> No crawlability problems detected — AI crawlers can read your key paths.
                </li>
              )}
            </ul>
          </div>

          <div className="card p-3 text-xs text-muted">
            {result.notes.map((n, i) => (
              <p key={i}>• {n}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
