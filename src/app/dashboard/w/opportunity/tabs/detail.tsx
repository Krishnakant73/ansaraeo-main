import { opportunityTypeLabel, type Opportunity } from "@/lib/opportunity-workspace";

// ============================================================
// Opportunity › Detail — the full JSONB payload rendered as a
// readable key/value list. No hidden fields — an operator can see
// exactly what the intelligence engine emitted.
// ============================================================

export default function DetailBody({ opportunity }: { opportunity: Opportunity }) {
  const detailEntries = Object.entries(opportunity.detail ?? {});
  const impactEntries = Object.entries(opportunity.estimated_impact ?? {});

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Detail</h2>
        <p className="mt-1 text-sm text-muted">
          Full attributes from the intelligence engine. Nothing is hidden — the raw fields
          drive downstream mission decomposition.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="section-label">Type</p>
        <p className="mt-1 text-sm font-medium text-ink">{opportunityTypeLabel(opportunity.type)}</p>
        <p className="mt-1 text-xs text-muted">
          Raw type: <code className="rounded bg-surface px-1 text-[11px]">{opportunity.type}</code>
        </p>
      </section>

      {detailEntries.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">detail JSONB</p>
          <dl className="mt-2 divide-y divide-line">
            {detailEntries.map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 py-2 text-sm">
                <dt className="w-40 shrink-0 font-medium text-muted">{k}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-xs text-ink">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {impactEntries.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">estimated_impact</p>
          <dl className="mt-2 divide-y divide-line">
            {impactEntries.map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 py-2 text-sm">
                <dt className="w-40 shrink-0 font-medium text-muted">{k}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-xs text-ink">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
