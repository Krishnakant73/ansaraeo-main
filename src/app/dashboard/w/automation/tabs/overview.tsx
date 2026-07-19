import Link from "next/link";
import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, type Automation } from "@/lib/automation-workspace";

// ============================================================
// Automation › Overview — the rule at a glance. Trigger card,
// action count, activation state, and links to the pipeline view.
// ============================================================

export default function OverviewBody({ automation }: { automation: Automation }) {
  const trigger = automation.trigger ?? {};
  const triggerType = trigger.type ? String(trigger.type) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <p className="section-label">{automation.is_active ? "Active" : "Inactive"}</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">{automation.name}</h2>
        {automation.description && (
          <p className="mt-1 text-sm text-muted">{automation.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={
              automation.is_active
                ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                : "chip"
            }
          >
            {automation.is_active ? "On" : "Off"}
          </span>
          {triggerType && <span className="chip">Trigger: {triggerType}</span>}
          <span className="chip">
            {automation.stats.actionCount} action{automation.stats.actionCount === 1 ? "" : "s"}
          </span>
          <span className="chip">
            Updated {timeAgo(automation.updated_at)}
          </span>
        </div>
      </section>

      {!automation.stats.hasTrigger && (
        <InsightCard
          variant="warning"
          title="No trigger configured"
          description="This automation will never fire until you set a trigger type + config."
        />
      )}
      {automation.stats.actionCount === 0 && (
        <InsightCard
          variant="warning"
          title="No actions defined"
          description="Even when the trigger fires, nothing will happen. Add at least one action."
        />
      )}
      {automation.stats.hasTrigger && automation.stats.actionCount > 0 && !automation.is_active && (
        <InsightCard
          variant="info"
          title="Ready but disabled"
          description="Trigger + actions are set. Flip Activate to start firing."
        />
      )}
      {automation.is_active && automation.stats.hasTrigger && automation.stats.actionCount > 0 && (
        <InsightCard
          variant="win"
          title="Firing when the trigger matches"
          description="Automation is armed. Every time the trigger fires, actions run in order."
        />
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Pipeline</p>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            <p className="font-semibold text-amber-700">TRIGGER</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink">
              {triggerType ?? "—"}
            </p>
          </div>
          <span className="text-muted">→</span>
          {automation.actions.length === 0 ? (
            <span className="text-xs italic text-muted">no actions</span>
          ) : (
            automation.actions.map((a, i) => (
              <div
                key={i}
                className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-xs"
              >
                <p className="font-semibold text-accent">STEP {i + 1}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink">
                  {a.type ? String(a.type) : "—"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Brand · ${automation.brand.name}`}
          description="Open the brand workspace to see all automations for this brand."
          href={`/dashboard/w/brand/${automation.brand.slug}/overview`}
          meta="Brand"
        />
        <InsightCard
          variant="info"
          title="Automations index"
          description="Full list of automations across every brand you can access."
          href={`/dashboard/w/automation`}
          meta="Index"
        />
      </div>
    </div>
  );
}
