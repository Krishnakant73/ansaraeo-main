import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase/server";
import { generateReportBuffer } from "@/lib/reports";

// ============================================================
// GET /api/cron/weekly-reports
//
// Runs weekly (see vercel.json). For every brand across every
// organization, generates the same PDF report as the manual download
// button (Batch 17) and emails it to the organization's owner via Zoho
// SMTP (same setup as the contact form, Batch 6).
//
// This is the "Weekly summary report (PDF/branded for agencies)" item
// from 04-feature-spec.md's Tier 5 — the last unbuilt piece of the
// Reporting & Alerts tier.
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: brands } = await supabase.from("brands").select("id, name, org_id");
  if (!brands || brands.length === 0) return NextResponse.json({ success: true, sent: 0 });

  const transporter = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
  });

  const results: { brandId: string; success: boolean; error?: string }[] = [];

  for (const brand of brands) {
    try {
      // Find the org owner's email via the org_members -> auth.users chain.
      // auth.users isn't a normal queryable table through the JS client,
      // so we go through the Admin API instead (only works with the
      // service-role client, which is what this cron already uses).
      const { data: owner } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", brand.org_id)
        .eq("role", "owner")
        .limit(1)
        .single();

      if (!owner) {
        results.push({ brandId: brand.id, success: false, error: "No org owner found" });
        continue;
      }

      const { data: userData } = await supabase.auth.admin.getUserById(owner.user_id);
      const ownerEmail = userData?.user?.email;
      if (!ownerEmail) {
        results.push({ brandId: brand.id, success: false, error: "Owner has no email on file" });
        continue;
      }

      const { buffer } = await generateReportBuffer(brand.id);

      await transporter.sendMail({
        from: `"AnsarAEO Reports" <${process.env.ZOHO_SMTP_USER}>`,
        to: ownerEmail,
        subject: `Your weekly AI visibility report — ${brand.name}`,
        text: `Attached is this week's AI visibility report for ${brand.name}. Log in to your dashboard for the full interactive view.`,
        attachments: [
          {
            filename: `${brand.name.replace(/\s+/g, "_")}_visibility_report.pdf`,
            content: buffer,
          },
        ],
      });

      results.push({ brandId: brand.id, success: true });
    } catch (err) {
      results.push({ brandId: brand.id, success: false, error: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return NextResponse.json({
    success: true,
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
