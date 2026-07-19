import { NextResponse } from "next/server";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/v1/visibility/runs  (scope: visibility:read)
// Lists visibility_runs for the tenant's brands. Three scoped queries keep the
// service client (RLS bypass) safely tenant-scoped.
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "visibility:read");

    const sb = createServiceClient();
    const { data: brands } = await sb.from("brands").select("id").eq("org_id", auth.tenantId);
    const brandIds = (brands ?? []).map((b: { id: string }) => b.id);
    if (brandIds.length === 0) return NextResponse.json({ runs: [] });

    const { data: prompts } = await sb.from("prompts").select("id").in("brand_id", brandIds);
    const promptIds = (prompts ?? []).map((p: { id: string }) => p.id);
    if (promptIds.length === 0) return NextResponse.json({ runs: [] });

    const { data, error } = await sb
      .from("visibility_runs")
      .select("*")
      .in("prompt_id", promptIds)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    return NextResponse.json({ runs: data ?? [] });
  } catch (e) {
    return apiError(e);
  }
}
