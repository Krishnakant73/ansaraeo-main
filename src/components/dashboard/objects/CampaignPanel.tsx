"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// The "Campaign workspace" — slide-over that opens from a campaign row instead
// of navigating away. Answers ONE question: what is this campaign's objective
// and current status? Deep edits stay on the full Campaigns page.
export default function CampaignPanel({
  campaign,
}: {
  campaign: { id: string; name: string; objective?: string | null; status?: string | null };
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line p-5">
        <p className="section-label">Campaign workspace</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-ink">{campaign.name}</h2>
        {campaign.status && (
          <div className="mt-3">
            <span className="chip border-line">{campaign.status}</span>
          </div>
        )}
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <p className="section-label">Objective</p>
          <p className="mt-2 text-sm text-ink">
            {campaign.objective || "No objective set yet — add one on the full page."}
          </p>
        </div>
        <div>
          <p className="section-label">What you can do here</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            <li>See the campaign&rsquo;s objective and status at a glance.</li>
            <li>Open the full Campaigns page to edit details or group missions under it.</li>
          </ul>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line p-5">
        <Link
          href={`/dashboard/w/campaign/${campaign.id}/overview`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </div>
  );
}
