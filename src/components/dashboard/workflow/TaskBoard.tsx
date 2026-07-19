"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTaskAction, type TaskStatus, type TaskAction } from "@/lib/workflow-state";

type Task = {
  id: string;
  mission_id: string;
  title: string;
  type: string;
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null;
  source_opportunity_id: string | null;
  verification_result: Record<string, unknown> | null;
};

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "in_review", label: "In review" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

const TYPE_BADGE: Record<string, string> = {
  fix: "bg-amber-100 text-amber-700",
  content: "bg-sky-100 text-sky-700",
  approve: "bg-violet-100 text-violet-700",
  deploy: "bg-indigo-100 text-indigo-700",
  verify: "bg-emerald-100 text-emerald-700",
};

const ACTION_META: Record<TaskAction, { label: string; cls: string }> = {
  start: { label: "Start", cls: "btn-xs-accent" },
  submit: { label: "Submit", cls: "btn-xs-accent" },
  block: { label: "Block", cls: "btn-xs-ghost" },
  unblock: { label: "Unblock", cls: "btn-xs-accent" },
  complete: { label: "Complete", cls: "btn-xs-success" },
  reopen: { label: "Reopen", cls: "btn-xs-ghost" },
  cancel: { label: "Cancel", cls: "btn-xs-ghost" },
};

const ACTIONS: TaskAction[] = ["start", "submit", "block", "unblock", "complete", "reopen", "cancel"];

export default function TaskBoard({
  tasks,
  missionTitles,
  pendingApprovalTaskIds = [],
}: {
  tasks: Task[];
  missionTitles: Record<string, string>;
  pendingApprovalTaskIds?: string[];
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Task[]>(tasks);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyAppr, setBusyAppr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(task: Task, action: TaskAction) {
    const target = applyTaskAction(task.status, action);
    if (!target) return;
    setBusy(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (res.ok) {
        setLocal((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: target } : t)));
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Action failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function requestApproval(taskId: string) {
    setBusyAppr(taskId);
    setError(null);
    try {
      const res = await fetch("/api/workflow/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, approver_role: "admin" }),
      });
      if (res.ok) router.refresh();
      else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not request approval");
      }
    } finally {
      setBusyAppr(null);
    }
  }

  async function verify(task: Task) {
    setBusy(task.id);
    setError(null);
    try {
      const res = await fetch("/api/workflow/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id }),
      });
      if (res.ok) {
        const data = await res.json();
        const result = (data.result ?? {}) as Record<string, unknown>;
        setLocal((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "done" as TaskStatus, verification_result: result }
              : t,
          ),
        );
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Verification failed");
      }
    } finally {
      setBusy(null);
    }
  }

  const isPending = (t: Task) => pendingApprovalTaskIds.includes(t.id);
  const needsApproval = (t: Task) => t.type === "deploy" || t.type === "approve";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {error && (
        <div className="col-span-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {COLUMNS.map((col) => {
        const colTasks = local.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="flex flex-col rounded-xl border border-line bg-white/60">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">{col.label}</span>
              <span className="text-xs text-muted">{colTasks.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {colTasks.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">—</p>}
              {colTasks.map((t) => (
                <div key={t.id} className="rounded-lg border border-line bg-white p-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", TYPE_BADGE[t.type] ?? "bg-slate-100 text-slate-600")}>
                      {t.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">{t.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{missionTitles[t.mission_id] ?? "Mission"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {needsApproval(t) && !isPending(t) && (
                      <button
                        type="button"
                        disabled={busyAppr === t.id}
                        onClick={() => requestApproval(t.id)}
                        className="btn-xs btn-xs-ghost"
                      >
                        {busyAppr === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Request approval"}
                      </button>
                    )}
                    {isPending(t) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Awaiting approval
                      </span>
                    )}
                    {t.type === "verify" && t.status !== "done" && t.source_opportunity_id && (
                      <button
                        type="button"
                        disabled={busy === t.id}
                        onClick={() => verify(t)}
                        className="btn-xs btn-xs-success"
                      >
                        {busy === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify fix"}
                      </button>
                    )}
                    {ACTIONS.map((a) => {
                      // A pending approval blocks deploying.
                      if (a === "complete" && t.type === "deploy" && isPending(t)) return null;
                      const target = applyTaskAction(t.status, a);
                      if (!target) return null;
                      const disabled = busy === t.id;
                      return (
                        <button
                          key={a}
                          type="button"
                          disabled={disabled}
                          onClick={() => act(t, a)}
                          className={cn("btn-xs", ACTION_META[a].cls)}
                        >
                          {disabled && busy === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : ACTION_META[a].label}
                        </button>
                      );
                    })}
                    {t.type === "verify" && t.status === "done" && t.verification_result && (
                      <div
                        className={cn(
                          "mt-1 w-full rounded px-1.5 py-1 text-[10px] font-medium",
                          (t.verification_result as { passed?: boolean }).passed
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700",
                        )}
                      >
                        {(t.verification_result as { passed?: boolean }).passed ? "Verified" : "Not met"}
                        {(t.verification_result as { delta?: number }).delta != null &&
                          ` · Δ ${((t.verification_result as { delta?: number }).delta as number).toFixed(3)}`}
                        {(t.verification_result as { metric?: string }).metric
                          ? ` · ${(t.verification_result as { metric?: string }).metric}`
                          : ""}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
