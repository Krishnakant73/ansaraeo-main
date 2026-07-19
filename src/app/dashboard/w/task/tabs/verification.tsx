import InsightCard from "@/workspace/primitives/InsightCard";
import type { Task } from "@/lib/task-workspace";

// ============================================================
// Task › Verification — for verify-type tasks, shows the diff
// against the pre-fix baseline (verification_result JSONB). For
// non-verify tasks, an explainer that verification runs on the
// sibling verify task, not this one.
// ============================================================

export default function VerificationBody({ task }: { task: Task }) {
  if (task.type !== "verify") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Verification</h2>
          <p className="mt-1 text-sm text-muted">
            This is a{" "}
            <span className="chip">{task.type.replace(/_/g, " ")}</span>{" "}
            task. Verification runs on a separate <span className="chip">verify</span> task in the
            same mission.
          </p>
        </div>
        <InsightCard
          variant="info"
          title="Verify runs after the fix ships"
          description="Every mission ends with a verify task that re-scans the affected engine and diffs the response against a pre-fix baseline."
        />
      </div>
    );
  }

  const vr = task.verification_result;
  const passed = task.stats.verificationPassed;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Verification</h2>
        <p className="mt-1 text-sm text-muted">
          Diff between the pre-fix baseline and the current AI engine response.
        </p>
      </div>

      {!task.stats.hasVerification ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">Verification hasn&rsquo;t run yet.</p>
          <p className="mt-1 text-xs text-muted">
            Move this task to <span className="chip text-[10px]">in progress</span> to trigger the verify job.
          </p>
        </div>
      ) : passed === true ? (
        <InsightCard
          variant="win"
          title="Verification passed"
          description="The engine response now matches the expected fix. Mission's work loop is closed."
        />
      ) : passed === false ? (
        <InsightCard
          variant="warning"
          title="Verification failed"
          description="The engine response didn't reflect the fix. Reopen the fix task or investigate the diff."
        />
      ) : (
        <InsightCard
          variant="info"
          title="Verification ran"
          description="No explicit pass/fail signal — inspect the raw result below."
        />
      )}

      {task.stats.hasVerification && vr && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Raw result</p>
          <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-surface p-3 text-xs leading-relaxed text-ink">
{JSON.stringify(vr, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
