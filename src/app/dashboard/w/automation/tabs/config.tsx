import type { Automation } from "@/lib/automation-workspace";

// ============================================================
// Automation › Config — the raw trigger + actions JSONB rendered
// as readable key/value lists. Not editable inline (the workflow
// generic route handles that); this is transparency.
// ============================================================

export default function ConfigBody({ automation }: { automation: Automation }) {
  const triggerEntries = Object.entries(automation.trigger ?? {});
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Configuration</h2>
        <p className="mt-1 text-sm text-muted">
          The trigger + actions payload the runtime evaluates. Editing lives on the
          classic automations page today.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Trigger</p>
        {triggerEntries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Not configured.</p>
        ) : (
          <dl className="mt-2 divide-y divide-line">
            {triggerEntries.map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 py-2 text-sm">
                <dt className="w-32 shrink-0 font-medium text-muted">{k}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-xs text-ink">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Actions ({automation.actions.length})</p>
        {automation.actions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No actions defined.</p>
        ) : (
          <ol className="mt-2 space-y-3">
            {automation.actions.map((a, i) => {
              const entries = Object.entries(a ?? {});
              return (
                <li key={i} className="rounded-xl border border-line bg-surface p-3">
                  <p className="text-xs font-semibold text-accent">Step {i + 1}</p>
                  <dl className="mt-1.5 divide-y divide-line/60">
                    {entries.map(([k, v]) => (
                      <div key={k} className="flex items-start gap-3 py-1.5 text-xs">
                        <dt className="w-24 shrink-0 font-medium text-muted">{k}</dt>
                        <dd className="min-w-0 flex-1 break-all font-mono text-ink">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
