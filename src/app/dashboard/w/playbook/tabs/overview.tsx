import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, triggerLabel, type Playbook } from "@/lib/playbook-workspace";

// ============================================================
// Playbook › Overview — the sequence of steps that get instantiated
// as tasks when the playbook fires. Honest note: schema doesn't
// record which missions came from which playbook, so we can't show
// run history here.
// ============================================================

export default function OverviewBody({ playbook }: { playbook: Playbook }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Playbook</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{playbook.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {playbook.description ?? (
                <span className="italic text-muted">
                  No description set — a one-line &quot;when to use this&quot; helps operators pick it.
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="chip">{triggerLabel(playbook.trigger_type)}</span>
              <span
                className={
                  playbook.is_active
                    ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "chip"
                }
              >
                {playbook.is_active ? "active" : "paused"}
              </span>
              {playbook.stats.hasVerifyStep && <span className="chip">verify step</span>}
              {playbook.stats.hasApprovalStep && <span className="chip">approval gate</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Steps</p>
            <p className="text-2xl font-bold tracking-tight text-ink">{playbook.stats.stepCount}</p>
            <p className="text-[11px] text-muted">in sequence</p>
          </div>
        </div>
      </section>

      {playbook.stats.stepCount === 0 && (
        <InsightCard
          variant="warning"
          title="No steps defined"
              description="A playbook without steps can&apos;t do anything. Add steps in the Steps tab."
        />
      )}
      {!playbook.stats.hasVerifyStep && playbook.stats.stepCount > 0 && (
        <InsightCard
          variant="opportunity"
          title="No verify step"
          description="Every mission should end with a verify task that confirms the fix worked. Add one to close the loop."
        />
      )}
      {!playbook.is_active && (
        <InsightCard
          variant="info"
          title="Playbook is paused"
          description="Paused playbooks don't fire on their triggers. Use Activate to resume."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Org · ${playbook.org.name ?? "—"}`}
          description="Playbooks are org-scoped and available across every brand in the org."
          meta="Org"
        />
        <InsightCard
          variant="info"
          title={`Created ${timeAgo(playbook.created_at)}`}
          description={`Age ${playbook.stats.ageInDays}d — playbooks age well; review annually to keep them current.`}
          meta="Age"
        />
      </div>
    </div>
  );
}
