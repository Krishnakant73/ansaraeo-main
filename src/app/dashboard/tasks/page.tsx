import { ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { listTasks, listMissions, listApprovals } from "@/lib/workflow";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import TaskBoard from "@/components/dashboard/workflow/TaskBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <EmptyState
        icon={<ListTodo className="h-6 w-6" />}
        title="No brand selected"
        description="Select or create a brand to see its task board."
      />
    );
  }

  const [tasks, missions, pendingApprovals] = await Promise.all([
    listTasks({ brand_id: brand.id }, supabase),
    listMissions(brand.id, {}, supabase),
    listApprovals(brand.id, { status: "pending" }, supabase),
  ]);

  const missionTitles: Record<string, string> = {};
  for (const m of missions) missionTitles[m.id] = m.title;

  const pendingApprovalTaskIds = (pendingApprovals as { task_id: string | null }[])
    .map((a) => a.task_id)
    .filter((id): id is string => !!id);

  const visible = tasks.filter((t) => t.status !== "cancelled");

  return (
    <div>
      <PageHeader
        title="Task Board"
        subtitle="Every action flows through here. Move tasks forward — each Verify task re-runs the engine and feeds your history."
      />
      {visible.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-6 w-6" />}
          title="No tasks yet"
          description="Accept an opportunity from the queue to generate a fix → verify task sequence, or create a mission."
        />
      ) : (
        <TaskBoard
          tasks={visible.map((t) => ({
            id: t.id,
            mission_id: t.mission_id,
            title: t.title,
            type: t.type,
            status: t.status,
            assignee_id: t.assignee_id,
            due_date: t.due_date,
            source_opportunity_id: t.source_opportunity_id,
            verification_result: t.verification_result,
          }))}
          missionTitles={missionTitles}
          pendingApprovalTaskIds={pendingApprovalTaskIds}
        />
      )}
    </div>
  );
}
