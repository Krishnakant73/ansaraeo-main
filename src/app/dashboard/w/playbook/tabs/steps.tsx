import type { Playbook } from "@/lib/playbook-workspace";

// ============================================================
// Playbook › Steps — the ordered task template. Each row shows the
// step's title, its type (fix/content/approve/deploy/verify), and
// the action payload if any. Read-only in this tab; editing lives
// on the org's Playbooks admin page (not yet migrated).
// ============================================================

const TYPE_COLORS: Record<string, string> = {
  fix: "border-accent/30 bg-accent/5 text-accent",
  content: "border-violet-200 bg-violet-50 text-violet-700",
  approve: "border-amber-200 bg-amber-50 text-amber-700",
  deploy: "border-sky-200 bg-sky-50 text-sky-700",
  verify: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function StepsBody({ playbook }: { playbook: Playbook }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Steps</h2>
        <p className="mt-1 text-sm text-muted">
          The task sequence this playbook creates when it fires. Read-only here —
          edit on the org&rsquo;s Playbooks admin page.
        </p>
      </div>

      {playbook.steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No steps defined yet.</p>
          <p className="mt-1 text-xs text-muted">
            A playbook needs at least one step to do anything on trigger.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {playbook.steps.map((step, i) => {
            const typeClass = step.type ? (TYPE_COLORS[step.type] ?? "chip") : "chip";
            return (
              <li key={i} className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-muted">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{step.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {step.type && (
                        <span className={`chip text-[10px] ${typeClass}`}>{step.type}</span>
                      )}
                    </div>
                    {step.action && Object.keys(step.action).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-accent">
                          Action payload
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-surface p-2 text-[11px] leading-relaxed text-ink">
{JSON.stringify(step.action, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
