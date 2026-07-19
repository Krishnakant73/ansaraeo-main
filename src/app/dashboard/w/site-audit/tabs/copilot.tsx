import type { SiteAudit } from "@/lib/site-audit-workspace";
import SiteAuditCopilotCanvas from "./SiteAuditCopilotCanvas.client";

export default function CopilotBody({ audit }: { audit: SiteAudit }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this audit</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the audit&rsquo;s scores + issues array. Never invents checks.
        </p>
      </div>
      <SiteAuditCopilotCanvas
        auditId={audit.id}
        brandName={audit.brand.name}
        overallScore={audit.overall_score}
        failCount={audit.stats.failCount}
        warnCount={audit.stats.warnCount}
      />
    </div>
  );
}
