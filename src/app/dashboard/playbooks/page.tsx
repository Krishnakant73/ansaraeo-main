import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import SimpleResourceForm from "@/components/dashboard/workflow/SimpleResourceForm";
import type { FieldDef } from "@/components/dashboard/workflow/SimpleResourceForm";

export const dynamic = "force-dynamic";

const FORM_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", required: true, placeholder: "Citation Surge" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "trigger_type", label: "Trigger type", placeholder: "opportunity_type" },
  { name: "steps", label: "Steps (JSON)", type: "json", placeholder: '[{"title":"Publish source","type":"content"}]' },
];

export default async function PlaybooksPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No brand selected" description="Select a brand to manage playbooks." />;
  }
  const { data: b } = await supabase.from("brands").select("org_id").eq("id", brand.id).single();
  const orgId = (b as { org_id: string } | null)?.org_id;

  const { data: playbooks } = orgId
    ? await supabase.from("playbooks").select("*").eq("org_id", orgId).order("created_at", { ascending: false })
    : { data: null };

  return (
    <div>
      <PageHeader
        title="AI Playbooks"
        subtitle="Templated mission + task sequences you can replay on any opportunity."
        actions={<SimpleResourceForm resource="playbooks" buttonLabel="New playbook" fields={FORM_FIELDS} />}
      />
      <Panel title={`Playbooks (${playbooks?.length ?? 0})`}>
        {!playbooks?.length ? (
          <p className="text-sm text-muted">No playbooks yet. A playbook encodes a repeatable fix sequence.</p>
        ) : (
          <ul className="divide-y divide-line">
            {playbooks.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{p.name}</p>
                  {p.description && <p className="text-xs text-muted">{p.description}</p>}
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{p.trigger_type}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
