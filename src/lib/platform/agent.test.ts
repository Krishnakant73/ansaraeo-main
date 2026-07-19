import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createMockSupabase } from "./__fixtures__/mockSupabase";
import {
  planSteps,
  createAgentTask,
  executeStep,
  approveStep,
  type AgentStep,
  type AgentToolDeps,
  type AgentGoal,
  type AgentActionDeps,
} from "./agent";
import { assertTrustAbove, verifyClaim } from "./trust";

const SIGNING_KEY = "0".repeat(64);
const AUTH = { tenantId: "org1", scopes: ["agent:run"], keyId: "key1" };

const fakeDeps: AgentToolDeps = {
  runVisibilityCheck: async () => [{ engine: "chatgpt", success: true, brand_mentioned: true }],
  generateDraft: async () => ({ content: "draft", note: "n" }),
  verifyClaim: async () => ({
    claimId: "c1",
    method: "deterministic",
    verdict: "verified",
    score: 0.92,
    reasoning: "",
    provenance: { inputsHash: "x", ts: "2026-01-01T00:00:00.000Z" },
    signature: "s",
  }),
  assertTrustAbove: async () => {},
};

// gateDeps uses the REAL Phase 2 trust gate (assertTrustAbove) so the trust
// blocking behavior is exercised end-to-end, with everything else faked.
const gateDeps: AgentToolDeps = { ...fakeDeps, assertTrustAbove };

// fakeActionDeps: no-op post-approval tools so the HITL advance tests stay
// off the network / real DB. Each returns a deterministic id for assertions.
const fakeActionDeps: AgentActionDeps = {
  publishKnowledge: async () => ({ contentItemId: "ci_pub" }),
  deprecateKnowledge: async () => ({ contentItemId: "ci_dep" }),
  sendWebhook: async () => {},
};

describe("agent — planner (pure)", () => {
  it("always starts with discover", () => {
    expect(planSteps("improve visibility for our brand")[0].kind).toBe("discover");
  });

  it("full improvement goal yields discover→check→analyze→draft→publish→verify", () => {
    const kinds = planSteps("improve visibility").map((s) => s.kind);
    expect(kinds).toEqual(["discover", "check", "analyze", "draft", "publish", "verify"]);
  });

  it("verify intent is a short discover→verify plan (no publish)", () => {
    const kinds = planSteps("verify this claim").map((s) => s.kind);
    expect(kinds).toEqual(["discover", "verify"]);
  });

  it("draft-only intent has no publish step", () => {
    const kinds = planSteps("draft content").map((s) => s.kind);
    expect(kinds).toContain("draft");
    expect(kinds).not.toContain("publish");
  });

  it("external_send only appears with outreach intent", () => {
    expect(planSteps("run an outreach campaign").map((s) => s.kind)).toContain("external_send");
    expect(planSteps("improve visibility").map((s) => s.kind)).not.toContain("external_send");
  });
});

