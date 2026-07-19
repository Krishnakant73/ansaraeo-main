import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabase } from "./__fixtures__/mockSupabase";
import {
  enqueueJob,
  claimJobs,
  completeJob,
  failJob,
  backoffFor,
  statusAfterFail,
} from "./queue";

describe("queue (pure helpers)", () => {
  it("backoffFor grows exponentially and caps at 30 min", () => {
    expect(backoffFor(1)).toBe(30_000);
    expect(backoffFor(2)).toBe(60_000);
    expect(backoffFor(20)).toBe(30 * 60 * 1000);
  });

  it("statusAfterFail retries below max, fails at/after max", () => {
    expect(statusAfterFail(1, 3)).toBe("pending");
    expect(statusAfterFail(3, 3)).toBe("failed");
  });
});

describe("queue (with mock supabase)", () => {
  let mock = createMockSupabase();

  beforeEach(() => {
    mock = createMockSupabase();
  });

  it("enqueueJob inserts a pending job and returns its id", async () => {
    const { jobId } = await enqueueJob(
      "visibility_check",
      { promptId: "p1" },
      { tenantId: "org1" },
      mock.client
    );
    expect(jobId).toBeTruthy();
    const rows = mock.tables["jobs"];
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].payload).toEqual({ promptId: "p1" });
  });

  it("idempotencyKey dedupes re-enqueues", async () => {
    const a = await enqueueJob("visibility_check", { promptId: "p1" }, { tenantId: "org1", idempotencyKey: "k1" }, mock.client);
    const b = await enqueueJob("visibility_check", { promptId: "p1" }, { tenantId: "org1", idempotencyKey: "k1" }, mock.client);
    expect(a.jobId).toBe(b.jobId);
    expect(mock.tables["jobs"]).toHaveLength(1);
  });

  it("claimJobs returns pending jobs, marks them processing, bumps attempts", async () => {
    await enqueueJob("visibility_check", { promptId: "p1" }, { tenantId: "org1" }, mock.client);
    const jobs = await claimJobs(5, undefined, mock.client);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("processing");
    expect(jobs[0].attempts).toBe(1);
    expect(mock.tables["jobs"][0].status).toBe("processing");
  });

  it("claimJobs skips jobs whose run_at is in the future", async () => {
    await enqueueJob(
      "visibility_check",
      { promptId: "p2" },
      { tenantId: "org1", runAt: new Date(Date.now() + 60_000) },
      mock.client
    );
    const jobs = await claimJobs(5, undefined, mock.client);
    expect(jobs).toHaveLength(0);
  });

  it("claimJobs reclaims stuck processing jobs past the window", async () => {
    await mock.client.from("jobs").insert({
      tenant_id: "org1",
      type: "visibility_check",
      payload: { promptId: "p3" },
      status: "processing",
      attempts: 0,
      started_at: new Date(Date.now() - 11 * 60_000).toISOString(),
    });
    const jobs = await claimJobs(5, undefined, mock.client);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].attempts).toBe(1);
  });

  it("completeJob marks done and stores result", async () => {
    const { jobId } = await enqueueJob("visibility_check", { promptId: "p1" }, { tenantId: "org1" }, mock.client);
    await completeJob(jobId, { ok: true }, mock.client);
    const row = mock.tables["jobs"].find((j) => j.id === jobId)!;
    expect(row.status).toBe("done");
    expect(row.result).toEqual({ ok: true });
  });

  it("failJob retries (pending + backoff) below max attempts", async () => {
    const { jobId } = await enqueueJob("visibility_check", { promptId: "p1" }, { tenantId: "org1", maxAttempts: 3 }, mock.client);
    await failJob(jobId, new Error("boom"), undefined, mock.client);
    const row = mock.tables["jobs"].find((j) => j.id === jobId)!;
    expect(row.status).toBe("pending");
    expect(row.last_error).toBe("boom");
    expect(new Date(row.run_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("failJob marks failed when attempts reach max", async () => {
    const { jobId } = await enqueueJob("visibility_check", { promptId: "p1" }, { tenantId: "org1", maxAttempts: 1 }, mock.client);
    await failJob(jobId, new Error("boom"), undefined, mock.client);
    const row = mock.tables["jobs"].find((j) => j.id === jobId)!;
    expect(row.status).toBe("failed");
  });
});
