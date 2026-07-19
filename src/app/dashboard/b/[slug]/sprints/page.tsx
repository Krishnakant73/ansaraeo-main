import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import SimpleResourceForm from "@/components/dashboard/workflow/SimpleResourceForm";
import type { FieldDef } from "@/components/dashboard/workflow/SimpleResourceForm";

export const dynamic = "force-dynamic";

const FORM_FIELDS: FieldDef[] = [
  { name: "name", label: "Sprint name", required: true, placeholder: "Sprint 12" },
  { name: "goal", label: "Goal", type: "textarea", placeholder: "Ship 5 citeable assets" },
  { name: "start_date", label: "Start date", type: "date" },
  { name: "end_date", label: "End date", type: "date" },
];

export default async function SprintsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: sprints } = await supabase.from("sprints").select("*").eq("brand_id", brand.id).order("start_date", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Sprints"
        subtitle="Time-box missions to a window and a goal."
        actions={<SimpleResourceForm resource="sprints" buttonLabel="New sprint" fields={FORM_FIELDS} />}
      />
      <Panel title={`Sprints (${sprints?.length ?? 0})`}>
        {!sprints?.length ? (
          <p className="text-sm text-muted">No sprints yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sprints.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{s.name}</p>
                  {s.goal && <p className="text-xs text-muted">{s.goal}</p>}
                  {(s.start_date || s.end_date) && (
                    <p className="text-xs text-muted">{s.start_date ?? "?"} → {s.end_date ?? "?"}</p>
                  )}
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
