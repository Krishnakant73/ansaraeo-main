import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// This REPLACES the hardcoded arrays in src/components/dashboard/DashboardPreview.tsx
// with real Supabase queries, scoped automatically to the logged-in user's
// organization via Row Level Security (no manual org_id filtering needed —
// the RLS policies in supabase/schema.sql handle it).

export default async function DashboardPage() {
  const supabase = await createClient();

  // RLS means this only ever returns brands the current user can see
  const { data: brands } = await supabase.from("brands").select("id, name, domain, industry").limit(1);

  const brand = brands?.[0];

  // No brand yet → send them through onboarding instead of showing an empty dashboard
  // (Design Principle #4 in 05-ui-ux-design-system.md: "never show an empty dashboard")
  if (!brand) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Let&apos;s set up your first brand</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Takes about a minute — we&apos;ll auto-generate starter prompts for you.
        </p>
        <Link href="/dashboard/onboarding" className="btn-primary mt-6">
          Start setup
        </Link>
      </div>
    );
  }

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, language")
    .eq("brand_id", brand.id);

  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase
        .from("visibility_runs")
        .select("id, prompt_id, brand_mentioned, sentiment, run_at")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
    : { data: [] };

  const totalRuns = runs?.length ?? 0;
  const mentionedRuns = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const visibilityScore = totalRuns > 0 ? Math.round((mentionedRuns / totalRuns) * 100) : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted">{brand.industry}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{brand.name}</h1>
        </div>
        <Link href="/dashboard/prompts" className="btn-secondary !h-10 !px-5">
          Manage prompts
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="card p-6">
          <p className="text-xs font-medium text-muted">Visibility Score</p>
          {visibilityScore === null ? (
            <p className="mt-2 text-sm text-muted">
              No runs yet — prompts haven&apos;t been checked against any AI engine.
            </p>
          ) : (
            <p className="mt-1 text-4xl font-extrabold tracking-tight">{visibilityScore}%</p>
          )}
        </div>
        <div className="card p-6">
          <p className="text-xs font-medium text-muted">Tracked Prompts</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{prompts?.length ?? 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-xs font-medium text-muted">Total Runs</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{totalRuns}</p>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <p className="text-xs font-medium text-muted">Recent Prompts</p>
        {!prompts || prompts.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No prompts yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {prompts.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>&ldquo;{p.text}&rdquo;</span>
                <span className="rounded-md bg-grid px-2 py-0.5 text-xs font-semibold uppercase">
                  {p.language}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
