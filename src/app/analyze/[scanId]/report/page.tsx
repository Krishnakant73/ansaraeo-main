import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { ReportView } from "@/components/analyze/ReportView";
import { logActivationEvent } from "@/lib/activation-events";
import type { ScanReport } from "@/lib/scan-classifier";

// ============================================================
// /analyze/[scanId]/report — the payoff. Public, SSR.
//
// Server-side we:
//   1. Fetch the scan row via service client (only path to public_scans).
//   2. Set a `pending_scan_id` HTTP-only cookie (7d TTL) so the auth
//      callback can hydrate this scan into a real brand on signup.
//   3. Log a `report_viewed` activation event.
//   4. Render the report — no client fetches needed.
// ============================================================

export const dynamic = "force-dynamic";

export default async function AnalyzeReportPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const sb = createServiceClient();

  const { data: scan } = await sb
    .from("public_scans")
    .select("id, canonical_domain, status, report_json")
    .eq("id", scanId)
    .single();

  if (!scan) notFound();

  // If not ready, send the user back to the streaming page.
  if (scan.status !== "ready" || !scan.report_json) {
    redirect(`/analyze/${scanId}`);
  }

  // Set the hydration cookie so signup preserves the scan.
  const cookieStore = await cookies();
  cookieStore.set("pending_scan_id", scanId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });

  await logActivationEvent({
    event: "report_viewed",
    payload: { scanId, domain: scan.canonical_domain },
  });

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-x py-14 md:py-20">
        <ReportView scanId={scan.id} report={scan.report_json as ScanReport} />
      </div>
    </main>
  );
}
