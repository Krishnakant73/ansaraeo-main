"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, HelpCircle, Store } from "lucide-react";
import type { PriceFactCheckResult } from "@/lib/price-factcheck";

const ENGINES = ["chatgpt", "perplexity", "gemini", "grok", "copilot"] as const;

function Verdict({ v, detail }: { v?: "match" | "mismatch" | "unknown"; detail?: string }) {
  if (!v || v === "unknown") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <HelpCircle className="h-4 w-4" /> Unknown — not enough data
      </p>
    );
  }
  if (v === "match") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-600">
        <CheckCircle2 className="h-4 w-4" /> Matches feed
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-red-500">
      <XCircle className="h-4 w-4" /> Mismatch vs feed
    </p>
  );
}

export default function PriceFactCheckClient() {
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [truePrice, setTruePrice] = useState("");
  const [inStock, setInStock] = useState<"" | "true" | "false">("");
  const [engines, setEngines] = useState<string[]>(["chatgpt", "perplexity", "gemini"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PriceFactCheckResult | null>(null);
  const [error, setError] = useState("");

  function toggleEngine(e: string) {
    setEngines((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/price-factcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandName,
        productName,
        truePrice: truePrice || undefined,
        inStock: inStock === "" ? undefined : inStock === "true",
        engines,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Brand name</span>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. YourStore" className="input mt-1 w-full" />
          </label>
          <label className="text-sm">
            <span className="font-medium">Product name</span>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Waterproof hiking backpack" className="input mt-1 w-full" />
          </label>
          <label className="text-sm">
            <span className="font-medium">True feed price <span className="text-muted">(optional)</span></span>
            <input value={truePrice} onChange={(e) => setTruePrice(e.target.value)} placeholder="₹1,499" className="input mt-1 w-full" />
          </label>
          <label className="text-sm">
            <span className="font-medium">True stock <span className="text-muted">(optional)</span></span>
            <select value={inStock} onChange={(e) => setInStock(e.target.value as "" | "true" | "false")} className="input mt-1 w-full">
              <option value="">Not specified</option>
              <option value="true">In stock</option>
              <option value="false">Out of stock</option>
            </select>
          </label>
        </div>
        <div>
          <p className="text-sm font-medium">Engines</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ENGINES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggleEngine(e)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  engines.includes(e) ? "bg-accent text-white" : "bg-grid text-muted"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <button onClick={run} disabled={loading || !brandName || !productName} className="btn-primary !h-11 disabled:opacity-60">
          {loading ? "Sampling AI engines…" : "Run fact-check"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Brand mention rate</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{Math.round(result.brandMentionRate * 100)}%</p>
              <p className="mt-1 text-[11px] text-muted">of engines that answered</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-muted">Price fact-check</p>
              <div className="mt-2"><Verdict v={result.priceMatch} /></div>
              {result.priceMatchDetail && <p className="mt-1 text-[11px] text-muted">{result.priceMatchDetail}</p>}
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium text-muted">Stock fact-check</p>
              <div className="mt-2"><Verdict v={result.stockMatch} /></div>
              {result.stockMatchDetail && <p className="mt-1 text-[11px] text-muted">{result.stockMatchDetail}</p>}
            </div>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Store className="h-4 w-4 text-accent" /> Competing retailers AI names
              <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                {result.competitorRetailers.length}
              </span>
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {result.competitorRetailers.map((r, i) => (
                <li key={i} className="rounded-full bg-grid px-3 py-1 text-xs font-medium text-ink">
                  {r}
                </li>
              ))}
              {result.competitorRetailers.length === 0 && (
                <li className="text-sm text-muted">No competing retailers detected (or no retailer extraction available).</li>
              )}
            </ul>
          </div>

          <div className="space-y-3">
            {result.engines.map((e) => (
              <div key={e.engine} className="card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize">{e.engine}</p>
                  {e.answered ? (
                    e.brandMentioned ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">brand named</span>
                    ) : (
                      <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">not named</span>
                    )
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">no answer</span>
                  )}
                </div>
                {e.note && <p className="mt-1 text-xs text-red-500">{e.note}</p>}
                {e.answered && (
                  <>
                    <p className="mt-2 text-xs text-muted">
                      {e.retailers.length} retailer(s) named
                      {e.cheapestRetailer ? ` · AI says cheapest: ${e.cheapestRetailer}` : ""}
                      {e.brandPriceStated ? ` · brand price stated: ${e.brandPriceStated}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-muted">{e.snippet}</p>
                  </>
                )}
              </div>
            ))}
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
