import { NextResponse } from "next/server";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";

// GET /api/v1/agent/tasks/{id}  (scope: agent:run)
// Polls an agent task. Always tenant-scoped (task.tenant_id = auth.tenantId).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "agent:run");

    const { id } = await params;
    const sb = (await import("@/lib/supabase/server")).createServiceClient();
    const { data: task, error } = await sb
      .from("agent_tasks")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (error || !task) throw new ApiError(404, "task_not_found", "Agent task not found");

    return NextResponse.json({
      task_id: task.id,
      brand_id: task.brand_id,
      goal: task.goal,
      state: task.state,
      plan: task.plan,
      guardrails: task.guardrails,
      created_at: task.created_at,
    });
  } catch (e) {
    return apiError(e);
  }
}
