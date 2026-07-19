import { NextRequest, NextResponse } from "next/server";
import { claimJobs, completeJob, failJob, type JobRow } from "@/lib/platform/queue";
import { deliverEvent } from "@/lib/platform/webhooks";
import { verifyClaim } from "@/lib/platform/trust";
import { executeStep, type AgentStep } from "@/lib/platform/agent";
import { runVisibilityCheck, type EngineOutcome } from "@/lib/visibility-engine";

// ============================================================
// POST /api/worker/drain   (gated by CRON_SECRET, invoked by vercel.json cron)
//
// Drains up to `limit` pending/stuck jobs and runs them. This is the ONLY
// place that executes queued work; the cron routes (incl. nightly-runs) only
// ENQUEUE. `visibility_check` calls the canonical runVisibilityCheck() — the
// same pipeline the dashboard and content generation use, so behavior cannot
// drift. New job types (trust_verify, agent_step) are added here as branches.
// ============================================================

const DEFAULT_LIMIT = 10;

function mapOutcome(o: EngineOutcome) {
  if (!o.success) return { engine: o.engine, success: false, error: o.error };
  if ("skipped" in o) return { engine: o.engine, success: true };
  return { engine: o.engine, success: true, brand_mentioned: o.brand_mentioned };
}

// GET === POST here. Vercel cron uses HTTP GET; keep POST as the
// manual-drain / API-key path.
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : DEFAULT_LIMIT;

  let jobs: JobRow[] = [];
  try {
    jobs = await claimJobs(limit);
  } catch (err) {
    console.error("worker drain claim failed:", err);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }

  for (const job of jobs) {
    try {
      if (job.type === "visibility_check") {
        const promptId = (job.payload as { promptId?: string }).promptId;
        if (!promptId) throw new Error("visibility_check job missing promptId");
        const outcomes = await runVisibilityCheck(promptId);
        const results = outcomes.map(mapOutcome);
        await completeJob(job.id, { promptId, results });
        await deliverEvent({
          type: "visibility_check.completed",
          tenantId: job.tenant_id,
          data: { taskId: job.id, promptId, results },
        });
      } else if (job.type === "trust_verify") {
        // Phase 2 — AI Trust Engine. Same durable substrate as visibility_check:
        // no change to claimJobs/completeJob/failJob; the open JobType union
        // absorbs trust_verify. Result is persisted + delivered as trust.verified.
        const payload = job.payload as { claim?: string; evidenceRefs?: string[]; tenantId?: string };
        if (!payload.claim || !payload.tenantId) {
          throw new Error("trust_verify job missing claim/tenantId");
        }
        const result = await verifyClaim({
          claim: payload.claim,
          evidenceRefs: payload.evidenceRefs ?? [],
          tenantId: payload.tenantId,
        });
        await completeJob(job.id, result as unknown as Record<string, unknown>);
        await deliverEvent({
          type: "trust.verified",
          tenantId: job.tenant_id,
          data: result as unknown as Record<string, unknown>,
        });
      } else if (job.type === "agent_step") {
        // Phase 3 — AI Discovery Agent Runtime. Each step is a durable
        // agent_step job; executeStep runs the step's tool, persists plan state,
        // and enqueues the next step (or pauses on a Governance approval gate).
        // No change to claimJobs/completeJob/failJob — the open JobType union
        // absorbs agent_step.
        const payload = job.payload as { taskId?: string; step?: AgentStep };
        if (!payload.taskId || !payload.step) {
          throw new Error("agent_step job missing taskId/step");
        }
        const res = await executeStep(payload.taskId, payload.step);
        await completeJob(job.id, res as unknown as Record<string, unknown>);
        await deliverEvent({
          type: "agent.task.updated",
          tenantId: job.tenant_id,
          data: { taskId: payload.taskId, state: res.state },
        });
      } else {
        throw new Error(`No worker handler for job type: ${job.type}`);
      }
    } catch (err) {
      await failJob(job.id, err instanceof Error ? err : new Error(String(err)));
    }
  }

  return NextResponse.json({ success: true, drained: jobs.length });
}
