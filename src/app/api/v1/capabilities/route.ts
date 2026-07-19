import { NextResponse } from "next/server";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { getCapabilities } from "@/lib/platform/capabilities";

// GET /api/v1/capabilities  (scope: visibility:read)
// Returns live engines (with availability) + regions for this tenant.
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "visibility:read");
    const caps = await getCapabilities();
    return NextResponse.json(caps);
  } catch (e) {
    return apiError(e);
  }
}
