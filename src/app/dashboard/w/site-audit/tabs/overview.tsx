import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, type SiteAudit } from "@/lib/site-audit-workspace";

// ============================================================
// Site Audit › Overview — the three scores + llms.txt flag + a
// summary of pass/warn/fail counts. Audits are immutable so no
// re-run action here — that lives on the brand's Site Audit
// module page.
// ============================================================

function ScoreCard({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const tone =
    score == null
      ? "text-muted"
      : score >= 80
        ? "text-emerald-600"
        : score >= 50
          ? "text-amber-600"
          : "text-rose-600";
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="section-label">{label}</p>
      <p className={`mt-1 text-3xl font-bold tracking-tight ${tone}`}>
        {score == null ? "—" : `${score}`}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">out of 100</p>
    </div>
  );
}

export default function OverviewBody({ audit }: { audit: SiteAudit }) {
  const dominatingIssue = audit.issues.find((i) => i.status === "fail") ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Site audit</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              {audit.brand.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Snapshot from {timeAgo(audit.run_at)} · {audit.brand.domain ?? "no domain"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {audit.llms_txt_present === true && (
                <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                  llms.txt present
                </span>
              )}
              {audit.llms_txt_present === false && (
                <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                  llms.txt missing
                </span>
              )}
              <span className="chip">{audit.stats.issueCount} check{audit.stats.issueCount === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Overall</p>
            <p
              className={
                audit.overall_score == null
                  ? "text-3xl font-bold tracking-tight text-muted"
                  : audit.overall_score >= 80
                    ? "text-3xl font-bold tracking-tight text-emerald-600"
                    : audit.overall_score >= 50
                      ? "text-3xl font-bold tracking-tight text-amber-600"
                      : "text-3xl font-bold tracking-tight text-rose-600"
              }
            >
              {audit.overall_score ?? "—"}
            </p>
            {audit.stats.overallDelta != null && (
              <p
                className={
                  audit.stats.overallDelta > 0
                    ? "text-[11px] text-emerald-600"
                    : audit.stats.overallDelta < 0
                      ? "text-[11px] text-rose-600"
                      : "text-[11px] text-muted"
                }
              >
                {audit.stats.overallDelta > 0 ? "+" : ""}
                {audit.stats.overallDelta} vs previous
              </p>
            )}
          </div>
        </div>
      </section>

      {dominatingIssue && (
        <InsightCard
          variant="warning"
          title={`Top failing check · ${dominatingIssue.check}`}
          description={dominatingIssue.detail ?? "Fix details unavailable — inspect the audit row."}
          href={`/dashboard/w/site-audit/${audit.id}/findings`}
        />
      )}
      {audit.stats.failCount === 0 && audit.overall_score != null && audit.overall_score >= 80 && (
        <InsightCard
          variant="win"
          title="No failing checks in this audit"
          description="The site meets every AI-citability check we run. Re-audit periodically to catch drift."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreCard label="Schema markup" score={audit.schema_markup_score} />
        <ScoreCard label="Crawlability" score={audit.crawlability_score} />
        <ScoreCard
          label="llms.txt"
          score={audit.llms_txt_present == null ? null : audit.llms_txt_present ? 100 : 0}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4 text-center">
          <p className="text-xs text-muted">Pass</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{audit.stats.passCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 text-center">
          <p className="text-xs text-muted">Warn</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{audit.stats.warnCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 text-center">
          <p className="text-xs text-muted">Fail</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{audit.stats.failCount}</p>
        </div>
      </div>

      <InsightCard
        variant="info"
        title={`Brand · ${audit.brand.name}`}
        description="Open the brand workspace for the operational picture."
        href={`/dashboard/w/brand/${audit.brand.slug}/overview`}
        meta="Brand"
      />
    </div>
  );
}
