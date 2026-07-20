import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { canonicalizeDomain } from "@/lib/scan-classifier";
import { hashIp, logActivationEvent } from "@/lib/activation-events";
import { getPostHogClient } from "@/lib/posthog-server";

// ============================================================
// POST /api/analyze  (PUBLIC — no auth)
//
// Kicks off an anonymous pre-signup scan. Body: { domain }.
// Returns { scanId } which the client immediately opens via SSE at
// /api/analyze/[scanId]/stream to watch the scan run live.
//
// Rate limited by IP hash. Also deduped: if the same canonical domain
// has an active/recent scan (< 30 min old), we return that scan id
// instead of starting a new one — protects the API bill and prevents
// abuse.
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ipLimit = createRateLimiter({ windowMs: 60_000, max: 3 });
const domainLimit = createRateLimiter({ windowMs: 24 * 60 * 60_000, max: 20 });

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);
  const ipHash = hashIp(ip);

  const ipCheck = ipLimit(`analyze:${ip}`);
  if (!ipCheck.ok) {
    return NextResponse.json(
      { error: "Too many scans from this IP. Try again in a minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipCheck.resetMs / 1000)) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { domain?: unknown };
  const raw = typeof body.domain === "string" ? body.domain : "";
  const canonical = canonicalizeDomain(raw);
  if (!canonical) {
    return NextResponse.json({ error: "Enter a valid domain (e.g. example.com)." }, { status: 400 });
  }

  const domainCheck = domainLimit(`analyze:domain:${canonical}`);
  if (!domainCheck.ok) {
    return NextResponse.json(
      { error: "This domain has been scanned many times today. Try again tomorrow." },
      { status: 429 },
    );
  }

  const sb = createServiceClient();

  // Dedup: recent scan of the same canonical domain.
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: recent } = await sb
    .from("public_scans")
    .select("id, status")
    .eq("canonical_domain", canonical)
    .gte("created_at", thirtyMinAgo)
    .in("status", ["pending", "streaming", "ready"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (recent?.[0]) {
    return NextResponse.json({ scanId: recent[0].id, cached: true });
  }

  const { data: created, error } = await sb
    .from("public_scans")
    .insert({
      domain: raw,
      canonical_domain: canonical,
      ip_hash: ipHash,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to create scan" }, { status: 500 });
  }

  await logActivationEvent({
    event: "scan_started",
    ipHash,
    payload: { scanId: created.id, domain: canonical },
  });

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: ipHash ?? "anonymous",
    event: "scan_started",
    properties: {
      scan_id: created.id,
      domain: canonical,
    },
  });
  await posthog.shutdown();

  return NextResponse.json({ scanId: created.id, cached: false });
}
