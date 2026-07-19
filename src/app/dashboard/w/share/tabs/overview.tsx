import Link from "next/link";
import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, type ShareToken } from "@/lib/share-workspace";

// ============================================================
// Share › Overview — the shareable URL, expiry countdown, and
// revocation controls. Answers: is this link live, when does it
// die, who could use it?
// ============================================================

function shareUrl(token: string): string {
  // Rendered server-side, so we don't know the host — the client
  // component in ShareUrlPanel adds it. Fallback to a relative path
  // for the copy-to-clipboard prompt on the page.
  return `/share/report/${token}`;
}

export default function OverviewBody({ share }: { share: ShareToken }) {
  const url = shareUrl(share.token);
  const days = share.stats.daysUntilExpiry;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <p className="section-label">Public share link</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink">
            {url}
          </code>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={
              share.revoked || share.stats.isExpired
                ? "btn-ghost pointer-events-none opacity-40"
                : "btn-sm"
            }
          >
            Open
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="chip">Created {timeAgo(share.created_at)}</span>
          {share.revoked ? (
            <span className="chip border-rose-200 bg-rose-50 text-rose-600">Revoked</span>
          ) : share.stats.isExpired ? (
            <span className="chip border-rose-200 bg-rose-50 text-rose-600">Expired</span>
          ) : (
            <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Live</span>
          )}
          {!share.revoked && !share.stats.isExpired && days != null && (
            <span
              className={
                days <= 1
                  ? "chip border-rose-200 bg-rose-50 text-rose-600"
                  : days <= 3
                    ? "chip border-amber-200 bg-amber-50 text-amber-700"
                    : "chip"
              }
            >
              Expires in {days}d
            </span>
          )}
        </div>
      </section>

      {share.revoked && (
        <InsightCard
          variant="warning"
          title="Link revoked"
          description="Anyone opening this URL will see a 'link revoked' page. Generate a fresh link from the Reports page."
        />
      )}
      {!share.revoked && share.stats.isExpired && (
        <InsightCard
          variant="warning"
          title="Link expired"
          description="The 7-day window closed. Anyone hitting this URL will see an 'expired' page. Generate a fresh link if the recipient still needs it."
        />
      )}
      {!share.revoked && !share.stats.isExpired && days != null && days <= 3 && (
        <InsightCard
          variant="warning"
          title={`Expiring in ${days}d`}
          description="Consider generating a fresh link if the recipient may still need access."
        />
      )}
      {!share.revoked && !share.stats.isExpired && days != null && days > 3 && (
        <InsightCard
          variant="win"
          title="Live"
          description="Anyone with this URL can view the current report snapshot for the brand. No login required."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <InsightCard
          variant="info"
          title={`Brand · ${share.brand.name}`}
          description="Open the brand workspace to see visibility, competitors, and every other link."
          href={`/dashboard/w/brand/${share.brand.slug}/overview`}
          meta="Brand"
        />
        <InsightCard
          variant="info"
          title="Reports page"
          description="Generate a new share link, or download the PDF directly."
          href={`/dashboard/w/brand/${share.brand.slug}/reports`}
          meta="Reports"
        />
      </div>
    </div>
  );
}
