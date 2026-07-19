import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  engineChangeEmail,
  sendEmail,
  mirrorWhatsApp,
} from "@/lib/onboarding-emails";
import { ENGINE_META_MAP } from "@/lib/engine-workspace";

// ============================================================
// GET /api/cron/engine-change-alerts
//
// Scans engine_change_events for un-notified rows that meet an
// alert threshold, emails the brand's org owner, mirrors to
// WhatsApp when configured, and marks the row as notified so we
// never double-fire.
//
// Thresholds (deterministic; matches the detector cutoffs so we
// don't spam sub-threshold events):
//   • baseline_drift  → notify when |magnitude| ≥ 15pp
//   • citation_shift  → notify on any (already ≥ 10pp by detector)
//   • format_shift    → notify when |magnitude| ≥ 15pts
//   • manual          → notify always (a human wrote it)
//
// Idempotency: `engine_change_events.notified_at` is set on send.
// Even a re-fire only picks up rows where notified_at IS NULL.
//
// Auth: CRON_SECRET bearer, same as every cron.
// GET === POST (Vercel cron uses GET; POST for manual fire).
// ============================================================

type EventRow = {
  id: string;
  engine_id: string;
  brand_id: string | null;
  occurred_on: string;
  kind: "baseline_drift" | "citation_shift" | "format_shift" | "manual";
  magnitude: number | null;
  summary: string;
  evidence_run_ids: string[] | null;
};

function meetsThreshold(row: EventRow): boolean {
  if (row.kind === "manual") return true;
  if (row.magnitude == null) return false;
  const mag = Math.abs(row.magnitude);
  if (row.kind === "baseline_drift") return mag >= 15;
  if (row.kind === "citation_shift") return true;
  if (row.kind === "format_shift") return mag >= 15;
  return false;
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Pull un-notified events. Only brand-attributed rows are actionable —
  // orphaned evidence-attributed events without a brand_id are surfaced
  // via SSE and stay in the log without waking anyone.
  const { data: events } = await supabase
    .from("engine_change_events")
    .select("id, engine_id, brand_id, occurred_on, kind, magnitude, summary, evidence_run_ids")
    .is("notified_at", null)
    .not("brand_id", "is", null)
    .order("occurred_on", { ascending: false })
    .limit(50);

  const eventList = ((events as EventRow[] | null) ?? []).filter(meetsThreshold);

  if (eventList.length === 0) {
    return NextResponse.json({ ok: true, examined: 0, sent: 0 });
  }

  // Preload engines + brands + org owners in bulk to keep the loop tight.
  const engineIds = Array.from(new Set(eventList.map((e) => e.engine_id)));
  const brandIds = Array.from(new Set(eventList.map((e) => e.brand_id).filter((b): b is string => !!b)));

  const [enginesRes, brandsRes] = await Promise.all([
    supabase.from("engines").select("id, name").in("id", engineIds),
    supabase.from("brands").select("id, name, org_id").in("id", brandIds),
  ]);
  const engineById = new Map(
    ((enginesRes.data as { id: string; name: string }[] | null) ?? []).map((e) => [e.id, e]),
  );
  const brandById = new Map(
    ((brandsRes.data as { id: string; name: string; org_id: string }[] | null) ?? []).map((b) => [
      b.id,
      b,
    ]),
  );

  const orgIds = Array.from(new Set(Array.from(brandById.values()).map((b) => b.org_id)));
  const { data: owners } = await supabase
    .from("org_members")
    .select("org_id, user_id")
    .in("org_id", orgIds)
    .eq("role", "owner");
  const ownerByOrg = new Map(
    ((owners as { org_id: string; user_id: string }[] | null) ?? []).map((o) => [o.org_id, o.user_id]),
  );

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, whatsapp_phone")
    .in("id", orgIds);
  const phoneByOrg = new Map(
    ((orgs as { id: string; whatsapp_phone: string | null }[] | null) ?? []).map((o) => [
      o.id,
      o.whatsapp_phone,
    ]),
  );

  let sent = 0;
  let skipped = 0;
  const failures: { eventId: string; reason: string }[] = [];

  for (const ev of eventList) {
    const engine = engineById.get(ev.engine_id);
    const brand = ev.brand_id ? brandById.get(ev.brand_id) : null;
    if (!engine || !brand) {
      skipped += 1;
      continue;
    }
    const ownerUserId = ownerByOrg.get(brand.org_id);
    if (!ownerUserId) {
      failures.push({ eventId: ev.id, reason: "no_owner" });
      continue;
    }
    const { data: userData } = await supabase.auth.admin.getUserById(ownerUserId);
    const ownerEmail = userData?.user?.email;
    if (!ownerEmail) {
      failures.push({ eventId: ev.id, reason: "no_email" });
      continue;
    }

    const engineDisplay = ENGINE_META_MAP[engine.name]?.displayName ?? engine.name;
    const payload = engineChangeEmail({
      email: ownerEmail,
      brandName: brand.name,
      engineDisplay,
      engineSlug: engine.name,
      kind: ev.kind,
      magnitude: ev.magnitude,
      summary: ev.summary,
    });

    const emailRes = await sendEmail(payload.email);
    // WhatsApp mirror only fires when the org has opted in AND WA is configured;
    // mirrorWhatsApp is a silent no-op otherwise, so this is safe to always call.
    const waRes = await mirrorWhatsApp({
      phone: phoneByOrg.get(brand.org_id),
      templateName: payload.whatsapp.templateName,
      templateParams: payload.whatsapp.params,
    });

    if (!emailRes.ok && !waRes.ok) {
      failures.push({ eventId: ev.id, reason: emailRes.error ?? waRes.error ?? "send_failed" });
      continue;
    }

    // Mark notified only after at least one channel succeeded. If both fail
    // we leave notified_at NULL so the next cron tick retries.
    await supabase
      .from("engine_change_events")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", ev.id);
    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    examined: eventList.length,
    sent,
    skipped,
    failures,
  });
}
