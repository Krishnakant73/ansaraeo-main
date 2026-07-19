import type { Task } from "@/lib/task-workspace";
import TaskCopilotCanvas from "./TaskCopilotCanvas.client";

export default function CopilotBody({ task }: { task: Task }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this task</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the task row + approvals + verification. Never invents blockers or approvers.
        </p>
      </div>
      <TaskCopilotCanvas
        taskId={task.id}
        taskTitle={task.title}
        missionTitle={task.mission.title}
        brandName={task.brand.name}
      />
    </div>
  );
}
