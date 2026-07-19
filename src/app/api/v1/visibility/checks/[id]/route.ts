import { NextResponse } from "next/server";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/v1/visibility/checks/{id}  (scope: visibility:read)
// Polls a task. Always tenant-scoped (job.tenant_id = auth.tenantId).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "visibility:read");

    const { id } = await params;
    const sb = createServiceClient();
    const { data: job, error } = await sb
      .from("jobs")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (error || !job) throw new ApiError(404, "task_not_found", "Task not found");

    return NextResponse.json({
      task_id: job.id,
      type: job.type,
      status: job.status,
      result: job.result,
      error: job.last_error,
      created_at: job.created_at,
      finished_at: job.finished_at,
    });
  } catch (e) {
    return apiError(e);
  }
}
