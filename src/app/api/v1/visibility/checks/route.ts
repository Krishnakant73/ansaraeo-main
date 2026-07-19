import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { enqueueJob } from "@/lib/platform/queue";
import { createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  promptId: z.string().uuid(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

// POST /api/v1/visibility/checks  (scope: visibility:write)
// Enqueues a visibility_check job and returns 202 + task id. The job is owned
// and runs asynchronously; results arrive via GET poll or webhook.
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "visibility:write");

    const json = await request.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new ApiError(400, "invalid_request", "promptId (uuid) is required");

    const { promptId, idempotencyKey } = parsed.data;

    // Tenant ownership: prompt -> brand -> organization must equal tenantId.
    const sb = createServiceClient();
    const { data: prompt, error } = await sb
      .from("prompts")
      .select("id, brands(org_id)")
      .eq("id", promptId)
      .maybeSingle();
    if (error || !prompt) throw new ApiError(404, "prompt_not_found", "Prompt not found");

    const brand = Array.isArray(prompt.brands) ? prompt.brands[0] : prompt.brands;
    const orgId = (brand as { org_id?: string } | null)?.org_id;
    if (!orgId || orgId !== auth.tenantId) {
      throw new ApiError(403, "forbidden", "Prompt does not belong to this tenant");
    }

    const { jobId } = await enqueueJob("visibility_check", { promptId }, {
      tenantId: auth.tenantId,
      idempotencyKey,
    });

    return NextResponse.json(
      {
        task_id: jobId,
        status_url: `/api/v1/visibility/checks/${jobId}`,
        webhook_events: ["visibility_check.completed"],
      },
      { status: 202 }
    );
  } catch (e) {
    return apiError(e);
  }
}
