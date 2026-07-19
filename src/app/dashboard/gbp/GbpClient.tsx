"use client";

import { useState } from "react";

type GbpResult = {
  found: boolean;
  statusLabel: string;
  statusEmoji: string;
  claimSignals: string[];
  maintenanceSignals: string[];
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  businessStatus?: string;
  primaryCategory?: string;
  rating?: number;
  reviewCount?: number;
  mapsUrl?: string;
  editorialSummary?: string;
  recentReview?: string;
  photoCount?: number;
};

const STATUS_TEXT: Record<string, string> = {
  claimed_maintained: "Claimed & actively maintained",
  claimed_partial: "Claimed, partially maintained",
  claimed_minimal: "Claimed but barely maintained",
  unclaimed: "Unclaimed or auto-generated",
  not_found: "No profile found",
};

export default function GbpClient() {
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GbpResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (!businessName.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/gbp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, location }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="max-w-2xl">
      <div className="card space-y-4 p-6">
        <div>
          <label className="text-sm font-medium">Business name</label>
          <input
            className="input mt-1 w-full"
            placeholder="e.g. Sharma Dental Clinic"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">City / area (optional)</label>
          <input
            className="input mt-1 w-full"
            placeholder="e.g. Pune"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <button onClick={run} disabled={loading || !businessName.trim()} className="btn-primary !h-11 disabled:opacity-60">
          {loading ? "Checking…" : "Check profile"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {result && (
        <div className="card mt-6 p-6">
          {!result.found ? (
            <p className="font-semibold">No Google Business Profile found for that name{location ? ` in ${location}` : ""}.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{result.statusEmoji}</span>
                <div>
                  <p className="font-bold">{result.name}</p>
                  <p className="text-sm text-muted">
                    {STATUS_TEXT[result.statusLabel] ?? result.statusLabel}
                    {result.businessStatus ? ` · ${result.businessStatus}` : ""}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {result.address && (
                  <div>
                    <dt className="text-muted">Address</dt>
                    <dd>{result.address}</dd>
                  </div>
                )}
                {result.phone && (
                  <div>
                    <dt className="text-muted">Phone</dt>
                    <dd>{result.phone}</dd>
                  </div>
                )}
                {result.website && (
                  <div>
                    <dt className="text-muted">Website</dt>
                    <dd className="truncate">
                      <a href={result.website} className="text-accent underline" target="_blank" rel="noreferrer">
                        {result.website}
                      </a>
                    </dd>
                  </div>
                )}
                {result.primaryCategory && (
                  <div>
                    <dt className="text-muted">Category</dt>
                    <dd>{result.primaryCategory}</dd>
                  </div>
                )}
                {result.rating !== undefined && (
                  <div>
                    <dt className="text-muted">Rating</dt>
                    <dd>
                      {result.rating} ★ ({result.reviewCount ?? 0} reviews)
                    </dd>
                  </div>
                )}
                {result.photoCount !== undefined && (
                  <div>
                    <dt className="text-muted">Photos</dt>
                    <dd>{result.photoCount}</dd>
                  </div>
                )}
              </dl>

              {result.mapsUrl && (
                <a href={result.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent underline">
                  Open in Google Maps
                </a>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-surface p-3">
                  <p className="text-xs font-semibold text-emerald-600">Claim signals</p>
                  <p className="mt-1 text-sm">{result.claimSignals.length ? result.claimSignals.join(", ") : "None detected"}</p>
                </div>
                <div className="rounded-lg bg-surface p-3">
                  <p className="text-xs font-semibold text-amber-600">Maintenance signals</p>
                  <p className="mt-1 text-sm">
                    {result.maintenanceSignals.length ? result.maintenanceSignals.join(", ") : "None detected"}
                  </p>
                </div>
              </div>

              {result.editorialSummary && (
                <p className="mt-3 text-sm text-muted">
                  <span className="font-medium">Google summary:</span> {result.editorialSummary}
                </p>
              )}
              {result.recentReview && (
                <p className="mt-2 text-sm text-muted">
                  <span className="font-medium">Latest review:</span> {result.recentReview}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
