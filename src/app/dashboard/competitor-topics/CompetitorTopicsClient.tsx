"use client";

import { useState } from "react";
import { GitCompare, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { TopicalCoverageResult } from "@/lib/topical-coverage";

export default function CompetitorTopicsClient({ brandId }: { brandId: string }) {
  const [competitors, setCompetitors] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TopicalCoverageResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    const list = competitors
      .split(/[\n,]/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setError("Enter at least one competitor domain (one per line).");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/competitor-topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, competitors: list }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  const hostOf = (d: string) => {
    try {
      return new URL(d).host;
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <label className="text-sm font-medium">Competitor domains</label>
        <p className="mt-1 text-xs text-muted">
          One domain per line (e.g. competitor.com). We read each site&rsquo;s sitemap.xml.
        </p>
        <textarea
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value)}
          rows={3}
          placeholder={"competitor-a.com\ncompetitor-b.com"}
          className="input mt-2 w-full font-mono text-sm"
        />
        <button onClick={run} disabled={loading} className="btn-primary mt-3 !h-11 disabled:opacity-60">
          {loading ? "Comparing sitemaps…" : result ? "Re-compare" : "Compare topical coverage"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <>
          {result.notes.map((n, i) => (
            <div key={i} className="card p-3 text-sm text-muted">
              • {n}
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Competitors read</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.competitors.length}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Topic gaps</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-red-500">{result.gapTokens.length}</p>
              <p className="mt-1 text-[11px] text-muted">they cover, you don&rsquo;t</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Your strengths</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-600">{result.strengthTokens.length}</p>
              <p className="mt-1 text-[11px] text-muted">you cover, they don&rsquo;t</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <XCircle className="h-4 w-4 text-red-500" /> Topics to close
                <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                  {result.gapTokens.length}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">Sorted by how many competitors cover each — the strongest signals first.</p>
              <ul className="mt-3 space-y-2">
                {result.gapTokens.map((g) => (
                  <li key={g.token} className="flex items-center justify-between gap-2 rounded-lg bg-grid px-3 py-2">
                    <span className="font-medium">{g.token}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-muted">{g.competitorDomains.map(hostOf).join(", ")}</span>
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        {g.competitorCount}
                      </span>
                    </span>
                  </li>
                ))}
                {result.gapTokens.length === 0 && (
                  <li className="text-sm text-muted">No gap topics — you cover everything your competitors do (by URL topic).</li>
                )}
              </ul>
            </div>

            <div className="card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Your strengths
                <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                  {result.strengthTokens.length}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">Topics you cover that none of the compared competitors do.</p>
              <ul className="mt-3 space-y-2">
                {result.strengthTokens.map((s) => (
                  <li key={s.token} className="rounded-lg bg-grid px-3 py-2 font-medium">
                    {s.token}
                  </li>
                ))}
                {result.strengthTokens.length === 0 && (
                  <li className="text-sm text-muted">No unique strengths detected among the compared competitors.</li>
                )}
              </ul>
            </div>
          </div>

          {result.gapTokens.length > 0 && (
            <div className="card p-4 text-xs text-muted">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
              Topic matching is a URL-structure heuristic (path segments/tokens). A gap token means a competitor uses that
              word in its URLs and you don&rsquo;t — verify it&rsquo;s a real content opportunity before producing content.
            </div>
          )}
        </>
      )}
    </div>
  );
}
