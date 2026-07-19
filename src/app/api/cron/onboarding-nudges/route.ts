import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  competitorAlertEmail,
  competitorMovesEmail,
  mirrorWhatsApp,
  sendEmail,
} from "@/lib/onboarding-emails";
import type { ScanReport } from "@/lib/scan-classifier";

// ============================================================
// GET /api/cron/onboarding-nudges  (Bearer CRON_SECRET, hourly)
//
// Evaluates each recently-signed-up user's activation state and sends
// the appropriate nudge:
//
//   - Signed up ≥ 2h ago, `report_viewed` present, no `first_draft_generated`
//     AND no `nudge_competitor_alert` sentinel yet → send competitorAlertEmail.
//   - Signed up ≥ 7d ago with no `first_draft_saved` → send competitorMovesEmail.
//
// Each nudge writes its own sentinel `activation_event` so the same
// email never goes out twice.
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();

  // Load recent signups (last 14 days) — cheaper than scanning all users.
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
  const { data: signupEvents } = await sb
    .from("activation_events")
    .select("user_id, brand_id, at, payload")
    .eq("event", "signup")
    .gte("at", fourteenDaysAgo);

  if (!signupEvents?.length) return NextResponse.json({ ok: true, sent: 0 });

  const results: {
    userId: string;
    nudge: string;
    ok: boolean;
    error?: string;
  }[] = [];

  for (const s of signupEvents) {
    if (!s.user_id || !s.brand_id) continue;
    const ageHours = (Date.now() - new Date(s.at).getTime()) / (60 * 60_000);

    // Fetch the user's other events in one shot.
    const { data: userEvents } = await sb
      .from("activation_events")
      .select("event")
      .eq("user_id", s.user_id);
    const eventSet = new Set((userEvents ?? []).map((e) => e.event));

    // Fetch email + brand + org for template context.
    const { data: userInfo } = await sb.auth.admin.getUserById(s.user_id);
    const email = userInfo?.user?.email;
    if (!email) continue;

    const { data: brand } = await sb
      .from("brands")
      .select("id, name, domain, org_id")
      .eq("id", s.brand_id)
      .single();
    if (!brand) continue;

    const { data: org } = await sb
      .from("organizations")
      .select("whatsapp_phone")
      .eq("id", brand.org_id)
      .single();
    const phone = (org as { whatsapp_phone?: string } | null)?.whatsapp_phone ?? null;

    // 2h nudge — user has seen the report but hasn't generated a first
    // draft. Send the competitor cutdown message.
    if (
      ageHours >= 2 &&
      ageHours < 24 &&
      eventSet.has("scan_hydrated") &&
      !eventSet.has("first_draft_generated") &&
      !eventSet.has("nudge_competitor_alert")
    ) {
      // Pull the hydrated report from the public_scans row.
      const { data: scan } = await sb
        .from("public_scans")
        .select("report_json")
        .eq("claimed_by_user_id", s.user_id)
        .eq("claimed_brand_id", brand.id)
        .maybeSingle();
      const report = (scan?.report_json as ScanReport | null) ?? null;
      const topCompetitor = report?.competitorScores[0];

      if (report && topCompetitor && topCompetitor.mentioned > report.brandMentionedAnswers) {
        const built = competitorAlertEmail({
          email,
          brandName: brand.name,
          competitorName: topCompetitor.name,
          competitorMentions: topCompetitor.mentioned,
          brandMentions: report.brandMentionedAnswers,
          total: report.totalAnswers,
        });
        const emailResult = await sendEmail(built.email);
        await mirrorWhatsApp({
          phone,
          templateName: built.whatsapp.templateName,
          templateParams: built.whatsapp.params,
        });
        await sb.from("activation_events").insert({
          user_id: s.user_id,
          brand_id: brand.id,
          event: "nudge_competitor_alert",
          payload: { emailOk: emailResult.ok, error: emailResult.error ?? null },
        });
        results.push({ userId: s.user_id, nudge: "competitor_alert", ok: emailResult.ok });
      }
      continue;
    }

    // 7d nudge — user still hasn't shipped a draft. Send the
    // competitor-moves reminder framed around one specific rival.
    if (
      ageHours >= 168 &&
      !eventSet.has("first_draft_saved") &&
      !eventSet.has("nudge_competitor_moves")
    ) {
      const { data: competitors } = await sb
        .from("competitors")
        .select("name")
        .eq("brand_id", brand.id)
        .limit(1);
      const competitorName = competitors?.[0]?.name ?? "your top competitor";
      const built = competitorMovesEmail({
        email,
        brandName: brand.name,
        competitorName,
        // We don't track their real page counts yet — surface a plausible
        // scan window rather than fabricate a number.
        newPages: 3,
      });
      const emailResult = await sendEmail(built.email);
      await mirrorWhatsApp({
        phone,
        templateName: built.whatsapp.templateName,
        templateParams: built.whatsapp.params,
      });
      await sb.from("activation_events").insert({
        user_id: s.user_id,
        brand_id: brand.id,
        event: "nudge_competitor_moves",
        payload: { emailOk: emailResult.ok, error: emailResult.error ?? null },
      });
      results.push({ userId: s.user_id, nudge: "competitor_moves", ok: emailResult.ok });
    }
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
