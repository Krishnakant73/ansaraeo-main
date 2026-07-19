import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { StreamPanel } from "@/components/analyze/StreamPanel";

// ============================================================
// /analyze/[scanId] — the "theatre".
//
// Public, no auth. Fetches the scan row via the service client server-side
// so we know whether to (a) render the streaming UI, or (b) redirect to
// the report page if the scan is already ready (cached hit from earlier).
//
// The streaming component itself is a client component that opens an
// EventSource to /api/analyze/[scanId]/stream — this page is just the
// SSR shell that guarantees the row exists.
// ============================================================

export const dynamic = "force-dynamic";

export default async function AnalyzeStreamPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const sb = createServiceClient();
  const { data: scan } = await sb
    .from("public_scans")
    .select("id, domain, canonical_domain, status")
    .eq("id", scanId)
    .single();

  if (!scan) notFound();

  // If the scan already completed (a return visit within cache TTL),
  // send the user straight to the report — no reason to re-watch.
  if (scan.status === "ready") {
    redirect(`/analyze/${scanId}/report`);
  }

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-x py-14 md:py-20">
        <StreamPanel scanId={scan.id} domain={scan.canonical_domain} />
      </div>
    </main>
  );
}
