import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Durable job queue (Postgres table-as-queue).
// This is THE execution substrate Phase 2 (trust_verify) and Phase 3
// (agent_step) build on. `type` is an OPEN union — adding a job type needs
// only a worker branch, never a schema/migration change.
// See docs/PHASE1_API_GATEWAY.md §3.1.
// ============================================================

export type JobType = "visibility_check" | "trust_verify" | "agent_step" | (string & {});
export type JobStatus = "pending" | "processing" | "done" | "failed" | "dead";

export interface JobRow {
  id: string;
  tenant_id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  run_at: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  result: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface EnqueueOpts {
  tenantId: string;
  runAt?: Date;
  priority?: number;
  idempotencyKey?: string;
  maxAttempts?: number;
}

const STUCK_PROCESSING_WINDOW_MS = 10 * 60 * 1000; // reclaim jobs stuck > 10 min

/** Exponential backoff capped at 30 min. Pure — unit-testable. */
export function backoffFor(attempts: number, baseMs = 30_000): number {
  return Math.min(baseMs * 2 ** Math.max(0, attempts - 1), 30 * 60 * 1000);
}

/** Next status after a failure. `attempts` is the pre-failure count, so the
 * just-failed attempt makes it attempts+1; retry only if that is under the cap.
 * Pure — unit-testable. */
export function statusAfterFail(attempts: number, maxAttempts: number): JobStatus {
  return attempts + 1 < maxAttempts ? "pending" : "failed";
}

export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  opts: EnqueueOpts,
  sb: SupabaseClient = createServiceClient()
): Promise<{ jobId: string }> {
  // Idempotency: if a non-terminal job with the same key exists, return it.
  if (opts.idempotencyKey) {
    const { data: existing } = await sb
      .from("jobs")
      .select("id, status")
      .eq("idempotency_key", opts.idempotencyKey)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();
    if (existing) return { jobId: existing.id };
  }
  const row = {
    tenant_id: opts.tenantId,
    type,
    payload,
    status: "pending",
    attempts: 0,
    priority: opts.priority ?? 5,
    run_at: (opts.runAt ?? new Date()).toISOString(),
    max_attempts: opts.maxAttempts ?? 3,
    idempotency_key: opts.idempotencyKey ?? null,
  };
  const { data, error } = await sb.from("jobs").insert(row).select("id").single();
  if (error) throw new Error(`enqueueJob failed: ${error.message}`);
  return { jobId: (data as { id: string }).id };
}

export async function claimJobs(
  limit: number,
  types?: JobType[],
  sb: SupabaseClient = createServiceClient()
): Promise<JobRow[]> {
  const nowIso = new Date().toISOString();
  const stuckIso = new Date(Date.now() - STUCK_PROCESSING_WINDOW_MS).toISOString();

  const pendingQ = sb.from("jobs").select("*").eq("status", "pending").lte("run_at", nowIso);
  const pending = await (types ? pendingQ.in("type", types) : pendingQ);
  const stuckQ = sb.from("jobs").select("*").eq("status", "processing").lt("started_at", stuckIso);
  const stuck = await (types ? stuckQ.in("type", types) : stuckQ);

  const all = [...((pending.data as JobRow[]) ?? []), ...((stuck.data as JobRow[]) ?? [])];
  all.sort(
    (a, b) =>
      a.priority - b.priority || new Date(a.run_at).getTime() - new Date(b.run_at).getTime()
  );
  const jobs = all.slice(0, limit);
  if (jobs.length === 0) return [];

  // Mark each claimed (no raw-SQL increment; per-job update keeps counts correct).
  for (const j of jobs) {
    await sb
      .from("jobs")
      .update({ status: "processing", started_at: nowIso, attempts: j.attempts + 1 })
      .eq("id", j.id);
  }
  return jobs.map((j) => ({ ...j, status: "processing" as JobStatus, started_at: nowIso, attempts: j.attempts + 1 }));
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>,
  sb: SupabaseClient = createServiceClient()
): Promise<void> {
  const { error } = await sb
    .from("jobs")
    .update({ status: "done", result, finished_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(`completeJob failed: ${error.message}`);
}

export async function failJob(
  jobId: string,
  error: Error,
  opts?: { retry?: boolean },
  sb: SupabaseClient = createServiceClient()
): Promise<void> {
  const { data: job } = await sb
    .from("jobs")
    .select("attempts, max_attempts")
    .eq("id", jobId)
    .maybeSingle();
  const attempts = job?.attempts ?? 0;
  const maxAttempts = job?.max_attempts ?? 3;
  const nextStatus = statusAfterFail(attempts, maxAttempts);
  const willRetry = opts?.retry !== false && nextStatus === "pending";
  const { error: updErr } = await sb
    .from("jobs")
    .update({
      status: nextStatus,
      last_error: error.message,
      run_at: willRetry
        ? new Date(Date.now() + backoffFor(attempts)).toISOString()
        : new Date().toISOString(),
      finished_at: willRetry ? null : new Date().toISOString(),
    })
    .eq("id", jobId);
  if (updErr) throw new Error(`failJob failed: ${updErr.message}`);
}
