import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ListTodo, CheckCircle2, Timer, TrendingUp, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { listTasks, listMissions } from "@/lib/workflow";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/dashboard/panel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function WorkflowAnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  // Suppress unused-Activity warning; kept for parity with the pre-migration
  // page if a future revision reintroduces the icon in the empty state.
  void Activity;

  const supabase = await createClient();
  const [tasks, missions] = await Promise.all([
    listTasks({ brand_id: brand.id }, supabase),
    listMissions(brand.id, {}, supabase),
  ]);

  // ---- task status distribution ----
  const taskStatuses = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"] as const;
  const taskByStatus = Object.fromEntries(taskStatuses.map((s) => [s, 0])) as Record<string, number>;
  for (const t of tasks) taskByStatus[t.status] = (taskByStatus[t.status] ?? 0) + 1;
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const blocked = taskByStatus["blocked"];

  // ---- verification loop metrics ----
  const verifyTasks = tasks.filter((t) => t.type === "verify");
  const verifyDone = verifyTasks.filter((t) => t.status === "done");
  const verifyPassed = verifyDone.filter(
    (t) => (t.verification_result as { passed?: boolean } | null)?.passed,
  );
  const verifyPassRate = verifyDone.length
    ? Math.round((verifyPassed.length / verifyDone.length) * 100)
    : null;

  // ---- cycle time + throughput ----
  const completed = tasks.filter(
    (t) => t.status === "done" && t.completed_at && t.created_at,
  ) as { completed_at: string; created_at: string }[];
  const cycleDays = completed.length
    ? Math.round(
        (completed.reduce(
          (sum, t) => sum + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()),
          0,
        ) /
          completed.length /
          DAY) *
          10,
      ) / 10
    : null;
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const throughput = completed.filter((t) => t.completed_at >= since).length;

  // ---- mission status ----
  const missionByStatus = Object.fromEntries(
    ["active", "on_hold", "completed", "cancelled"].map((s) => [s, 0]),
  ) as Record<string, number>;
  for (const m of missions) missionByStatus[m.status] = (missionByStatus[m.status] ?? 0) + 1;

  // ---- bottleneck (most common non-done task status) ----
  const bottleneck = (Object.entries(taskByStatus) as [string, number][])
    .filter(([s]) => s !== "done" && s !== "cancelled")
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <PageHeader
        title="Workflow Analytics"
        subtitle="Throughput, cycle time and verification pass-rate for the AI Search Operating System."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open tasks" value={open} icon={<ListTodo className="h-4 w-4" />} />
        <StatCard
          label="Blocked"
          value={blocked}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={blocked > 0}
        />
        <StatCard
          label="Avg cycle time"
          value={cycleDays != null ? `${cycleDays}d` : "—"}
          icon={<Timer className="h-4 w-4" />}
        />
        <StatCard
          label="Completed (30d)"
          value={throughput}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Task status" description="Distribution of work across the board.">
          <ul className="space-y-2">
            {taskStatuses.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted">{s.replace("_", " ")}</span>
                <span className="font-semibold text-ink">{taskByStatus[s]}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Verification Loop"
          description="Did shipped fixes actually move the needle?"
          action={
            <Link
              href={`/dashboard/b/${slug}/tasks`}
              className="text-xs font-medium text-accent"
            >
              Open tasks →
            </Link>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Verify tasks done</span>
              <span className="font-semibold text-ink">
                {verifyDone.length}/{verifyTasks.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Pass rate</span>
              <span
                className={cn(
                  "font-semibold",
                  verifyPassRate == null
                    ? "text-muted"
                    : verifyPassRate >= 60
                      ? "text-emerald-600"
                      : "text-rose-600",
                )}
              >
                {verifyPassRate == null ? "—" : `${verifyPassRate}%`}
              </span>
            </div>
            <p className="text-xs text-muted">
              {verifyDone.length === 0
                ? "No verify tasks completed yet. Accept an opportunity to generate a fix → verify sequence."
                : `${verifyPassed.length} fixes confirmed to have moved the benchmark.`}
            </p>
          </div>
        </Panel>

        <Panel title="Missions & bottleneck" description="Objective health and where work stalls.">
          <ul className="space-y-2">
            {(["active", "on_hold", "completed", "cancelled"] as const).map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted">{s.replace("_", " ")}</span>
                <span className="font-semibold text-ink">{missionByStatus[s]}</span>
              </li>
            ))}
          </ul>
          {bottleneck && bottleneck[1] > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              Most work is sitting in <span className="font-semibold">{bottleneck[0].replace("_", " ")}</span> (
              {bottleneck[1]} tasks).
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
