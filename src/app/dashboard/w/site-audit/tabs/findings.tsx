import { statusChipClass, type SiteAudit } from "@/lib/site-audit-workspace";

// ============================================================
// Site Audit › Findings — every check in the audit, grouped by
// status: fail (top) → warn → pass. Each row surfaces detail +
// suggested fix text where the check provided one.
// ============================================================

export default function FindingsBody({ audit }: { audit: SiteAudit }) {
  const buckets: [string, typeof audit.issues][] = [
    ["fail", audit.issues.filter((i) => i.status === "fail")],
    ["warn", audit.issues.filter((i) => i.status === "warn")],
    ["pass", audit.issues.filter((i) => i.status === "pass")],
    ["other", audit.issues.filter((i) => !["fail", "warn", "pass"].includes(i.status))],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Findings</h2>
        <p className="mt-1 text-sm text-muted">
          Every AI-citability check run in this audit. Fixes come from the check itself when
          available.
        </p>
      </div>

      {audit.issues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No checks recorded on this audit.</p>
          <p className="mt-1 text-xs text-muted">
            An audit without an issues array likely completed with an error — re-run from the Site
            Audit module.
          </p>
        </div>
      ) : (
        buckets.map(
          ([status, list]) =>
            list.length > 0 && (
              <section key={status}>
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  {status[0].toUpperCase() + status.slice(1)} ({list.length})
                </h3>
                <ul className="space-y-2">
                  {list.map((issue, idx) => (
                    <li
                      key={`${status}-${idx}-${issue.check}`}
                      className="rounded-2xl border border-line bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{issue.check}</p>
                          {issue.detail && (
                            <p className="mt-1 text-xs text-muted">{issue.detail}</p>
                          )}
                          {issue.fix && (
                            <div className="mt-2 rounded-lg border border-accent/20 bg-accent/5 p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                                Fix
                              </p>
                              <p className="mt-0.5 text-xs text-ink">{issue.fix}</p>
                            </div>
                          )}
                        </div>
                        <span className={statusChipClass(issue.status)}>{issue.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )
      )}
    </div>
  );
}
