import InsightCard from "@/workspace/primitives/InsightCard";
import {
  providerHelpUrl, providerLabel, timeAgo,
  type Integration,
} from "@/lib/integration-workspace";

// ============================================================
// Integration › Overview — what's connected, when, and the honest
// signal on encryption. Never surfaces credential values — only
// shape (key count, encrypted-envelope detection).
// ============================================================

export default function OverviewBody({ integration: i }: { integration: Integration }) {
  const settingsUrl = providerHelpUrl(i.provider, i.brand.slug);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Integration</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{providerLabel(i.provider)}</h2>
            <p className="mt-2 text-sm text-muted">
              Connected to {i.brand.name}.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className={
                  i.status === "connected"
                    ? "chip border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "chip border-rose-200 bg-rose-50 text-rose-600"
                }
              >
                {i.status}
              </span>
              <span className="chip">{i.provider}</span>
              {i.stats.isEncrypted && (
                <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                  encrypted
                </span>
              )}
              {!i.stats.isEncrypted && i.stats.credentialKeyCount > 0 && (
                <span className="chip border-rose-200 bg-rose-50 text-rose-600">
                  plaintext (legacy)
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Age</p>
            <p className="text-2xl font-bold tracking-tight text-ink">{i.stats.ageInDays}d</p>
            <p className="text-[11px] text-muted">connected</p>
          </div>
        </div>
      </section>

      {i.status !== "connected" && (
        <InsightCard
          variant="warning"
          title="This integration isn't healthy"
          description={`Status is "${i.status}" — reconnect on the ${providerLabel(i.provider)} settings page.`}
          href={settingsUrl}
        />
      )}
      {!i.stats.isEncrypted && i.stats.credentialKeyCount > 0 && (
        <InsightCard
          variant="warning"
          title="Credentials appear to be stored in plaintext"
          description={`This row's credentials JSONB has ${i.stats.credentialKeyCount} top-level key(s) and no encrypted envelope. Reconnect via the settings page to re-store them encrypted.`}
          href={settingsUrl}
        />
      )}
      {i.stats.isEncrypted && (
        <InsightCard
          variant="win"
          title="Credentials are encrypted"
          description="The credential blob uses the AES-256-GCM envelope from src/lib/crypto.ts. No plaintext values are ever exposed to this workspace."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Brand · ${i.brand.name}`}
          description="Open the brand workspace for the operational context."
          href={`/dashboard/w/brand/${i.brand.slug}/overview`}
          meta="Brand"
        />
        <InsightCard
          variant="info"
          title="Manage credentials"
          description={`Open the ${providerLabel(i.provider)} settings page to reconnect, revoke, or view scopes.`}
          href={settingsUrl}
          meta="Settings"
        />
      </div>

      <p className="text-xs text-muted">
        Connected {timeAgo(i.connected_at)} · row id {i.id.slice(0, 8)}…
      </p>
    </div>
  );
}
