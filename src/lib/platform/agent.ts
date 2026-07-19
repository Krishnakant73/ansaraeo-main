import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "./queue";
import { ApiError } from "./responses";
import type { ApiAuth } from "./auth";
import { verifyClaim, assertTrustAbove, type ClaimInput, type VerificationResult } from "./trust";
import { runVisibilityCheck } from "@/lib/visibility-engine";
import { deliverEvent } from "./webhooks";

// ============================================================
// Phase 3 — AI Discovery Agent Runtime.
//
// The agent is an AUTONOMOUS, TOOL-USING OPERATOR that plans and executes
// discovery work on a tenant's behalf. Safety model (docs/PHASE3_AGENT_RUNTIME):
//   1. Tools are the platform's own services (the agent is a scoped operator,
//      never a DB superuser). State-changing/external actions are ALWAYS gated
//      by Governance approval (policy default).
//   2. Every publish is pre-checked by assertTrustAbove (Phase 2) — low-trust
//      claims can never reach approval, let alone publication.
//   3. Plans are inspectable + replayable (stored on agent_tasks.plan).
//
// Each step is a durable `agent_step` job (open JobType union, no schema change).
// Depends only on Phase 1 seams (authenticateApiRequest, enqueueJob, ApiError)
// + Phase 2 (verifyClaim, assertTrustAbove). See docs/PHASE3_AGENT_RUNTIME.md.
// ============================================================

export type AgentTaskState =
  | "planning"
  | "executing"
  | "awaiting_approval"
  | "done"
  | "failed";

export type AgentAction = "publish" | "deprecate" | "external_send";

export type StepKind =
  | "discover"
  | "check"
  | "analyze"
  | "draft"
  | "verify"
  | "publish"
  | "deprecate"
  | "external_send";

export type StepStatus = "pending" | "running" | "awaiting_approval" | "done" | "failed";

export interface AgentStep {
  id: string;
  kind: StepKind;
  input: Record<string, unknown>;
  status: StepStatus;
  output?: Record<string, unknown>;
  approvalAction?: AgentAction; // set when the step is blocked on approval
}

export interface AgentGoal {
  goal: string;
  brandId: string;
  policyId?: string;
  guardrails?: {
    maxExternalSends?: number;
    requireApproval?: AgentAction[];
  };
}

export interface StepResult {
  stepId: string;
  state: AgentTaskState; // resulting task state
  output: Record<string, unknown>;
  approvalRequired?: AgentAction;
}

/** Injectable tool surface — default implementations delegate to platform
 * services; tests pass fakes so heavy engines (LLM visibility checks) are
 * never invoked. This is the boundary that keeps the agent a scoped operator. */
export interface AgentToolDeps {
  runVisibilityCheck: (promptId: string) => Promise<unknown[]>;
  generateDraft: (input: { brandId: string; promptId?: string }) => Promise<{ content: string; note?: string }>;
  verifyClaim: (input: ClaimInput, sb?: SupabaseClient) => Promise<VerificationResult>;
  assertTrustAbove: (claimId: string, threshold: number, sb?: SupabaseClient) => Promise<void>;
}

const REAL_DEPS: AgentToolDeps = {
  runVisibilityCheck: (promptId) => runVisibilityCheck(promptId),
  generateDraft: defaultGenerateDraft,
  verifyClaim,
  assertTrustAbove,
};

// ----------------------------------------------------------------
// Post-approval actions — the REAL fan-out the trust gate + HITL protect.
// These run ONLY after a human-in-the-loop approval, and only for a claim
// that already passed assertTrustAbove. They are injected (fakeable) so tests
// never hit the network / real DB; REAL_ACTION_DEPS wires them to platform
// services so the approved effect is real, traceable, and reversible.
//   publish     -> content_items row (status: published), linked to claim_id
//   deprecate   -> reversible unpublish of the claim's published item
//   external_send-> signed webhook delivery via deliverEvent (Phase 1 infra)
// ----------------------------------------------------------------

export interface AgentActionInput {
  taskId: string;
  stepId: string;
  claimId: string;
  brandId: string;
  tenantId: string;
  promptId?: string;
}

