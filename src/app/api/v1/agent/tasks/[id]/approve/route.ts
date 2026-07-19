import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { approveStep } from "@/lib/platform/agent";

const Body = z.object({
  stepId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]).optional(),
});

// POST /api/v1/agent/tasks/{id}/approve  (scope: agent:run)
// Human-in-the-loop decision for a Governance-gated step (publish / deprecate /
// external_send). Approving authorizes the action and advances the task.
// See docs/PHASE3_AGENT_RUNTIME.md §5.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "agent:run");

    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new ApiError(400, "invalid_request", "stepId (string) is required");

    await approveStep(id, parsed.data.stepId, auth, parsed.data.decision ?? "approved");

    return NextResponse.json({ task_id: id, approved: parsed.data.stepId }, { status: 200 });
  } catch (e) {
    return apiError(e);
  }
}
