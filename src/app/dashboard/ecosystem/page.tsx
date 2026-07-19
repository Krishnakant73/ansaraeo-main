import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";

export default function EcosystemPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Ecosystem"
        subtitle="How AnsarAEO connects to the rest of your stack — integrations, API, and developer tooling."
      />

      <Panel title="Integrations" description="Connect GA4, Shopify, Google Search Console, and WhatsApp to enrich intelligence and attribution.">
        <Link
          href="/dashboard/settings/integrations"
          className="btn-secondary"
        >
          Manage integrations
        </Link>
      </Panel>

      <Panel
        title="API & Developer"
        description="Programmatic access to visibility, intelligence, and trust data for custom workflows and internal tooling."
      >
        <ul className="space-y-3 text-sm text-muted">
          <li>
            <span className="font-medium text-ink">REST v1</span> —{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[12px]">
              /api/v1/visibility/checks
            </code>
            , <code className="rounded bg-surface px-1.5 py-0.5 text-[12px]">/api/v1/intelligence</code>,{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[12px]">/api/v1/trust</code>
          </li>
          <li>
            <span className="font-medium text-ink">MCP server</span> — a Stdio Model Context Protocol
            server exposes brand, visibility, and competitor tools to MCP-aware clients.
          </li>
          <li>
            <span className="font-medium text-ink">Webhooks</span> — subscribe to visibility and
            trust events for downstream automation (protected by <code className="rounded bg-surface px-1.5 py-0.5 text-[12px]">CRON_SECRET</code>).
          </li>
        </ul>
      </Panel>
    </div>
  );
}