export interface AgentActionDeps {
  publishKnowledge: (input: AgentActionInput, sb?: SupabaseClient) => Promise<{ contentItemId: string }>;
  deprecateKnowledge: (input: AgentActionInput, sb?: SupabaseClient) => Promise<{ contentItemId: string | null }>;
  sendWebhook: (input: AgentActionInput, sb?: SupabaseClient) => Promise<void>;
}

export async function publishKnowledge(
  input: AgentActionInput,
  sb: SupabaseClient = createServiceClient()
): Promise<{ contentItemId: string }> {
  // Pull the verified claim text so the published item IS the trusted fact,
  // never invented prose (HONESTY DESIGN — we publish a verified claim,
  // not an auto-authored article).
  const { data: rec } = await sb
    .from("trust_records")
    .select("claim")
    .eq("claim_id", input.claimId)
    .maybeSingle();
  const claimText = ((rec as { claim?: string } | null)?.claim ?? input.claimId).toString();
  const { data, error } = await sb
    .from("content_items")
    .insert({
      brand_id: input.brandId,
      prompt_id: input.promptId ?? null,
      claim_id: input.claimId,
      title: `Verified claim — ${claimText.slice(0, 120)}`,
      content_markdown: claimText,
      status: "published",
      target_engine: null,
      eeat_checklist: { has_named_author: false, has_original_data_point: false, has_first_hand_detail: false },
      approved_at: new Date().toISOString(),
      approved_by: null, // approval came from an API key; recorded on agent_tasks.plan + approval_requests.decided_by
    })
    .select("id")
    .single();
  if (error) throw new ApiError(500, "publish_failed", error.message);
  return { contentItemId: (data as { id: string }).id };
}

export async function deprecateKnowledge(
  input: AgentActionInput,
  sb: SupabaseClient = createServiceClient()
): Promise<{ contentItemId: string | null }> {
  // Reversible unpublish: take the claim's published item back to draft.
  const { data, error } = await sb
    .from("content_items")
    .update({ status: "draft", approved_at: null, approved_by: null })
    .eq("brand_id", input.brandId)
    .eq("claim_id", input.claimId)
    .eq("status", "published")
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError(500, "deprecate_failed", error.message);
  return { contentItemId: ((data as { id?: string } | null)?.id) ?? null };
}

export async function sendWebhook(
  input: AgentActionInput,
  sb: SupabaseClient = createServiceClient()
): Promise<void> {
  await deliverEvent(
    {
      type: "agent.external_send",
      tenantId: input.tenantId,
      data: { taskId: input.taskId, stepId: input.stepId, claimId: input.claimId, brandId: input.brandId },
    },
    sb
  );
}

export const REAL_ACTION_DEPS: AgentActionDeps = {
  publishKnowledge,
  deprecateKnowledge,
  sendWebhook,
};

// ----------------------------------------------------------------
// Planner (pure, deterministic, inspectable — no black-box LLM planning)
// ----------------------------------------------------------------

export function planSteps(goal: string, guardrails?: AgentGoal["guardrails"]): AgentStep[] {
  const g = goal.toLowerCase();
  const steps: AgentStep[] = [];
  const push = (kind: StepKind, input: Record<string, unknown> = {}) =>
    steps.push({ id: `${kind}_${steps.length}`, kind, input, status: "pending" });

  // discovery is always the entry point
  push("discover", {});

  // verify/trust intent: just verify a claim, nothing else
  if (g.includes("verify") || g.includes("trust")) {
    push("verify", {});
    return steps;
  }

  push("check", {});
  push("analyze", {});

  if (g.includes("draft") || g.includes("content") || g.includes("improve") || g.includes("visibility")) {
    push("draft", {});
  }

  // State-changing actions are gated by Governance (policy default). A publish
  // is always followed by a verify of the published claim's trust.
  const requireApproval = guardrails?.requireApproval ?? ["publish", "deprecate", "external_send"];
  const willPublish =
    requireApproval.includes("publish") &&
    (g.includes("publish") || g.includes("improve") || g.includes("visibility"));
  if (willPublish) {
    push("publish", { trustThreshold: 0.9 });
    push("verify", {});
  }
  if (requireApproval.includes("external_send") && g.includes("outreach")) {
    push("external_send", { trustThreshold: 0.9 });
  }

  return steps;
}

