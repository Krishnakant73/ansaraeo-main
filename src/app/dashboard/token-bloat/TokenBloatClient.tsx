"use client";

import { useState } from "react";
import { FileStack, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import type { TokenBloatResult } from "@/lib/token-bloat";

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-grid">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

const SEV_COLOR: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-blue-600",
};

export default function TokenBloatClient({ brandId, brandDomain }: { brandId: string; brandDomain?: string }) {
  const [url, setUrl] = useState(brandDomain ? (brandDomain.startsWith("http") ? brandDomain : `https://${brandDomain}`) : "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TokenBloatResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/token-bloat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, brandId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-product-page.com"
          className="input flex-1"
        />
        <button onClick={run} disabled={loading || !url} className="btn-primary !h-11 disabled:opacity-60">
          {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze page"}
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
              <p className="text-xs font-medium text-muted">Est. total tokens</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.estTotalTokens.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-muted">~bytes: {(result.htmlBytes / 1024).toFixed(0)} KB</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">AI efficiency</p>
              <p
                className={`mt-1 text-3xl font-extrabold tracking-tight ${
                  result.efficiencyScore >= 60 ? "text-emerald-600" : result.efficiencyScore >= 35 ? "text-amber-600" : "text-red-500"
                }`}
              >
                {result.efficiencyScore}
              </p>
              <p className="mt-1 text-[11px] text-muted">/100 — % citable content</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">Data-* attrs</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.dataAttrCount}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-xs font-medium text-muted">CSS classes</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{result.classCount}</p>
            </div>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="h-4 w-4 text-accent" /> Token breakdown
            </p>
            <div className="mt-4 space-y-3">
              <Bar label="Citable content" value={result.contentRatio} color="#10b981" />
              <Bar label="HTML markup / tags" value={result.markupRatio} color="#94a3b8" />
              <Bar label="Inline scripts" value={result.scriptRatio} color="#ef4444" />
              <Bar label="Inline styles" value={result.styleRatio} color="#f59e0b" />
            </div>
            <p className="mt-3 text-xs text-muted">
              Est. content {result.estContentTokens.toLocaleString()} · markup {result.estMarkupTokens.toLocaleString()} · scripts{" "}
              {result.estScriptTokens.toLocaleString()} · styles {result.estStyleTokens.toLocaleString()} tokens.
              {result.hasJsonLd ? " JSON-LD present ✓." : " No JSON-LD present."}
            </p>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FileStack className="h-4 w-4 text-accent" /> Bloat findings
              <span className="rounded-full bg-grid px-2 py-0.5 text-xs font-semibold text-muted">
                {result.flags.length}
              </span>
            </p>
            <ul className="mt-3 space-y-3">
              {result.flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  {f.severity === "high" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className={`text-sm font-semibold ${SEV_COLOR[f.severity]}`}>{f.pattern}</p>
                    <p className="text-xs text-muted">{f.detail}</p>
                  </div>
                </li>
              ))}
              {result.flags.length === 0 && (
                <li className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> No major bloat patterns detected — page is lean for AI crawlers.
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