describe("agent — createAgentTask", () => {
  let mock = createMockSupabase();
  beforeEach(() => {
    mock = createMockSupabase();
  });

  it("404 when brand missing", async () => {
    const goal: AgentGoal = { goal: "improve visibility", brandId: "brand1" };
    await expect(createAgentTask(goal, AUTH, mock.client)).rejects.toMatchObject({
      status: 404,
      code: "brand_not_found",
    });
  });

  it("403 when brand belongs to a different tenant", async () => {
    mock.tables["brands"] = [{ id: "brand1", org_id: "OTHER" }];
    const goal: AgentGoal = { goal: "improve visibility", brandId: "brand1" };
    await expect(createAgentTask(goal, AUTH, mock.client)).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("creates a task with an inspectable plan scoped to the tenant", async () => {
    mock.tables["brands"] = [{ id: "brand1", org_id: "org1" }];
    const goal: AgentGoal = { goal: "improve visibility", brandId: "brand1" };
    const { taskId, plan } = await createAgentTask(goal, AUTH, mock.client);
    expect(taskId).toBeTruthy();
    expect(plan[0].kind).toBe("discover");
    const rows = mock.tables["agent_tasks"];
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe("org1");
    expect(rows[0].brand_id).toBe("brand1");
    expect(rows[0].state).toBe("planning");
  });
});

describe("agent — executeStep reads (discover / analyze)", () => {
  let mock = createMockSupabase();
  beforeEach(() => {
    mock = createMockSupabase();
    mock.tables["agent_tasks"] = [
      { id: "task1", tenant_id: "org1", brand_id: "brand1", state: "executing", plan: [] },
    ];
  });

  it("discover lists the brand's prompts", async () => {
    mock.tables["prompts"] = [{ id: "p1", brand_id: "brand1", question: "q", language: "en" }];
    const step: AgentStep = { id: "discover_0", kind: "discover", input: {}, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    const res = await executeStep("task1", step, mock.client, fakeDeps);
    expect(res.output.prompts).toHaveLength(1);
    expect(res.state).toBe("done"); // only step -> task done
  });

  it("analyze lists the brand's visibility runs", async () => {
    mock.tables["visibility_runs"] = [{ id: "r1", brand_id: "brand1" }];
    const step: AgentStep = { id: "analyze_2", kind: "analyze", input: {}, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    const res = await executeStep("task1", step, mock.client, fakeDeps);
    expect(res.output.runs).toHaveLength(1);
  });
});

describe("agent — verify step enforces the trust gate", () => {
  let mock = createMockSupabase();
  beforeEach(() => {
    mock = createMockSupabase();
    vi.stubEnv("TRUST_SIGNING_KEY", SIGNING_KEY);
    mock.tables["agent_tasks"] = [
      { id: "task1", tenant_id: "org1", brand_id: "brand1", state: "executing", plan: [] },
    ];
  });
  afterEach(() => vi.unstubAllEnvs());

  it("allows when trust record is verified above threshold", async () => {
    mock.tables["trust_records"] = [{ claim_id: "c1", score: 0.95, verdict: "verified" }];
    const step: AgentStep = { id: "verify_1", kind: "verify", input: { claimId: "c1", trustThreshold: 0.9 }, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    const res = await executeStep("task1", step, mock.client, fakeDeps);
    expect(res.output.verified).toBe(true);
    expect(res.state).toBe("done");
  });

  it("blocks (422 trust_below_threshold) when trust is below threshold", async () => {
    mock.tables["trust_records"] = [{ claim_id: "c1", score: 0.5, verdict: "verified" }];
    const step: AgentStep = { id: "verify_1", kind: "verify", input: { claimId: "c1", trustThreshold: 0.9 }, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    await expect(executeStep("task1", step, mock.client, gateDeps)).rejects.toMatchObject({
      status: 422,
      code: "trust_below_threshold",
    });
    // task marked failed, not done
    expect(mock.tables["agent_tasks"][0].state).toBe("failed");
  });

  it("verifies a fresh claim via real verifyClaim then gates on it", async () => {
    const step: AgentStep = {
      id: "verify_1",
      kind: "verify",
      input: { claim: "Our price is ₹499", evidenceRefs: ["evidence: Our price is ₹499"], trustThreshold: 0.9 },
      status: "pending",
    };
    mock.tables["agent_tasks"][0].plan = [step];
    const res = await executeStep("task1", step, mock.client, {
      ...fakeDeps,
      verifyClaim: (input, sb) => verifyClaim(input, sb ?? mock.client),
      assertTrustAbove: (claimId, t, sb) => assertTrustAbove(claimId, t, sb ?? mock.client),
    });
    expect(res.output.verified).toBe(true);
    expect(mock.tables["trust_records"]).toHaveLength(1);
  });
});

describe("agent — governance gating (publish / external_send)", () => {
  let mock = createMockSupabase();
  beforeEach(() => {
    mock = createMockSupabase();
    vi.stubEnv("TRUST_SIGNING_KEY", SIGNING_KEY);
    mock.tables["agent_tasks"] = [
      { id: "task1", tenant_id: "org1", brand_id: "brand1", state: "executing", plan: [] },
    ];
  });
  afterEach(() => vi.unstubAllEnvs());

  it("publish above trust creates an approval request and pauses (awaiting_approval)", async () => {
    mock.tables["trust_records"] = [{ claim_id: "c1", score: 0.95, verdict: "verified" }];
    const step: AgentStep = { id: "publish_4", kind: "publish", input: { claimId: "c1", trustThreshold: 0.9 }, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    const res = await executeStep("task1", step, mock.client, gateDeps);
    expect(res.state).toBe("awaiting_approval");
    expect(res.approvalRequired).toBe("publish");
    expect(mock.tables["approval_requests"]).toHaveLength(1);
    expect(mock.tables["approval_requests"][0].status).toBe("pending");
    expect(mock.tables["agent_tasks"][0].state).toBe("awaiting_approval");
  });

  it("publish below trust is REJECTED before any approval request is created", async () => {
    mock.tables["trust_records"] = [{ claim_id: "c1", score: 0.5, verdict: "verified" }];
    const step: AgentStep = { id: "publish_4", kind: "publish", input: { claimId: "c1", trustThreshold: 0.9 }, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    await expect(executeStep("task1", step, mock.client, gateDeps)).rejects.toMatchObject({
      status: 422,
      code: "trust_below_threshold",
    });
    expect(mock.tables["approval_requests"] ?? []).toHaveLength(0);
  });

  it("external_send gates identically to publish", async () => {
    mock.tables["trust_records"] = [{ claim_id: "c1", score: 0.95, verdict: "verified" }];
    const step: AgentStep = { id: "external_send_5", kind: "external_send", input: { claimId: "c1", trustThreshold: 0.9 }, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    const res = await executeStep("task1", step, mock.client, gateDeps);
    expect(res.approvalRequired).toBe("external_send");
    expect(mock.tables["approval_requests"][0].action).toBe("external_send");
  });

  it("publish without a claimId is rejected (cannot trust-gate)", async () => {
    const step: AgentStep = { id: "publish_4", kind: "publish", input: {}, status: "pending" };
    mock.tables["agent_tasks"][0].plan = [step];
    await expect(executeStep("task1", step, mock.client, gateDeps)).rejects.toMatchObject({
      status: 400,
      code: "action_requires_claim",
    });
  });
});

describe("agent — approveStep advances the task", () => {
  let mock = createMockSupabase();
  beforeEach(() => {
    mock = createMockSupabase();
    mock.tables["trust_records"] = [{ claim_id: "c1", score: 0.95, verdict: "verified" }];
    // publish is step 0 (awaiting), verify is step 1 (pending) -> approval should advance to verify
    mock.tables["agent_tasks"] = [
      {
        id: "task1",
        tenant_id: "org1",
        brand_id: "brand1",
        state: "awaiting_approval",
        plan: [
          { id: "publish_0", kind: "publish", input: { claimId: "c1" }, status: "awaiting_approval", approvalAction: "publish" },
          { id: "verify_1", kind: "verify", input: { claimId: "c1" }, status: "pending" },
        ],
      },
    ];
    mock.tables["approval_requests"] = [
      { id: "ar1", task_id: "task1", step_id: "publish_0", action: "publish", status: "pending" },
    ];
    mock.tables["jobs"] = [];
  });

  it("approving a pending publish marks it approved and enqueues the next step", async () => {
    await approveStep("task1", "publish_0", AUTH, "approved", mock.client, fakeActionDeps);
    expect(mock.tables["approval_requests"][0].status).toBe("approved");
    expect(mock.tables["approval_requests"][0].decided_by).toBe("key1");
    // next step (verify) enqueued as an agent_step job
    const next = (mock.tables["jobs"] ?? []).find((j: any) => j.type === "agent_step");
    expect(next).toBeTruthy();
    expect((next as any).payload.step.kind).toBe("verify");
  });

  it("rejecting a pending publish fails the task", async () => {
    await approveStep("task1", "publish_0", AUTH, "rejected", mock.client, fakeActionDeps);
    expect(mock.tables["approval_requests"][0].status).toBe("rejected");
    expect(mock.tables["agent_tasks"][0].state).toBe("failed");
    expect((mock.tables["jobs"] ?? []).find((j: any) => j.type === "agent_step")).toBeUndefined();
  });

  it("403 when approver is from a different tenant", async () => {
    await expect(
      approveStep("task1", "publish_0", { tenantId: "OTHER", scopes: ["agent:run"], keyId: "k" }, "approved", mock.client, fakeActionDeps)
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
});

describe("agent — post-approval actions fire the real tools", () => {
  let mock = createMockSupabase();
  const baseTask = (): any => ({
    id: "task1",
    tenant_id: "org1",
    brand_id: "brand1",
    state: "awaiting_approval",
    plan: [
      { id: "act_0", kind: "publish", input: { claimId: "c1" }, status: "awaiting_approval", approvalAction: "publish" },
      { id: "verify_1", kind: "verify", input: { claimId: "c1" }, status: "pending" },
    ],
  });
  const seedApproval = (action: string) => {
    mock.tables["agent_tasks"][0].plan[0].kind = action;
    mock.tables["agent_tasks"][0].plan[0].approvalAction = action;
    mock.tables["approval_requests"] = [
      { id: "ar1", task_id: "task1", step_id: "act_0", action, status: "pending" },
    ];
  };

  beforeEach(() => {
    mock = createMockSupabase();
    mock.tables["agent_tasks"] = [baseTask()];
    mock.tables["trust_records"] = [{ claim_id: "c1", claim: "Our price is ₹499", score: 0.95, verdict: "verified" }];
    mock.tables["content_items"] = [];
    mock.tables["jobs"] = [];
    seedApproval("publish");
  });

  it("publish: real publishKnowledge inserts a published content_items row linked to the claim", async () => {
    await approveStep("task1", "act_0", AUTH, "approved", mock.client);
    const items = mock.tables["content_items"];
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("published");
    expect(items[0].claim_id).toBe("c1");
    expect(items[0].brand_id).toBe("brand1");
    expect(items[0].title).toContain("Our price is ₹499");
    // step output records the published item id + decision provenance
    expect(mock.tables["agent_tasks"][0].plan[0].output.contentItemId).toBeTruthy();
    // plan still advances to the next step
    expect(mock.tables["jobs"].find((j: any) => j.type === "agent_step")).toBeTruthy();
  });

  it("deprecate: real deprecateKnowledge flips the claim's published item back to draft", async () => {
    mock.tables["content_items"] = [{ id: "ci1", brand_id: "brand1", claim_id: "c1", status: "published" }];
    seedApproval("deprecate");
    await approveStep("task1", "act_0", AUTH, "approved", mock.client);
    expect(mock.tables["content_items"][0].status).toBe("draft");
    expect(mock.tables["content_items"][0].approved_at).toBeNull();
    expect(mock.tables["agent_tasks"][0].plan[0].output.contentItemId).toBe("ci1");
  });

  it("external_send: real sendWebhook (deliverEvent) runs without throwing and advances", async () => {
    seedApproval("external_send");
    await approveStep("task1", "act_0", AUTH, "approved", mock.client);
    // no subscriptions => deliverEvent is a no-op, but the step must still complete + advance
    expect(mock.tables["agent_tasks"][0].plan[0].status).toBe("done");
    expect(mock.tables["jobs"].find((j: any) => j.type === "agent_step")).toBeTruthy();
  });

  it("rejecting never fires any action and fails the task", async () => {
    let fired = "";
    const spyDeps: AgentActionDeps = {
      publishKnowledge: async () => { fired = "publish"; return { contentItemId: "x" }; },
      deprecateKnowledge: async () => { fired = "deprecate"; return { contentItemId: null }; },
      sendWebhook: async () => { fired = "send"; },
    };
    await approveStep("task1", "act_0", AUTH, "rejected", mock.client, spyDeps);
    expect(fired).toBe("");
    expect(mock.tables["agent_tasks"][0].state).toBe("failed");
    expect(mock.tables["jobs"].find((j: any) => j.type === "agent_step")).toBeUndefined();
  });

  it("a failing action marks the step failed instead of done", async () => {
    const boomDeps: AgentActionDeps = {
      ...fakeActionDeps,
      publishKnowledge: async () => { throw new Error("db down"); },
    };
    await expect(
      approveStep("task1", "act_0", AUTH, "approved", mock.client, boomDeps)
    ).rejects.toThrow("db down");
    expect(mock.tables["agent_tasks"][0].state).toBe("failed");
    expect(mock.tables["agent_tasks"][0].plan[0].status).toBe("failed");
  });
});
