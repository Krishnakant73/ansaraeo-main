import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";
import SimpleResourceForm from "@/components/dashboard/workflow/SimpleResourceForm";
import type { FieldDef } from "@/components/dashboard/workflow/SimpleResourceForm";

export const dynamic = "force-dynamic";

const FORM_FIELDS: FieldDef[] = [
  { name: "name", label: "Team name", required: true, placeholder: "SEO Pod" },
  { name: "description", label: "Description", type: "textarea" },
];

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: b } = await supabase.from("brands").select("org_id").eq("id", brand.id).single();
  const orgId = (b as { org_id: string } | null)?.org_id;

  const { data: teams } = orgId
    ? await supabase.from("teams").select("*").eq("org_id", orgId).order("created_at", { ascending: false })
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Collaboration units across your org. Assign missions and tasks to teams."
        actions={<SimpleResourceForm resource="teams" buttonLabel="New team" fields={FORM_FIELDS} />}
      />
      <Panel title={`Teams (${teams?.length ?? 0})`}>
        {!teams?.length ? (
          <p className="text-sm text-muted">No teams yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {teams.map((t: any) => (
              <li key={t.id} className="py-3">
                <p className="text-sm font-medium text-ink">{t.name}</p>
                {t.description && <p className="text-xs text-muted">{t.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
