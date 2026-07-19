import { timeAgo, type ShareToken } from "@/lib/share-workspace";

// ============================================================
// Share › Access — who can see this report and how. Distinct from
// Overview because access details deserve their own surface for
// audit and compliance conversations.
// ============================================================

export default function AccessBody({ share }: { share: ShareToken }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Access</h2>
        <p className="mt-1 text-sm text-muted">
          Anyone with this URL can view a static snapshot of {share.brand.name}&rsquo;s report.
          There&rsquo;s no login required. When the link expires or gets revoked, the URL stops
          working for everyone at once.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Facts</p>
        <dl className="mt-2 divide-y divide-line">
          <Row label="Token" value={share.token} mono />
          <Row label="Brand" value={share.brand.name} />
          <Row
            label="Created"
            value={`${new Date(share.created_at).toLocaleString()} · ${timeAgo(share.created_at)}`}
          />
          <Row
            label="Expires"
            value={`${new Date(share.expires_at).toLocaleString()} · ${
              share.stats.daysUntilExpiry != null
                ? share.stats.daysUntilExpiry >= 0
                  ? `in ${share.stats.daysUntilExpiry}d`
                  : `${Math.abs(share.stats.daysUntilExpiry)}d ago`
                : "unknown"
            }`}
          />
          <Row label="Revoked" value={share.revoked ? "yes" : "no"} />
          <Row
            label="Live"
            value={!share.revoked && !share.stats.isExpired ? "yes" : "no"}
          />
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">What the recipient sees</p>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          <li>
            Landing page: a static PDF-style snapshot of the report at the time the URL is opened.
          </li>
          <li>
            No editing, no navigation into the app, no login prompt.
          </li>
          <li>
            After expiry or revocation: an &ldquo;expired&rdquo; / &ldquo;revoked&rdquo; message with a
            note to request a fresh link from you.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <dt className="w-32 shrink-0 font-medium text-muted">{label}</dt>
      <dd className={mono ? "min-w-0 flex-1 break-all font-mono text-xs text-ink" : "min-w-0 flex-1 text-ink"}>
        {value}
      </dd>
    </div>
  );
}
