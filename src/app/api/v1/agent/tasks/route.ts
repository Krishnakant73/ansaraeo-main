import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { createAgentTask, startTask } from "@/lib/platform/agent";

const Body = z.object({
  goal: z.string().min(1).max(2000),
  brandId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  guardrails: z
    .object({
      maxExternalSends: z.number().int().min(0).optional(),
      requireApproval: z.array(z.enum(["publish", "deprecate", "external_send"])).optional(),
    })
    .optional(),
});

// POST /api/v1/agent/tasks  (scope: agent:run)
// Creates an agent task, plans it, and enqueues the first step. Returns 202
// with the inspectable plan. State-changing steps pause on Governance approval.
// See docs/PHASE3_AGENT_RUNTIME.md.
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "agent:run");

    const json = await request.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new ApiError(400, "invalid_request", "goal (string) and brandId (uuid) are required");

    const { taskId, plan } = await createAgentTask(
      {
        goal: parsed.data.goal,
        brandId: parsed.data.brandId,
        policyId: parsed.data.policyId,
        guardrails: parsed.data.guardrails,
      },
      auth
    );
    await startTask(taskId);

    return NextResponse.json(
      {
        task_id: taskId,
        state: "executing",
        plan,
        webhook_events: ["agent.task.updated"],
      },
      { status: 202 }
    );
  } catch (e) {
    return apiError(e);
  }
}
