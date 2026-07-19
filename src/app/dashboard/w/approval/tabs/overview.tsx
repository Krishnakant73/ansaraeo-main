import Link from "next/link";
import InsightCard from "@/workspace/primitives/InsightCard";
import { statusChipClass, targetLabel, timeAgo, type Approval } from "@/lib/approval-workspace";

// ============================================================
// Approval › Overview — who requested, who signs, what's being
// approved. Rejection notes surface prominently since they're
// visible to the requester.
// ============================================================

export default function OverviewBody({ approval: a }: { approval: Approval }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Approval</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              {targetLabel(a.target)}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Requires <span className="font-semibold">{a.approver_role}</span> sign-off.
              Requested {timeAgo(a.created_at)}.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className={statusChipClass(a.status)}>{a.status}</span>
              <span className="chip">{a.approver_role}</span>
              {a.stats.hoursToDecision != null && (
                <span className="chip">decided in {a.stats.hoursToDecision}h</span>
              )}
              {a.stats.isPending && a.stats.ageInHours > 24 && (
                <span className="chip border-rose-200 bg-rose-50 text-rose-600">
                  {a.stats.ageInHours}h stale
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {a.status === "pending" && a.stats.ageInHours > 24 && (
        <InsightCard
          variant="warning"
          title="This approval has been pending over 24h"
          description="Stale approvals block deploys. Decide or reassign the approver role."
        />
      )}
      {a.status === "rejected" && a.note && (
        <InsightCard
          variant="warning"
          title="Rejected — reason"
          description={a.note}
        />
      )}
      {a.status === "approved" && (
        <InsightCard
          variant="win"
          title="Approved"
          description={
            a.stats.hoursToDecision != null
              ? `Signed off in ${a.stats.hoursToDecision}h. Deploy can proceed.`
              : "Signed off. Deploy can proceed."
          }
        />
      )}

      {/* Target link */}
      {a.target && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Target</p>
          <div className="mt-2">
            {a.target.kind === "task" ? (
              <Link
                href={`/dashboard/w/task/${a.target.id}/overview`}
                className="text-sm font-medium text-accent hover:underline"
              >
                Open task · {a.target.title} →
              </Link>
            ) : (
              <Link
                href={`/dashboard/w/content/${a.target.id}/overview`}
                className="text-sm font-medium text-accent hover:underline"
              >
                Open draft · {a.target.title ?? "Untitled"} →
              </Link>
            )}
          </div>
        </section>
      )}

      <InsightCard
        variant="info"
        title={`Brand · ${a.brand.name}`}
        description="Open the brand workspace for the operational context."
        href={`/dashboard/w/brand/${a.brand.slug}/overview`}
        meta="Brand"
      />

      <p className="text-xs text-muted">
        Requested by{" "}
        {a.requested_by ? (
          <code className="rounded bg-surface px-1.5 py-0.5 text-[11px]">
            {a.requested_by.slice(0, 8)}…
          </code>
        ) : (
          "unknown"
        )}
        {a.decided_by &&
          <>
            {" · Decided by "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[11px]">
              {a.decided_by.slice(0, 8)}…
            </code>
          </>
        }
      </p>
    </div>
  );
}
