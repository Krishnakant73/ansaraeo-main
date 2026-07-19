// ============================================================
// workflow.ts — Workflow Operating System: CRUD + orchestration.
//
// User-facing: uses the cookie client (createClient) so every query respects
// RLS via the org_members -> brands chain. Service-client callers (cron /
// automations) may pass a service client instead.
//
// Status changes are guarded by the pure state machine in ./workflow-state so
// the DB can never hold an illegal transition.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canTransitionTask,
  canTransitionMission,
  decomposeOpportunity,
  type MissionStatus,
  type TaskStatus,
  type TaskType,
} from "./workflow-state";

async function db(supabase?: SupabaseClient): Promise<SupabaseClient> {
  return supabase ?? (await createClient());
}

// ---------- Missions ----------
export type MissionRow = {
  id: string;
  brand_id: string;
  title: string;
  objective: string | null;
  status: MissionStatus;
  priority: number;
  owner_id: string | null;
  created_by: string | null;
  linked_campaign_id: string | null;
  linked_sprint_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export async function listMissions(
  brandId: string,
  opts: { status?: MissionStatus; limit?: number } = {},
  supabase?: SupabaseClient,
): Promise<MissionRow[]> {
  const sb = await db(supabase);
  let q = sb.from("missions").select("*").eq("brand_id", brandId).order("priority", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MissionRow[];
}

export async function createMission(
  input: {
    brand_id: string;
    title: string;
    objective?: string;
    priority?: number;
    owner_id?: string | null;
    linked_campaign_id?: string | null;
    linked_sprint_id?: string | null;
    due_date?: string | null;
  },
  supabase?: SupabaseClient,
): Promise<MissionRow> {
  const sb = await db(supabase);
  const { data, error } = await sb
    .from("missions")
    .insert({
      brand_id: input.brand_id,
      title: input.title,
      objective: input.objective ?? null,
      priority: input.priority ?? 3,
      owner_id: input.owner_id ?? null,
      linked_campaign_id: input.linked_campaign_id ?? null,
      linked_sprint_id: input.linked_sprint_id ?? null,
      due_date: input.due_date ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as MissionRow;
}

export async function setMissionStatus(
  missionId: string,
  status: MissionStatus,
  brandId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const sb = await db(supabase);
  const { data: current, error: readErr } = await sb
    .from("missions")
    .select("status")
    .eq("id", missionId)
    .eq("brand_id", brandId)
    .single();
  if (readErr) throw new Error(readErr.message);
  const from = (current as { status: MissionStatus }).status;
  if (!canTransitionMission(from, status)) {
    throw new Error(`Illegal mission transition: ${from} -> ${status}`);
  }
  const { error } = await sb
    .from("missions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("brand_id", brandId);
  if (error) throw new Error(error.message);
}

// ---------- Tasks ----------
export type TaskRow = {
  id: string;
  mission_id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  assignee_id: string | null;
  source_opportunity_id: string | null;
  source_automation_id: string | null;
  engine_action: Record<string, unknown>;
  verification_result: Record<string, unknown> | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listTasks(
  filter: { mission_id?: string; brand_id?: string; assignee_id?: string; status?: TaskStatus },
  supabase?: SupabaseClient,
): Promise<TaskRow[]> {
  const sb = await db(supabase);
  let q = sb.from("tasks").select("*");
  if (filter.mission_id) q = q.eq("mission_id", filter.mission_id);
  if (filter.assignee_id) q = q.eq("assignee_id", filter.assignee_id);
  if (filter.status) q = q.eq("status", filter.status);
  // brand filter resolves via mission -> brand (RLS also enforces this).
  if (filter.brand_id) {
    const { data: mIds } = await sb.from("missions").select("id").eq("brand_id", filter.brand_id);
    const ids = (mIds ?? []).map((m: { id: string }) => m.id);
    q = q.in("mission_id", ids.length ? ids : ["__none__"]);
  }
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

export async function createTask(
  input: {
    mission_id: string;
    title: string;
    type?: TaskType;
    assignee_id?: string | null;
    source_opportunity_id?: string | null;
    due_date?: string | null;
    engine_action?: Record<string, unknown>;
  },
  supabase?: SupabaseClient,
): Promise<TaskRow> {
  const sb = await db(supabase);
  const { data, error } = await sb
    .from("tasks")
    .insert({
      mission_id: input.mission_id,
      title: input.title,
      type: input.type ?? "fix",
      assignee_id: input.assignee_id ?? null,
      source_opportunity_id: input.source_opportunity_id ?? null,
      due_date: input.due_date ?? null,
      engine_action: input.engine_action ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
  brandId: string,
  supabase?: SupabaseClient,
): Promise<TaskRow | null> {
  const sb = await db(supabase);
  // Resolve brand via mission to enforce scoping + RLS.
  const { data: task, error: readErr } = await sb
    .from("tasks")
    .select("status, mission_id, type")
    .eq("id", taskId)
    .single();
  if (readErr) throw new Error(readErr.message);
  if (!task) return null;
  const { data: mission, error: mErr } = await sb
    .from("missions")
    .select("brand_id")
    .eq("id", (task as { mission_id: string }).mission_id)
    .single();
  if (mErr) throw new Error(mErr.message);
  if ((mission as { brand_id: string }).brand_id !== brandId) {
    throw new Error("Task does not belong to this brand");
  }
  const from = (task as { status: TaskStatus }).status;
  if (!canTransitionTask(from, status)) {
    throw new Error(`Illegal task transition: ${from} -> ${status}`);
  }
  // Deploy tasks cannot be completed while an approval is pending (module 9).
  if (status === "done" && (task as { type: TaskType }).type === "deploy") {
    const pending = await pendingApprovalForTask(taskId, sb);
    if (pending) throw new Error("Pending approval required before deploy");
  }
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "done") patch.completed_at = new Date().toISOString();
  if (from === "done" && status !== "done") patch.completed_at = null;
  const { data, error } = await sb.from("tasks").update(patch).eq("id", taskId).select().single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

// ---------- Opportunity Queue ----------
export type OpportunityRow = {
  id: string;
  brand_id: string;
  type: string;
  title: string;
  detail: Record<string, unknown>;
  estimated_impact: Record<string, unknown>;
  priority_score: number | null;
  status: string;
  created_at: string;
};

export async function listOpportunities(
  brandId: string,
  opts: { status?: string; limit?: number } = {},
  supabase?: SupabaseClient,
): Promise<OpportunityRow[]> {
  const sb = await db(supabase);
  let q = sb.from("opportunity_recommendations").select("*").eq("brand_id", brandId);
  if (opts.status) q = q.eq("status", opts.status);
  else q = q.eq("status", "open");
  q = q.order("priority_score", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OpportunityRow[];
}

/**
 * Accept an open opportunity: create a mission + a deterministic task sequence
 * (fix→...→verify) derived from the opportunity type, and mark the opportunity
 * acknowledged. This is the Discover -> Mission -> Task entry point.
 */
export async function acceptOpportunity(
  brandId: string,
  opportunityId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<{ missionId: string; taskIds: string[] }> {
  const sb = await db(supabase);
  const { data: opp, error: oErr } = await sb
    .from("opportunity_recommendations")
    .select("*")
    .eq("id", opportunityId)
    .eq("brand_id", brandId)
    .single();
  if (oErr) throw new Error(oErr.message);
  if (!opp) throw new Error("Opportunity not found");
  if ((opp as { status: string }).status !== "open") {
    throw new Error("Opportunity already acted on");
  }

  const mission = await createMission(
    {
      brand_id: brandId,
      title: (opp as { title: string }).title,
      objective: (opp as { title: string }).title,
      priority: Math.max(1, Math.min(5, Math.round(((opp as { priority_score: number | null }).priority_score ?? 0.5) * 5))),
      owner_id: userId,
    },
    sb,
  );

  const template = decomposeOpportunity((opp as { type: string }).type, (opp as { title: string }).title);
  const taskIds: string[] = [];
  for (const step of template) {
    const t = await createTask(
      {
        mission_id: mission.id,
        title: step.title,
        type: step.type,
        source_opportunity_id: opportunityId,
      },
      sb,
    );
    taskIds.push(t.id);
  }

  const { error: uErr } = await sb
    .from("opportunity_recommendations")
    .update({ status: "acknowledged" })
    .eq("id", opportunityId);
  if (uErr) throw new Error(uErr.message);

  return { missionId: mission.id, taskIds };
}

// ---------- Verification Loop (module 10) ----------
// Closes the Discover → Mission → Task → … → Verify loop. A `verify` task
// measures whether the shipped fix actually moved the needle: it compares the
// brand's CURRENT benchmark snapshot against the opportunity's recorded
// baseline + target (both stored in opportunity_recommendations.detail),
// persists the diff into `tasks.verification_result`, completes the task, and
// notifies pass/fail. No LLM call — it's a deterministic metric delta, which
// is exactly what "did the fix work?" means.
export type VerificationResult = {
  verified_at: string;
  metric: string | null;
  baseline: number | null;
  target: number | null;
  current: number | null;
  delta: number | null;
  passed: boolean;
  method: string;
  note?: string;
};

const SNAPSHOT_METRICS = ["mention_rate", "citation_rate", "avg_trust", "avg_visibility"] as const;

export async function verifyTask(
  taskId: string,
  brandId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<VerificationResult> {
  const sb = await db(supabase);

  const { data: task, error: tErr } = await sb
    .from("tasks")
    .select("id, mission_id, type, status, source_opportunity_id")
    .eq("id", taskId)
    .single();
  if (tErr) throw new Error(tErr.message);
  if (!task) throw new Error("Task not found");
  if ((task as { type: string }).type !== "verify") {
    throw new Error("Only 'verify' tasks can be verified");
  }

  const { data: mission, error: mErr } = await sb
    .from("missions")
    .select("brand_id")
    .eq("id", (task as { mission_id: string }).mission_id)
    .single();
  if (mErr) throw new Error(mErr.message);
  if (!mission || (mission as { brand_id: string }).brand_id !== brandId) {
    throw new Error("Task does not belong to this brand");
  }

  const oppId = (task as { source_opportunity_id: string | null }).source_opportunity_id;
  if (!oppId) throw new Error("Verification requires a linked opportunity");

  const { data: opp, error: oErr } = await sb
    .from("opportunity_recommendations")
    .select("id, type, title, detail, estimated_impact")
    .eq("id", oppId)
    .single();
  if (oErr) throw new Error(oErr.message);
  if (!opp) throw new Error("Linked opportunity not found");

  const detail = ((opp as { detail: Record<string, unknown> }).detail ?? {}) as {
    metric?: string;
    brand_value?: number;
    benchmark_p50?: number;
  };
  const metric = detail.metric ?? null;
  const baseline = typeof detail.brand_value === "number" ? detail.brand_value : null;
  const target = typeof detail.benchmark_p50 === "number" ? detail.benchmark_p50 : null;

  const { data: snap, error: sErr } = await sb
    .from("benchmark_brand_snapshots")
    .select(SNAPSHOT_METRICS.join(", ") + ", period_start")
    .eq("brand_id", brandId)
    .eq("engine", "*")
    .order("period_start", { ascending: false })
    .limit(1);
  if (sErr) throw new Error(sErr.message);
  const snapRows = snap as unknown as Record<string, unknown>[] | null;
  const row = (snapRows && snapRows[0]) || null;

  let current: number | null = null;
  if (metric && row && typeof row[metric] === "number") current = row[metric] as number;

  let passed = false;
  let delta: number | null = null;
  let note: string | undefined;
  if (current == null) {
    note =
      "No current benchmark snapshot available yet — run a visibility check to measure the fix before verifying.";
  } else {
    delta = baseline != null ? Math.round((current - baseline) * 1000) / 1000 : null;
    passed = target != null ? current >= target : delta != null ? delta > 0 : false;
  }

  const result: VerificationResult = {
    verified_at: new Date().toISOString(),
    metric,
    baseline,
    target,
    current,
    delta,
    passed,
    method: "benchmark_snapshot_delta",
    note,
  };

  const { error: uErr } = await sb
    .from("tasks")
    .update({
      verification_result: result,
      status: "done",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (uErr) throw new Error(uErr.message);

  await notify(
    {
      user_id: userId,
      org_id: null,
      type: passed ? "verify_passed" : "verify_failed",
      title: passed ? "Verification passed" : "Verification failed",
      body: `Fix for "${(opp as { title: string }).title}" ${
        passed ? "moved the needle" : "did not reach target"
      } (${metric ?? "metric"}: ${current ?? "n/a"} vs target ${target ?? "n/a"}).`,
      payload: { task_id: taskId, opportunity_id: oppId, passed },
      link: "/dashboard/tasks",
    },
    sb,
  );

  return result;
}

// ---------- Notifications (in-app) ----------
export async function notify(
  input: {
    user_id: string;
    org_id?: string | null;
    type: string;
    title: string;
    body?: string;
    payload?: Record<string, unknown>;
    link?: string | null;
  },
  supabase?: SupabaseClient,
): Promise<void> {
  const sb = await db(supabase);
  const { error } = await sb.from("notifications").insert({
    user_id: input.user_id,
    org_id: input.org_id ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    payload: input.payload ?? {},
    link: input.link ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function listNotifications(userId: string, limit = 30, supabase?: SupabaseClient): Promise<any[]> {
  const sb = await db(supabase);
  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markNotificationRead(notificationId: string, userId: string, supabase?: SupabaseClient): Promise<void> {
  const sb = await db(supabase);
  const { error } = await sb.from("notifications").update({ read: true }).eq("id", notificationId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// ---------- Roles + Approvals (module 9) ----------
export async function getUserOrgRole(
  brandId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<string | null> {
  const sb = await db(supabase);
  const { data: brand } = await sb.from("brands").select("org_id").eq("id", brandId).single();
  if (!brand) return null;
  const { data: member } = await sb
    .from("org_members")
    .select("role")
    .eq("org_id", (brand as { org_id: string }).org_id)
    .eq("user_id", userId)
    .single();
  return (member as { role: string } | null)?.role ?? null;
}

export async function requestApproval(
  input: {
    brandId: string;
    taskId?: string | null;
    contentItemId?: string | null;
    approverRole?: string;
    userId: string;
  },
  supabase?: SupabaseClient,
): Promise<void> {
  const sb = await db(supabase);
  const { error } = await sb.from("approvals").insert({
    brand_id: input.brandId,
    task_id: input.taskId ?? null,
    content_item_id: input.contentItemId ?? null,
    requested_by: input.userId,
    approver_role: input.approverRole ?? "admin",
    status: "pending",
  });
  if (error) throw new Error(error.message);
}

export async function listApprovals(
  brandId: string,
  opts: { status?: string } = {},
  supabase?: SupabaseClient,
): Promise<any[]> {
  const sb = await db(supabase);
  let q = sb.from("approvals").select("*").eq("brand_id", brandId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function pendingApprovalForTask(taskId: string, supabase?: SupabaseClient): Promise<boolean> {
  const sb = await db(supabase);
  const { data } = await sb
    .from("approvals")
    .select("id")
    .eq("task_id", taskId)
    .eq("status", "pending")
    .limit(1);
  return !!(data && data.length);
}

export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  userId: string,
  brandId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const sb = await db(supabase);
  const { data: ap } = await sb.from("approvals").select("*").eq("id", approvalId).eq("brand_id", brandId).single();
  if (!ap) throw new Error("Approval not found");
  const role = await getUserOrgRole(brandId, userId, sb);
  const required = (ap as { approver_role: string }).approver_role;
  if (role !== required && role !== "owner") {
    throw new Error("You do not have permission to decide this approval");
  }
  const { error } = await sb
    .from("approvals")
    .update({ status: decision, decided_by: userId, decided_at: new Date().toISOString() })
    .eq("id", approvalId);
  if (error) throw new Error(error.message);
  if (decision === "approved") {
    await notify(
      {
        user_id: (ap as { requested_by: string }).requested_by,
        org_id: null,
        type: "approval_approved",
        title: "Approval granted",
        body: "Your deployment can now proceed.",
        payload: { task_id: (ap as { task_id: string | null }).task_id },
        link: "/dashboard/approvals",
      },
      sb,
    );
  }
}
