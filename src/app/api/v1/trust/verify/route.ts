import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { verifyClaim, enqueueVerification } from "@/lib/platform/trust";

const Body = z.object({
  claim: z.string().min(1).max(5000),
  evidenceRefs: z.array(z.string().min(1).max(2000)).max(50).optional(),
  async: z.boolean().optional(),
});

// POST /api/v1/trust/verify  (scope: trust:read)
// Verifies a claim against evidence. Sync returns the VerificationResult;
// async enqueues a trust_verify job and returns 202 + task id (result via
// webhook `trust.verified` or GET /trust/records). See docs/PHASE2_TRUST_ENGINE.md.
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "trust:read");

    const json = await request.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) throw new ApiError(400, "invalid_request", "claim (string) is required");

    const { claim, evidenceRefs, async: useAsync } = parsed.data;
    const input = { claim, evidenceRefs: evidenceRefs ?? [], tenantId: auth.tenantId };

    if (useAsync) {
      const { jobId } = await enqueueVerification(input);
      return NextResponse.json(
        { task_id: jobId, status_url: "/api/v1/trust/records", webhook_events: ["trust.verified"] },
        { status: 202 }
      );
    }

    const result = await verifyClaim(input);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    return apiError(e);
  }
}
