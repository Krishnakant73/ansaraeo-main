import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";

// ============================================================
// /share/report/[token] — read-only, no-auth report view.
//
// Consumed by teammates the account owner shares a link with. Everything
// is rendered server-side; the client has no way to mutate anything.
// ============================================================

export const dynamic = "force-dynamic";

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(token)) notFound();

  const sb = createServiceClient();
  const { data: row } = await sb
    .from("share_view_tokens")
    .select("token, brand_id, expires_at, revoked")
    .eq("token", token)
    .single();
  if (!row || row.revoked) notFound();
  // eslint-disable-next-line react-hooks/purity
  if (new Date(row.expires_at).getTime() < Date.now()) notFound();

  const [{ data: brand }, { data: prompts }] = await Promise.all([
    sb.from("brands").select("id, name, domain, industry").eq("id", row.brand_id).single(),
    sb.from("prompts").select("id, text").eq("brand_id", row.brand_id).limit(200),
  ]);
  if (!brand) notFound();

  const promptIds = (prompts ?? []).map((p) => p.id);
  const { data: runs } = promptIds.length
    ? await sb
        .from("visibility_runs")
        .select("prompt_id, brand_mentioned")
        .in("prompt_id", promptIds)
    : { data: [] };

  const total = runs?.length ?? 0;
  const mentioned = runs?.filter((r) => r.brand_mentioned).length ?? 0;
  const score = total ? Math.round((mentioned / total) * 100) : 0;

  return (
    <main className="min-h-screen bg-surface">
      <div className="container-x py-14 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Shared with you</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            {brand.name}
          </h1>
          <p className="mt-1 text-sm text-muted">{brand.domain}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <ScoreTile label="Visibility score" value={`${score}`} suffix="/100" />
            <ScoreTile label="AI answers analyzed" value={`${total}`} suffix="" />
            <ScoreTile label="You appear in" value={`${mentioned}`} suffix={` of ${total}`} />
          </div>

          <p className="mt-10 text-xs text-muted">
            View-only link · Expires {new Date(row.expires_at).toLocaleDateString("en-IN")}.{" "}
            <Link href="/" className="text-accent underline">
              Run a scan for your own brand
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

function ScoreTile({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-4xl font-extrabold tabular-nums text-ink">
        {value}
        <span className="text-lg font-medium text-muted">{suffix}</span>
      </p>
    </div>
  );
}
