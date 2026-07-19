"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import AdvancedSurface, { type ValidatorSignal } from "@/components/dashboard/AdvancedSurface";

type Issue = { check: string; status: "pass" | "warning" | "fail"; detail: string; fix: string; category?: string; fixSnippet?: string };
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

const STATUS_VALUE: Record<Issue["status"], number> = { pass: 100, warning: 55, fail: 0 };

function categorize(check: string): string {
  const c = check.toLowerCase();
  if (c.includes("crawlab") || c.includes("sitemap") || c.includes("robots")) return "Crawlability";
  if (c.includes("llms") || c.includes("discovery") || c.includes("ai.json")) return "AI Discovery";
  if (c.includes("schema") || c.includes("json-ld") || c.includes("structured")) return "Structured Data";
  if (c.includes("security") || c.includes("header") || c.includes("https")) return "Security";
  if (c.includes("performance") || c.includes("render") || c.includes("image") || c.includes("weight")) return "Performance";
  if (c.includes("e-e-a-t") || c.includes("eeat") || c.includes("author")) return "E-E-A-T";
  if (c.includes("provenance")) return "Provenance";
  if (c.includes("agent-readiness") || c.includes("webmcp") || c.includes("mcp")) return "Agent-readiness";
  if (c.includes("citability")) return "Citability";
  if (c.includes("topical")) return "Topical Authority";
  if (c.includes("hidden") || c.includes("prompt-injection") || c.includes("integrity")) return "Integrity";
  return "Content & Structure";
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

function buildScorecard(issues: Issue[]) {
  const byCat = new Map<string, number[]>();
  for (const issue of issues) {
    const cat = issue.category ?? categorize(issue.check);
    const list = byCat.get(cat) ?? [];
    list.push(STATUS_VALUE[issue.status]);
    byCat.set(cat, list);
  }
  return Array.from(byCat.entries())
    .map(([name, vals]) => ({ name, score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), issueCount: vals.length }))
    .sort((a, b) => a.score - b.score);
}

function barColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState("Copy");
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setLabel("Copied!");
          setTimeout(() => setLabel("Copy"), 1500);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
      className="btn-secondary !h-8 inline-flex items-center gap-1.5 px-3 text-xs"
    >
      {label}
    </button>
  );
}

export default function SiteAuditClient({ brandId, latestAudit }: { brandId: string; latestAudit: Audit | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(latestAudit);

  // Map real audit findings onto the Advanced validators so the contextual
  // surface can auto-open the deep checks that are actually relevant. Driven
  // entirely by recorded issues — never estimated.
  function auditSignals(a: Audit): ValidatorSignal[] {
    const issues = a.issues ?? [];
    const failsIn = (cat: string) =>
      issues.filter((i) => (i.category ?? categorize(i.check)) === cat && i.status !== "pass");
    const failsOn = (kws: string[]) =>
      issues.filter((i) => kws.some((k) => i.check.toLowerCase().includes(k)) && i.status !== "pass");
    const count = (arr: { length: number }) => `${arr.length} check${arr.length === 1 ? "" : "s"} need work`;

    const structured = failsIn("Structured Data");
    const aiDiscovery = failsIn("AI Discovery");
    const crawl = failsIn("Crawlability");
    const security = failsIn("Security");
    const perf = failsIn("Performance");
    const links = failsOn(["internal link", "orphan", "link graph", "broken link"]);
    const headers = failsOn(["header", "hsts", "csp"]);

    return [
      {
        key: "schema",
        flagged: a.schema_markup_score < 80 || structured.length > 0,
        reason: structured.length
          ? count(structured)
          : a.schema_markup_score < 80
            ? `Schema score ${a.schema_markup_score}/100`
            : undefined,
      },
      {
        key: "llmsTxt",
        flagged: !a.llms_txt_present || aiDiscovery.length > 0,
        reason: !a.llms_txt_present
          ? "llms.txt not detected"
          : aiDiscovery.length
            ? count(aiDiscovery)
            : undefined,
      },
      { key: "robots", flagged: crawl.length > 0, reason: crawl.length ? count(crawl) : undefined },
      {
        key: "headerLinks",
        flagged: security.length > 0 || headers.length > 0,
        reason: security.length + headers.length ? count({ length: security.length + headers.length }) : undefined,
      },
      { key: "tokenBloat", flagged: perf.length > 0, reason: perf.length ? count(perf) : undefined },
      { key: "internalLinks", flagged: links.length > 0, reason: links.length ? count(links) : undefined },
    ];
  }

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
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                {audit.overall_score}
                <span className="ml-2 align-middle text-lg text-muted">Grade {scoreToGrade(audit.overall_score)}</span>
              </p>
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

          {audit.issues.length > 0 && (
            <div className="card mt-6 p-6">
              <p className="text-sm font-semibold">Category scorecard</p>
              <div className="mt-4 space-y-3">
                {buildScorecard(audit.issues).map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-muted">
                        {cat.score}/100 · {cat.issueCount} check{cat.issueCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div className={`h-full rounded-full ${barColor(cat.score)}`} style={{ width: `${cat.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audit.issues.length > 0 && (
            <div className="mt-6">
              <AdvancedSurface signals={auditSignals(audit)} />
            </div>
          )}

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
                  {issue.status !== "pass" && issue.fixSnippet && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted">Copy-paste fix:</p>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-surface p-3 text-xs leading-relaxed text-ink">
                        {issue.fixSnippet}
                      </pre>
                      <CopyButton text={issue.fixSnippet} />
                    </div>
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
