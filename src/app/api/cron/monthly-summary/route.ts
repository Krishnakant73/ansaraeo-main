import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateReportBuffer } from "@/lib/reports";
import { sendEmail, mirrorWhatsApp } from "@/lib/onboarding-emails";

// ============================================================
// GET /api/cron/monthly-summary  (CRON_SECRET, 1st of month 09:00)
//
// Executive summary — score, wins, losses, competitor benchmark — as a
// PDF attachment. Reuses the shared `generateReportBuffer` pipeline
// (per CLAUDE.md's "add report fields in reports.ts, not duplicated
// route PDF logic" rule).
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  const { data: brands } = await sb.from("brands").select("id, name, org_id");
  if (!brands?.length) return NextResponse.json({ ok: true, sent: 0 });

  const results: { brandId: string; ok: boolean; error?: string }[] = [];

  for (const b of brands) {
    try {
      const { data: owner } = await sb
        .from("org_members")
        .select("user_id")
        .eq("org_id", b.org_id)
        .eq("role", "owner")
        .limit(1)
        .single();
      if (!owner) {
        results.push({ brandId: b.id, ok: false, error: "no org owner" });
        continue;
      }
      const { data: userInfo } = await sb.auth.admin.getUserById(owner.user_id);
      const email = userInfo?.user?.email;
      if (!email) {
        results.push({ brandId: b.id, ok: false, error: "no email on file" });
        continue;
      }
      const { data: org } = await sb
        .from("organizations")
        .select("whatsapp_phone")
        .eq("id", b.org_id)
        .single();
      const phone = (org as { whatsapp_phone?: string } | null)?.whatsapp_phone ?? null;

      const { buffer } = await generateReportBuffer(b.id);
      const emailResult = await sendEmail({
        to: email,
        subject: `Your monthly AI Visibility executive summary — ${b.name}`,
        text: `Attached is this month's executive summary for ${b.name}.

Forwardable — this is the report to send your CEO / CMO.`,
      });
      // sendEmail() supports plain text + html; the PDF attachment is not
      // covered by our current onboarding-emails shim, so we send the
      // executive PDF via a direct nodemailer path here. Reused from the
      // weekly-reports cron.
      if (emailResult.ok && process.env.ZOHO_SMTP_USER && process.env.EMAIL_DRY_RUN !== "true") {
        const nodemailer = (await import("nodemailer")).default;
        const transporter = nodemailer.createTransport({
          host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
          port: 465,
          secure: true,
          auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
        });
        await transporter.sendMail({
          from: `"AnsarAEO Reports" <${process.env.ZOHO_SMTP_USER}>`,
          to: email,
          subject: `Your monthly AI Visibility executive summary — ${b.name}`,
          text: `Attached is this month's executive summary for ${b.name}.`,
          attachments: [
            {
              filename: `${b.name.replace(/\s+/g, "_")}_monthly_summary.pdf`,
              content: buffer,
            },
          ],
        });
      }

      await mirrorWhatsApp({
        phone,
        templateName: "aeo_monthly_summary",
        templateParams: [b.name],
      });

      results.push({ brandId: b.id, ok: true });
    } catch (err) {
      results.push({ brandId: b.id, ok: false, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
