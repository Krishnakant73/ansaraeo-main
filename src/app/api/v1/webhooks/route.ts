import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest, requireScope } from "@/lib/platform/auth";
import { apiError, ApiError } from "@/lib/platform/responses";
import { createSubscription, listSubscriptions } from "@/lib/platform/webhooks";

const Body = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
});

// GET /api/v1/webhooks  (scope: webhooks:manage) — list subscriptions
// POST /api/v1/webhooks (scope: webhooks:manage) — create; returns raw secret ONCE
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "webhooks:manage");
    const subs = await listSubscriptions(auth.tenantId);
    return NextResponse.json({ subscriptions: subs });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) throw new ApiError(401, "unauthorized", "Invalid or missing API key");
    requireScope(auth, "webhooks:manage");

    const json = await request.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_request", "url (valid) and events[] (non-empty) required");
    }
    const { id, secret } = await createSubscription(auth.tenantId, parsed.data.url, parsed.data.events);
    return NextResponse.json(
      { id, url: parsed.data.url, events: parsed.data.events, secret },
      { status: 201 }
    );
  } catch (e) {
    return apiError(e);
  }
}
