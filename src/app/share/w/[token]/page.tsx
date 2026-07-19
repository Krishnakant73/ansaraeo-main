import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ShieldCheck, Clock, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

// ============================================================
// /share/w/[token]
//
// Read-only landing for a workspace-scoped share_view_tokens row.
// Uses the SERVICE client (RLS bypass) because the recipient isn't
// signed in — we resolve the token, check expiry / revoked, and
// then render either a summary card that deep-links into the
// workspace URL under a cookie-less "share" context.
//
// Behavior:
//   - Unknown/expired/revoked token → notFound()
//   - Valid token → renders a stripped-down card showing the brand +
//     workspace kind + label, plus a "View workspace" link into
//     /dashboard/w/<kind>/<slug>. The dashboard shell recognizes the
//     /share-token cookie downstream (Phase 3b) and renders read-only.
//   - For now, without cookie plumbing yet, we display the read-only
//     summary card directly; a follow-up wires the recipient into an
//     auth-lite session that scopes them to just this workspace.
// ============================================================

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ShareWorkspacePage({ params }: PageProps) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("share_view_tokens")
    .select(
      "token, brand_id, workspace_kind, workspace_id, expires_at, revoked, created_at",
    )
    .eq("token", token)
    .maybeSingle();
  if (!row) notFound();
  const share = row as {
    token: string;
    brand_id: string;
    workspace_kind: string | null;
    workspace_id: string | null;
    expires_at: string;
    revoked: boolean;
    created_at: string;
  };

  if (share.revoked) {
    return <RevokedOrExpired reason="revoked" />;
  }
  if (new Date(share.expires_at) < new Date()) {
    return <RevokedOrExpired reason="expired" />;
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, slug, domain")
    .eq("id", share.brand_id)
    .maybeSingle();
  if (!brand) notFound();
  const b = brand as { id: string; name: string; slug: string; domain: string | null };

  const kind = share.workspace_kind ?? "brand";
  const label = await resolveLabel(supabase, kind, share.workspace_id, b.name);

  // Deep link into the workspace with a `?share=<token>` param so a
  // future read-only auth shim can pick it up. Today it's cosmetic —
  // the shell is behind the login redirect. Landing page is enough
  // to prove the flow works end-to-end.
  const workspaceHref =
    kind === "brand"
      ? `/dashboard/b/${b.slug}?share=${share.token}`
      : `/dashboard/w/${kind}/${share.workspace_id}?share=${share.token}`;

  const daysLeft = Math.max(
    0,
    Math.round((new Date(share.expires_at).getTime() - Date.now()) / 86_400_000),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-6">
      <section className="w-full rounded-2xl border border-line bg-white p-8 shadow-float">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-emerald-600" />
          Shared read-only view
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-ink">{label}</h1>
        <p className="mt-1 text-sm text-muted">
          {b.name}
          {b.domain ? ` · ${b.domain}` : ""}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-line bg-surface p-3">
            <dt className="section-label">Workspace kind</dt>
            <dd className="mt-1 font-mono text-ink">{kind}</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <dt className="section-label">Expires</dt>
            <dd className="mt-1 flex items-center gap-1 text-ink">
              <Clock aria-hidden className="h-3.5 w-3.5 text-muted" />
              {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={workspaceHref}
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
            View workspace
          </Link>
          <p className="text-[11px] text-muted">
            You&rsquo;re viewing read-only. Editing, running scans, and switching brands
            require the owner&rsquo;s sign-in.
          </p>
        </div>
      </section>

      <p className="text-[11px] text-muted">
        Powered by AnsarAEO · Read-only shares are scoped to a single workspace and
        expire automatically.
      </p>
    </main>
  );
}

function RevokedOrExpired({ reason }: { reason: "revoked" | "expired" }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-2xl border border-line bg-white p-8 shadow-float">
        <h1 className="text-lg font-semibold text-ink">
          {reason === "expired" ? "This share link has expired" : "This share link was revoked"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {reason === "expired"
            ? "Share links automatically stop working after 7 days. Ask the owner to mint a fresh one."
            : "The owner disabled this share link. Ask them to mint a new one."}
        </p>
      </div>
    </main>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveLabel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  kind: string,
  id: string | null,
  brandName: string,
): Promise<string> {
  if (!id || kind === "brand") return brandName;
  if (kind === "competitor") {
    const { data } = await supabase
      .from("competitors")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    const c = data as { name: string } | null;
    return c ? `Competitor · ${c.name}` : "Competitor workspace";
  }
  if (kind === "engine") {
    const { ENGINE_META_MAP } = await import("@/lib/engine-workspace");
    const display = ENGINE_META_MAP[id]?.displayName ?? id;
    return `Engine · ${display}`;
  }
  return `${kind} workspace`;
}
