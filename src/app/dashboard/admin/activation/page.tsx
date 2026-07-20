import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";

// ============================================================
// /dashboard/admin/activation — internal-only activation funnel view.
//
// Gated by INTERNAL_ADMIN_EMAILS (comma-separated). Not shown in nav.
// Renders the 9-step activation funnel from Section 11 of the redesign
// so the operator can watch weekly drop-off without a data-warehouse.
// ============================================================

export const dynamic = "force-dynamic";

const FUNNEL: { key: string; label: string }[] = [
  { key: "scan_started", label: "Landing → scan started" },
  { key: "scan_completed", label: "Scan started → completed" },
  { key: "report_viewed", label: "Scan completed → report viewed" },
  { key: "signup", label: "Report viewed → signed up" },
  { key: "goal_picked", label: "Signed up → goal picked" },
  { key: "first_draft_generated", label: "Goal → first draft" },
  { key: "first_draft_saved", label: "Draft → saved" },
  { key: "first_draft_published", label: "Saved → published" },
  { key: "first_mention_detected", label: "Published → mention detected" },
];

function adminEmails(): Set<string> {
  const raw = process.env.INTERNAL_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export default async function ActivationAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = adminEmails();
  if (!user || !user.email || !allowed.has(user.email.toLowerCase())) {
    redirect("/dashboard/mission-control");
  }

  const svc = createServiceClient();

  // Aggregate counts per event within the last 30 days. RLS is bypassed
  // by design — this page is internal-only.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const counts: Record<string, number> = {};
  for (const step of FUNNEL) {
    const { count } = await svc
      .from("activation_events")
      .select("id", { count: "exact", head: true })
      .eq("event", step.key)
      .gte("at", since);
    counts[step.key] = count ?? 0;
  }

  const top = counts[FUNNEL[0].key] || 1;

  return (
    <div>
      <PageHeader
        title="Activation Funnel"
        subtitle="Internal · 30-day counts of every step from landing to first mention"
      />
      <Panel title="Funnel" description="Counts, and each step as % of the top of the funnel.">
        <ol className="space-y-2">
          {FUNNEL.map((step) => {
            const c = counts[step.key];
            const pct = Math.round((c / top) * 100);
            return (
              <li key={step.key} className="flex items-center gap-4 text-sm">
                <span className="w-72 shrink-0 truncate text-muted">{step.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
                <span className="w-24 text-right tabular-nums text-ink">
                  {c} <span className="text-xs text-muted">({pct}%)</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}
