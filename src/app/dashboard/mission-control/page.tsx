import Link from "next/link";
import { Flag, Inbox, ListTodo, AlertTriangle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { listMissions, listTasks, listOpportunities } from "@/lib/workflow";
import { missionHealth } from "@/lib/workflow-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import NewMissionForm from "@/components/dashboard/workflow/NewMissionForm";
import OpportunityQueue from "@/components/dashboard/workflow/OpportunityQueue";

export const dynamic = "force-dynamic";

export default async function MissionControlPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <EmptyState
        icon={<Flag className="h-6 w-6" />}
        title="Set up your first brand"
        description="Create a brand to start running missions and tracking AI-search visibility work."
        action={
          <Link href="/dashboard/onboarding" className="btn-primary">
            Start setup
          </Link>
        }
      />
    );
  }

  const [missions, tasks, opportunities] = await Promise.all([
    listMissions(brand.id, { status: "active" }, supabase),
    listTasks({ brand_id: brand.id }, supabase),
    listOpportunities(brand.id, { status: "open" }, supabase),
  ]);

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  // Per-mission progress from the task list.
  const tasksByMission = new Map<string, { status: any }[]>();
  for (const t of tasks) {
    const arr = tasksByMission.get(t.mission_id) ?? [];
    arr.push({ status: t.status });
    tasksByMission.set(t.mission_id, arr);
  }

  return (
    <div>
      <PageHeader
        title="Mission Control"
        subtitle="Your AI Search Operating System command center — turn gaps into shipped, measured fixes."
        actions={<NewMissionForm />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active missions" value={missions.length} icon={<Flag className="h-4 w-4" />} />
        <StatCard label="Open tasks" value={openTasks.length} icon={<ListTodo className="h-4 w-4" />} />
        <StatCard
          label="Blocked"
          value={blockedTasks.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={blockedTasks.length > 0}
        />
        <StatCard label="Opportunity queue" value={opportunities.length} icon={<Inbox className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          title="Active missions"
          description="Objectives in flight, with task completion."
          className="xl:col-span-2"
          action={
            <Link href="/dashboard/tasks" className="text-xs font-medium text-accent">
              Open task board →
            </Link>
          }
        >
          {missions.length === 0 ? (
            <p className="text-sm text-muted">
              No active missions. Accept an opportunity below, or create one with{" "}
              <span className="font-medium text-ink">New mission</span>.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {missions.map((m) => {
                const h = missionHealth(tasksByMission.get(m.id) ?? []);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{m.title}</p>
                      <p className="text-xs text-muted">
                        {h.done}/{h.total} tasks · priority {m.priority}
                      </p>
                    </div>
                    <div className="flex w-32 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${h.percentComplete}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-muted">{h.percentComplete}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Opportunity queue"
          description="Gaps vs the benchmark. Accept to spin up a mission + tasks."
          action={
            <Link href="/dashboard/opportunities" className="text-xs font-medium text-accent">
              View all →
            </Link>
          }
        >
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted">No open opportunities.</p>
          ) : (
            <OpportunityQueue
              opportunities={opportunities.slice(0, 5).map((o) => ({
                id: o.id,
                type: o.type,
                title: o.title,
                estimated_impact: o.estimated_impact,
                priority_score: o.priority_score,
                status: o.status,
              }))}
            />
          )}
        </Panel>
      </div>

      <Panel className="mt-6" title="Jump back in">
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/opportunities" className="btn-ghost">
            Opportunity Queue <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard/tasks" className="btn-ghost">
            Task Board <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Panel>
    </div>
  );
}
