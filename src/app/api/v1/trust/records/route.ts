import { NextResponse } from "next/server";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/v1/trust/records  (scope: trust:read)
// Lists trust_records for the tenant. The gateway uses the service client
// (RLS bypass) and scopes every query on organizations.id derived from the
// API key — the critical security property (docs/PHASE1_API_GATEWAY.md §6).
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "trust:read");

    const sb = createServiceClient();
    const { data, error } = await sb
      .from("trust_records")
      .select("*")
      .eq("tenant_id", auth.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    return NextResponse.json({ records: data ?? [] });
  } catch (e) {
    return apiError(e);
  }
}
