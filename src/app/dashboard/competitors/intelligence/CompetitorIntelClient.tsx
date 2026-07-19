"use client";

import { useState } from "react";

type Opportunity = {
  domain: string;
  timesCitedAgainstYou: number;
  competitorNames: string[];
  exampleQueries: string[];
};

type Stat = {
  competitor: string;
  mentionedRuns: number;
  totalRuns: number;
  sharePercent: number;
  sentiment: { positive: number; neutral: number; negative: number };
};

type Battlecard = {
  competitor: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  stat: Stat;
};

export default function CompetitorIntelClient({ brandId, brandName }: { brandId: string; brandName: string }) {
  return (
    <div className="mt-6 space-y-10">
      <CitationOpportunities brandId={brandId} brandName={brandName} />
      <Battlecards brandId={brandId} brandName={brandName} />
    </div>
  );
}

function CitationOpportunities({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [briefFor, setBriefFor] = useState<string | null>(null);
  const [brief, setBrief] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/competitors/opportunities?brandId=${brandId}`);
    const data = await res.json();
    setLoading(false);
    if (res.ok) setOpps(data.opportunities);
    else setError(data.error);
  }

  async function getBrief(domain: string) {
    setBriefFor(domain);
    setBrief("");
    const res = await fetch("/api/competitors/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, domain, brandName }),
    });
    const data = await res.json();
    setBriefFor(null);
    if (res.ok) setBrief(data.brief);
    else setBrief(`Error: ${data.error}`);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Citation Opportunities</h2>
        <button onClick={load} disabled={loading} className="btn-primary !h-9 disabled:opacity-60">
          {loading ? "Loading…" : opps ? "Refresh" : "Load opportunities"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Domains cited in answers where a competitor appears but {brandName} does not — your outreach targets.
      </p>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {opps && opps.length === 0 && (
        <p className="mt-4 text-sm text-muted">No lost-citation opportunities found yet — keep running visibility checks.</p>
      )}

      {opps && opps.length > 0 && (
        <div className="card mt-4 divide-y divide-line/60">
          {opps.map((o) => (
            <div key={o.domain} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.domain}</p>
                  <p className="text-xs text-muted">
                    Cited {o.timesCitedAgainstYou}× against you · competitors: {o.competitorNames.join(", ")}
                  </p>
                </div>
                <button onClick={() => getBrief(o.domain)} className="btn-secondary !h-9 whitespace-nowrap">
                  Generate brief
                </button>
              </div>
              {o.exampleQueries.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                  {o.exampleQueries.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
              {briefFor === o.domain && <p className="mt-3 text-sm text-muted">Generating…</p>}
            </div>
          ))}
        </div>
      )}

      {brief && (
        <div className="card mt-4 bg-surface p-5">
          <p className="text-sm font-semibold">Outreach brief</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{brief}</p>
        </div>
      )}
    </section>
  );
}

function Battlecards({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [cards, setCards] = useState<Battlecard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function loadStats() {
    const res = await fetch(`/api/competitors/battlecards?brandId=${brandId}`);
    const data = await res.json();
    if (res.ok) setStats(data.stats);
    else setError(data.error);
  }

  async function generate() {
    setLoading(true);
    setError("");
    setCards(null);
    const res = await fetch("/api/competitors/battlecards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, brandName }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setCards(data.cards);
    else setError(data.error);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Competitor Battlecards</h2>
        <button onClick={generate} disabled={loading} className="btn-primary !h-9 disabled:opacity-60">
          {loading ? "Generating…" : "Generate battlecards"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">AI side-by-side of each competitor&apos;s AI visibility — strengths, gaps, and your move.</p>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {stats && !cards && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.competitor} className="card p-4">
              <p className="font-semibold">{s.competitor}</p>
              <p className="mt-1 text-2xl font-extrabold">{s.sharePercent}%</p>
              <p className="text-xs text-muted">share of voice · {s.mentionedRuns}/{s.totalRuns} queries</p>
            </div>
          ))}
        </div>
      )}

      {!stats && !cards && (
        <button onClick={loadStats} className="btn-secondary mt-4 !h-9">
          Load share-of-voice stats
        </button>
      )}

      {cards && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {cards.map((c) => (
            <div key={c.competitor} className="card p-5">
              <p className="font-bold">
                {brandName} <span className="text-muted">vs</span> {c.competitor}
              </p>
              <p className="text-xs text-muted">Share of voice {c.stat.sharePercent}%</p>
              <div className="mt-3">
                <p className="text-sm font-semibold text-emerald-600">Strengths</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                  {c.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold text-amber-600">Weaknesses to exploit</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                  {c.weaknesses.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 rounded-lg bg-surface p-3 text-sm font-medium">{c.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
