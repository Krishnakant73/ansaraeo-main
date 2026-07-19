import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import type { ScanReport } from "@/lib/scan-classifier";
import { recommendGoal } from "@/lib/copilot-proposals";
import { GoalPicker } from "@/components/onboarding/GoalPicker";
import { logActivationEvent } from "@/lib/activation-events";

// ============================================================
// /dashboard/welcome — the goal picker.
//
// Arrives here from /auth/callback after a scan hydration. Reads the
// scan by id from the query string, uses it to preselect the most
// obviously-relevant goal, and hands off to /dashboard/welcome/copilot.
// If no scan id (direct signup path), we still let the user pick a goal
// so downstream Mission Control has enough context.
// ============================================================

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { brand } = await getSelectedBrand();
  if (!brand) redirect("/dashboard/onboarding");

  const { scan } = await searchParams;
  let report: ScanReport | null = null;
  if (scan) {
    const svc = createServiceClient();
    const { data: row } = await svc
      .from("public_scans")
      .select("report_json")
      .eq("id", scan)
      .single();
    report = (row?.report_json as ScanReport) ?? null;
  }

  const recommended = recommendGoal(report);

  await logActivationEvent({
    event: "welcomed",
    userId: user.id,
    brandId: brand.id,
    payload: { scanId: scan ?? null, recommended },
  });

  return (
    <div className="mx-auto max-w-3xl py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Step 1 of 2</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
        Welcome{brand.name ? `, ${brand.name}` : ""}. What should we work on first?
      </h1>
      {report && (
        <p className="mt-3 text-sm text-muted">
          Based on your report ({report.brandMentionedAnswers}/{report.totalAnswers} answers mention you
          {report.competitorScores[0]
            ? `; ${report.competitorScores[0].name} in ${report.competitorScores[0].mentioned}`
            : ""}
          ), we recommend the option marked below.
        </p>
      )}

      <div className="mt-8">
        <GoalPicker
          brandId={brand.id}
          recommended={recommended}
          scanId={scan ?? null}
        />
      </div>
    </div>
  );
}
