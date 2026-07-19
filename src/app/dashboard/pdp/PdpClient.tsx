"use client";

import { useState } from "react";
import { Copy, Check, AlertTriangle, FileSearch } from "lucide-react";

type PdpResult = {
  input: { url?: string; providedJson: boolean };
  productJsonLd: string;
  geoCopy: string;
  evidenceLedger: { field: string; value: string; source: string }[];
  missingFields: string[];
  diagnostics: string[];
  notes: string[];
};

function CodeBlock({
  title,
  filename,
  content,
}: {
  title: string;
  filename: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted">{filename}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="btn-secondary !h-9 inline-flex items-center gap-1.5 text-xs"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={download} className="btn-secondary !h-9 text-xs">
            Download
          </button>
        </div>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-surface p-3 text-xs leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}

export default function PdpClient({ brandId }: { brandId: string }) {
  const [url, setUrl] = useState("");
  const [productJson, setProductJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PdpResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (!url.trim() && !productJson.trim()) {
      alert("Enter a product URL or paste a product JSON to continue.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/pdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          url: url.trim() || undefined,
          productJson: productJson.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) setResult(data.result as PdpResult);
      else {
        setError(data.error || "Request failed");
        alert(data.error || "Request failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <label className="block text-sm font-medium">Product URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/products/your-product"
          className="mt-2 w-full rounded-lg border border-divide-line bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />

        <label className="mt-4 block text-sm font-medium">
          Or paste product JSON
        </label>
        <textarea
          value={productJson}
          onChange={(e) => setProductJson(e.target.value)}
          placeholder='{ "name": "...", "@type": "Product", ... }'
          rows={5}
          className="mt-2 w-full rounded-lg border border-divide-line bg-surface px-3 py-2 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-accent/40"
        />

        <button
          onClick={run}
          disabled={loading}
          className="btn-primary mt-4 !h-11 inline-flex items-center gap-2 disabled:opacity-60"
        >
          <FileSearch className="h-4 w-4" />
          {loading ? "Generating…" : result ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error && !result && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div className="space-y-6">
          {result.missingFields.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Missing required fields
              </p>
              <p className="mt-1">
                The following fields could not be extracted and must be filled in
                before publishing:{" "}
                <span className="font-semibold">
                  {result.missingFields.join(", ")}
                </span>
                .
              </p>
            </div>
          )}

          {result.notes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {result.notes.map((n, i) => (
                <p key={i}>• {n}</p>
              ))}
            </div>
          )}

          <CodeBlock
            title="schema.org Product JSON-LD"
            filename="product.jsonld"
            content={result.productJsonLd}
          />

          <CodeBlock
            title="AI-citation-optimized product copy"
            filename="product-geo-copy.md"
            content={result.geoCopy}
          />

          <div className="card p-5">
            <p className="font-semibold">Evidence ledger</p>
            <p className="mb-3 text-xs text-muted">
              Each extracted field and the source it was drawn from.
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b divide-line text-xs uppercase text-muted">
                  <th className="py-2 pr-4">Field</th>
                  <th className="py-2 pr-4">Value</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.evidenceLedger.length === 0 && (
                  <tr>
                    <td className="py-2 pr-4 text-muted" colSpan={3}>
                      No fields extracted.
                    </td>
                  </tr>
                )}
                {result.evidenceLedger.map((e, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 font-medium">{e.field}</td>
                    <td className="py-2 pr-4">{e.value || "—"}</td>
                    <td className="py-2 text-muted">{e.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.diagnostics.length > 0 && (
            <div className="card p-5">
              <p className="font-semibold">Citable-quality diagnostics</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {result.diagnostics.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted">
            Output contains <code>[ADD …]</code> placeholders for owner-only facts
            (exact price/currency, real review quotes, SKU). Fill these in before
            publishing so AI answer engines cite accurate information.
          </p>
        </div>
      )}
    </div>
  );
}