// ----------------------------------------------------------------
// Task lifecycle
// ----------------------------------------------------------------

export async function createAgentTask(
  goal: AgentGoal,
  auth: ApiAuth,
  sb: SupabaseClient = createServiceClient()
): Promise<{ taskId: string; plan: AgentStep[] }> {
  const { data: brand, error } = await sb
    .from("brands")
    .select("org_id")
    .eq("id", goal.brandId)
    .maybeSingle();
  if (error) throw new ApiError(500, "brand_lookup_failed", error.message);
  if (!brand) throw new ApiError(404, "brand_not_found", "Brand not found");
  if ((brand as { org_id?: string }).org_id !== auth.tenantId) {
    throw new ApiError(403, "forbidden", "Brand does not belong to this tenant");
  }

  const plan = planSteps(goal.goal, goal.guardrails);
  const { data, error: insErr } = await sb
    .from("agent_tasks")
    .insert({
      tenant_id: auth.tenantId,
      brand_id: goal.brandId,
      policy_id: goal.policyId ?? null,
      goal: goal.goal,
      state: "planning",
      plan,
      guardrails: goal.guardrails ?? null,
    })
    .select("id")
    .single();
  if (insErr) throw new ApiError(500, "task_create_failed", insErr.message);
  return { taskId: (data as { id: string }).id, plan };
}

interface TaskLoad {
  row: Record<string, unknown>;
  plan: AgentStep[];
  state: AgentTaskState;
  brandId: string;
}

