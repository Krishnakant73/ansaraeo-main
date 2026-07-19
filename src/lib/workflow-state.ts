// ============================================================
// workflow-state.ts — PURE workflow state machine.
//
// No Supabase / `@/` imports here so vitest (which has no path alias) can unit-
// test the deterministic transitions directly. IO lives in ./workflow.ts.
// ============================================================

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TYPES = ["fix", "content", "approve", "deploy", "verify"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const MISSION_STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

// Allowed task transitions. `done`/`cancelled` are terminal-ish but allow
// reopen/restore so work can be recovered without deleting rows.
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "blocked", "cancelled"],
  in_progress: ["in_review", "blocked", "todo", "done", "cancelled"],
  in_review: ["done", "in_progress", "blocked", "cancelled"],
  blocked: ["in_progress", "todo", "cancelled"],
  done: ["in_progress"],
  cancelled: ["todo"],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  if (!TASK_TRANSITIONS[from]) return false;
  return TASK_TRANSITIONS[from].includes(to);
}

export const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  active: ["on_hold", "completed", "cancelled"],
  on_hold: ["active", "cancelled"],
  completed: ["active"],
  cancelled: ["active"],
};

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  if (!MISSION_TRANSITIONS[from]) return false;
  return MISSION_TRANSITIONS[from].includes(to);
}

// Action-oriented helpers for UI buttons. An action may be a no-op on some
// states (returns null) — callers should only render buttons whose action is
// valid from the current status.
export type TaskAction = "start" | "submit" | "block" | "unblock" | "complete" | "reopen" | "cancel";

const TASK_ACTION_TARGET: Record<TaskAction, TaskStatus> = {
  start: "in_progress",
  submit: "in_review",
  block: "blocked",
  unblock: "in_progress",
  complete: "done",
  reopen: "in_progress",
  cancel: "cancelled",
};

export function applyTaskAction(current: TaskStatus, action: TaskAction): TaskStatus | null {
  // "start" is state-aware: triage a backlog item into todo, then begin work
  // (todo -> in_progress). Other actions map to a fixed target status.
  const target = action === "start" ? (current === "backlog" ? "todo" : "in_progress") : TASK_ACTION_TARGET[action];
  return canTransitionTask(current, target) ? target : null;
}

export type MissionAction = "hold" | "resume" | "complete" | "cancel" | "reopen";

const MISSION_ACTION_TARGET: Record<MissionAction, MissionStatus> = {
  hold: "on_hold",
  resume: "active",
  complete: "completed",
  cancel: "cancelled",
  reopen: "active",
};

export function applyMissionAction(current: MissionStatus, action: MissionAction): MissionStatus | null {
  const target = MISSION_ACTION_TARGET[action];
  return canTransitionMission(current, target) ? target : null;
}

// ---- Rollup: mission health derived from its tasks (pure) ----
export type TaskHealth = {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  percentComplete: number; // 0..100, 0 when no tasks
  hasBlocked: boolean;
  isComplete: boolean; // all tasks done or no tasks
};

export function missionHealth(tasks: { status: TaskStatus }[]): TaskHealth {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const percentComplete = total === 0 ? 0 : Math.round((done / total) * 100);
  return {
    total,
    done,
    inProgress,
    blocked,
    percentComplete,
    hasBlocked: blocked > 0,
    isComplete: total > 0 && done === total,
  };
}

// ---- Deterministic opportunity → task template (AI decomposition in Phase 2) ----
// Each opportunity type maps to a fixed, sensible fix→verify sequence. The
// AI Task Engine will later enrich this with LLM-proposed steps, but the
// baseline is always deterministic and testable.
export type OppTaskTemplate = { title: string; type: TaskType }[];

export function decomposeOpportunity(
  opportunityType: string,
  title: string,
): OppTaskTemplate {
  const base: OppTaskTemplate = [{ title: `Fix: ${title}`, type: "fix" }];
  switch (opportunityType) {
    case "citation_gap":
      return [
        { title: `Publish citeable source: ${title}`, type: "content" },
        { title: `Submit for approval: ${title}`, type: "approve" },
        { title: `Deploy citeable asset: ${title}`, type: "deploy" },
        { title: `Verify citation gain: ${title}`, type: "verify" },
      ];
    case "position_gap":
      return [
        { title: `Optimize answer placement: ${title}`, type: "fix" },
        { title: `Approve change: ${title}`, type: "approve" },
        { title: `Deploy update: ${title}`, type: "deploy" },
        { title: `Verify position movement: ${title}`, type: "verify" },
      ];
    case "schema_missing":
      return [
        { title: `Add schema-for-AI: ${title}`, type: "fix" },
        { title: `Validate JSON-LD: ${title}`, type: "verify" },
      ];
    case "competitor_exposure":
      return [
        { title: `Draft differentiation content: ${title}`, type: "content" },
        { title: `Approve content: ${title}`, type: "approve" },
        { title: `Publish & deploy: ${title}`, type: "deploy" },
        { title: `Verify mention shift vs competitor: ${title}`, type: "verify" },
      ];
    case "intent_coverage":
      return [
        { title: `Cover missing intent: ${title}`, type: "content" },
        { title: `Approve coverage: ${title}`, type: "approve" },
        { title: `Deploy intent page: ${title}`, type: "deploy" },
        { title: `Verify intent coverage: ${title}`, type: "verify" },
      ];
    default:
      return [...base, { title: `Verify fix: ${title}`, type: "verify" }];
  }
}
