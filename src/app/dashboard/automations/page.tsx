import { Workflow } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import SimpleResourceForm from "@/components/dashboard/workflow/SimpleResourceForm";
import type { FieldDef } from "@/components/dashboard/workflow/SimpleResourceForm";
import AutomationToggle from "@/components/dashboard/workflow/AutomationToggle";

export const dynamic = "force-dynamic";

const FORM_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", required: true, placeholder: "Auto-mission high-priority gaps" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "trigger", label: "Trigger (JSON)", type: "json", placeholder: '{"type":"opportunity","min_priority":0.7}' },
  { name: "actions", label: "Actions (JSON)", type: "json", placeholder: '[{"type":"create_mission"}]' },
];

export default async function AutomationsPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return <EmptyState icon={<Workflow className="h-6 w-6" />} title="No brand selected" description="Select a brand to configure automations." />;
  }

  const { data: automations } = await supabase.from("automations").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Automation Engine"
        subtitle="No-code trigger to action rules. Activate a rule to let AnsarAEO act on opportunities automatically."
        actions={<SimpleResourceForm resource="automations" buttonLabel="New automation" fields={FORM_FIELDS} />}
      />
      <Panel title={`Automations (${automations?.length ?? 0})`}>
        {!automations?.length ? (
          <p className="text-sm text-muted">
            No automations yet. Define a trigger (e.g. a high-priority opportunity) and an action (create a mission) to
            automate the loop.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {automations.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{a.name}</p>
                  {a.description && <p className="truncate text-xs text-muted">{a.description}</p>}
                </div>
                <AutomationToggle id={a.id} active={a.is_active} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
