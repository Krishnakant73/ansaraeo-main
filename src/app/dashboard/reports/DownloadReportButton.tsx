"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

// Fetch the report PDF. Only retries on a network-level failure
// ("Failed to fetch") — i.e. the request never got a response. On a cold
// dev server the route can take ~50s to compile; the first request's
// connection is often dropped, but the retry then hits the warm, fast route.
async function fetchReport(brandId: string, attempts = 2): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(`/api/reports/generate?brandId=${brandId}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export default function DownloadReportButton({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchReport(brandId);
      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.json())?.error ?? "";
        } catch {
          // non-JSON error body — keep detail empty
        }
        setError(detail || "Failed to generate report");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "visibility_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not reach the report service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="btn-primary disabled:opacity-60"
      >
        <FileDown className="mr-2 h-4 w-4" />
        {loading ? "Generating…" : "Download PDF report"}
      </button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </>
  );
}
