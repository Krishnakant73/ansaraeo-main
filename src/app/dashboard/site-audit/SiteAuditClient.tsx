"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Issue = { check: string; status: "pass" | "warning" | "fail"; detail: string; fix: string };
type Audit = {
  overall_score: number;
  schema_markup_score: number;
  crawlability_score: number;
  llms_txt_present: boolean;
  issues: Issue[];
  run_at: string;
};

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  fail: <XCircle className="h-4 w-4 text-red-500" />,
};

export default function SiteAuditClient({ brandId, latestAudit }: { brandId: string; latestAudit: Audit | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(latestAudit);

  async function runAudit() {
    setLoading(true);
    const res = await fetch("/api/site-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setAudit(data.audit);
      router.refresh();
    } else {
      alert(data.error);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          {audit && (
            <p className="text-xs text-muted">
              Last checked {new Date(audit.run_at).toLocaleString("en-IN")}
            </p>
          )}
        </div>
        <button onClick={runAudit} disabled={loading} className="btn-primary !h-11 disabled:opacity-60">
          {loading ? "Auditing…" : audit ? "Re-run audit" : "Run first audit"}
        </button>
      </div>

      {!audit ? (
        <p className="mt-6 text-sm text-muted">No audit yet — click &ldquo;Run first audit&rdquo; to check your site.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="card p-6 text-center">
              <p className="text-xs font-medium text-muted">Overall Score</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{audit.overall_score}</p>
            </div>
            <div className="card p-6 text-center">
              <p className="text-xs font-medium text-muted">Schema Markup</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{audit.schema_markup_score}</p>
            </div>
            <div className="card p-6 text-center">
              <p className="text-xs font-medium text-muted">Crawlability</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{audit.crawlability_score}</p>
            </div>
          </div>

          <div className="card mt-6 divide-y divide-line/60">
            {audit.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-3 p-5">
                <span className="mt-0.5">{STATUS_ICON[issue.status]}</span>
                <div className="flex-1">
                  <p className="font-semibold">{issue.check}</p>
                  <p className="mt-1 text-sm text-muted">{issue.detail}</p>
                  {issue.status !== "pass" && (
                    <p className="mt-2 text-sm font-medium text-accent">Fix: {issue.fix}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