async function getTask(taskId: string, sb: SupabaseClient): Promise<TaskLoad> {
  const { data, error } = await sb
    .from("agent_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new ApiError(500, "task_lookup_failed", error.message);
  if (!data) throw new ApiError(404, "task_not_found", "Agent task not found");
  return {
    row: data as Record<string, unknown>,
    plan: ((data as { plan?: AgentStep[] }).plan ?? []) as AgentStep[],
    state: (data as { state: AgentTaskState }).state,
    brandId: (data as { brand_id: string }).brand_id,
  };
}

async function persistPlan(sb: SupabaseClient, taskId: string, plan: AgentStep[]): Promise<void> {
  const { error } = await sb.from("agent_tasks").update({ plan }).eq("id", taskId);
  if (error) throw new ApiError(500, "plan_persist_failed", error.message);
}

async function firstPromptId(sb: SupabaseClient, brandId: string): Promise<string | undefined> {
  const { data } = await sb
    .from("prompts")
    .select("id")
    .eq("brand_id", brandId)
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? undefined;
}

/** Enqueues the next `pending` step as a durable agent_step job, or marks the
 * task done if none remain. Idempotent-ish: only ever enqueues a pending step. */
export async function enqueueNextPendingStep(
  taskId: string,
  sb: SupabaseClient = createServiceClient()
): Promise<{ enqueued: boolean; taskId: string }> {
  const { row, plan, state } = await getTask(taskId, sb);
  if (state === "awaiting_approval" || state === "failed" || state === "done") {
    return { enqueued: false, taskId };
  }
  const next = plan.find((s) => s.status === "pending");
  if (!next) {
    await sb.from("agent_tasks").update({ state: "done" }).eq("id", taskId);
    return { enqueued: false, taskId };
  }
  await enqueueJob(
    "agent_step",
    { taskId, step: next },
    { tenantId: row.tenant_id as string },
    sb
  );
  await sb.from("agent_tasks").update({ state: "executing" }).eq("id", taskId);
  return { enqueued: true, taskId };
}

/** Start a freshly-created task: enqueues its first step. */
export async function startTask(taskId: string, sb: SupabaseClient = createServiceClient()) {
  return enqueueNextPendingStep(taskId, sb);
}

// ----------------------------------------------------------------
// Executor
// ----------------------------------------------------------------

async function governanceGatedStep(
  taskId: string,
  step: AgentStep,
  action: AgentAction,
  sb: SupabaseClient,
  tools: AgentToolDeps
): Promise<StepResult> {
  const claimId = step.input.claimId as string | undefined;
  const threshold = Number(step.input.trustThreshold ?? 0.9);

  // Safety invariant: state-changing actions require a claim to trust-gate, and
  // low-trust claims are REJECTED here — they never reach human approval.
  if (!claimId) {
    throw new ApiError(400, "action_requires_claim", `${action} requires a claimId to trust-gate`);
  }
  await tools.assertTrustAbove(claimId, threshold, sb);

  // Human-in-the-loop: open an approval request; the step pauses until decided.
  const { error } = await sb.from("approval_requests").insert({
    task_id: taskId,
    step_id: step.id,
    action,
    status: "pending",
  });
  if (error) throw new ApiError(500, "approval_create_failed", error.message);

  return {
    stepId: step.id,
    state: "awaiting_approval",
    output: { action, claimId, status: "pending_approval" },
    approvalRequired: action,
  };
}

function defaultGenerateDraft(input: { brandId: string; promptId?: string }): Promise<{ content: string; note: string }> {
  // HONESTY DESIGN: a draft is always a review-ready skeleton with [ADD …]
  // placeholders for owner-only facts — never auto-filled specifics. Production
  // wiring can swap in the full content engine; the agent surfaces a draft, not
  // a published claim.
  return Promise.resolve({
    content:
      `DRAFT — review before publishing.\n\n` +
      `# Brand response${input.promptId ? ` (prompt ${input.promptId})` : ""}\n\n` +
      `[ADD: brand positioning statement]\n` +
      `[ADD: evidence-backed claim]\n` +
      `[ADD: citation URLs]\n`,
    note: "Auto-generated skeleton; replace [ADD …] placeholders with verified facts before publish.",
  });
}

export async function executeStep(
  taskId: string,
  step: AgentStep,
  sb: SupabaseClient = createServiceClient(),
  deps: AgentToolDeps = REAL_DEPS
): Promise<StepResult> {
  const { row, plan, brandId } = await getTask(taskId, sb);
  const tenantId = row.tenant_id as string;
  const planStep = plan.find((s) => s.id === step.id) ?? step;
  planStep.status = "running";
  await persistPlan(sb, taskId, plan);

  let result: StepResult;
  try {
    switch (step.kind) {
      case "discover": {
        const { data, error } = await sb
          .from("prompts")
          .select("id, question, language")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw new ApiError(500, "discover_failed", error.message);
        result = { stepId: step.id, state: "executing", output: { prompts: data ?? [] } };
        break;
      }
      case "check": {
        const promptId =
          (step.input.promptId as string | undefined) ?? (await firstPromptId(sb, brandId));
        if (!promptId) throw new ApiError(400, "no_prompt", "No prompt available for brand");
        const outcomes = await deps.runVisibilityCheck(promptId);
        result = { stepId: step.id, state: "executing", output: { promptId, outcomes } };
        break;
      }
      case "analyze": {
        const { data, error } = await sb
          .from("visibility_runs")
          .select("*")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw new ApiError(500, "analyze_failed", error.message);
        result = { stepId: step.id, state: "executing", output: { runs: data ?? [] } };
        break;
      }
      case "draft": {
        const promptId =
          (step.input.promptId as string | undefined) ?? (await firstPromptId(sb, brandId));
        const draft = await deps.generateDraft({ brandId, promptId });
        result = { stepId: step.id, state: "executing", output: { draft } };
        break;
      }
      case "verify": {
        let claimId = step.input.claimId as string | undefined;
        const claim = step.input.claim as string | undefined;
        const evidenceRefs = (step.input.evidenceRefs as string[] | undefined) ?? [];
        if (!claimId && !claim) {
          // inherit the claim from a preceding gated step's output
          const prev = [...plan].reverse().find((s) => s.output && (s.output as { claimId?: string }).claimId);
          if (prev) claimId = (prev.output as { claimId?: string }).claimId;
        }
        if (claim) {
          const vr = await deps.verifyClaim({ claim, evidenceRefs, tenantId }, sb);
          claimId = vr.claimId;
        }
        if (!claimId) throw new ApiError(400, "no_claim", "verify step needs claimId or claim+evidenceRefs");
        const threshold = Number(step.input.trustThreshold ?? 0.9);
        await deps.assertTrustAbove(claimId, threshold, sb); // throws 422 if below
        result = { stepId: step.id, state: "executing", output: { verified: true, claimId, threshold } };
        break;
      }
      case "publish":
      case "deprecate":
      case "external_send":
        result = await governanceGatedStep(taskId, step, step.kind as AgentAction, sb, deps);
        break;
      default:
        throw new ApiError(400, "unknown_step_kind", `Step kind ${step.kind} not supported`);
    }
  } catch (e) {
    planStep.status = "failed";
    await persistPlan(sb, taskId, plan);
    await sb.from("agent_tasks").update({ state: "failed" }).eq("id", taskId);
    throw e;
  }

  // Approval-gated step: pause, do not advance.
  if (result.state === "awaiting_approval") {
    planStep.status = "awaiting_approval";
    planStep.output = result.output;
    planStep.approvalAction = result.approvalRequired;
    await persistPlan(sb, taskId, plan);
    await sb.from("agent_tasks").update({ state: "awaiting_approval" }).eq("id", taskId);
    return result;
  }

  // Success: mark done and advance to the next step.
  planStep.status = "done";
  planStep.output = result.output;
  await persistPlan(sb, taskId, plan);
  const adv = await enqueueNextPendingStep(taskId, sb);
  return { ...result, state: adv.enqueued ? "executing" : "done" };
}

// ----------------------------------------------------------------
// Human-in-the-loop approval
// ----------------------------------------------------------------

export async function approveStep(
  taskId: string,
  stepId: string,
  approver: ApiAuth,
  decision: "approved" | "rejected" = "approved",
  sb: SupabaseClient = createServiceClient(),
  deps: AgentActionDeps = REAL_ACTION_DEPS
): Promise<void> {
  const { row, plan } = await getTask(taskId, sb);
  if (row.tenant_id !== approver.tenantId) {
    throw new ApiError(403, "forbidden", "Task does not belong to this tenant");
  }
  const step = plan.find((s) => s.id === stepId);
  if (!step) throw new ApiError(404, "step_not_found", "Step not found");
  if (step.status !== "awaiting_approval") {
    throw new ApiError(409, "step_not_awaiting", "Step is not awaiting approval");
  }

  const { data: req } = await sb
    .from("approval_requests")
    .select("*")
    .eq("task_id", taskId)
    .eq("step_id", stepId)
    .maybeSingle();
  if (!req) throw new ApiError(404, "approval_not_found", "No approval request for step");

  await sb
    .from("approval_requests")
    .update({
      status: decision,
      decided_by: approver.keyId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", (req as { id: string }).id);

  if (decision === "rejected") {
    step.status = "failed";
    await sb.from("agent_tasks").update({ state: "failed", plan }).eq("id", taskId);
    return;
  }

  // Approved: the action is authorized. Fire the real post-approval tool
  // (publishKnowledge / deprecateKnowledge / sendWebhook). The trust gate +
  // human approval have already passed, so this is the ONLY place a
  // state-changing / external effect may occur. If the action itself fails,
  // the step is marked failed rather than left "done".
  const action = step.approvalAction;
  const claimId = step.input.claimId as string;
  const brandId = row.brand_id as string;
  const tenantId = row.tenant_id as string;
  const promptId = step.input.promptId as string | undefined;

  let actionResult: Record<string, unknown> = {};
  try {
    if (action === "publish") {
      const r = await deps.publishKnowledge({ taskId, stepId, claimId, brandId, tenantId, promptId }, sb);
      actionResult = { contentItemId: r.contentItemId };
    } else if (action === "deprecate") {
      const r = await deps.deprecateKnowledge({ taskId, stepId, claimId, brandId, tenantId }, sb);
      actionResult = { contentItemId: r.contentItemId };
    } else if (action === "external_send") {
      await deps.sendWebhook({ taskId, stepId, claimId, brandId, tenantId }, sb);
    }
  } catch (e) {
    step.status = "failed";
    await sb.from("agent_tasks").update({ state: "failed", plan }).eq("id", taskId);
    throw e;
  }

  step.status = "done";
  step.output = { ...(step.output ?? {}), approvedBy: approver.keyId, approvedAt: new Date().toISOString(), ...actionResult };
  // Leave the awaiting-approval state so enqueueNextPendingStep can advance.
  await sb.from("agent_tasks").update({ plan, state: "executing" }).eq("id", taskId);

  await enqueueNextPendingStep(taskId, sb);
}
