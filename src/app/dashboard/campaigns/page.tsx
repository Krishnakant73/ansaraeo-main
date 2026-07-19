import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import SimpleResourceForm from "@/components/dashboard/workflow/SimpleResourceForm";
import type { FieldDef } from "@/components/dashboard/workflow/SimpleResourceForm";

export const dynamic = "force-dynamic";

const FORM_FIELDS: FieldDef[] = [
  { name: "name", label: "Campaign name", required: true, placeholder: "Q3 AI Visibility Push" },
  { name: "objective", label: "Objective", type: "textarea", placeholder: "Own the top 3 category queries" },
];

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No brand selected" description="Select a brand to manage campaigns." />;
  }

  const { data: campaigns } = await supabase.from("campaigns").select("*").eq("brand_id", brand.id).order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Group missions under an objective so progress rolls up to a single goal."
        actions={<SimpleResourceForm resource="campaigns" buttonLabel="New campaign" fields={FORM_FIELDS} />}
      />
      <Panel title={`Campaigns (${campaigns?.length ?? 0})`}>
        {!campaigns?.length ? (
          <p className="text-sm text-muted">No campaigns yet. Create one to group related missions.</p>
        ) : (
          <ul className="divide-y divide-line">
            {campaigns.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{c.name}</p>
                  {c.objective && <p className="text-xs text-muted">{c.objective}</p>}
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
