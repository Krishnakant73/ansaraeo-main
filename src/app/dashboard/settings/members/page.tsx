import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";

export const dynamic = "force-dynamic";

const ROLE_STYLE: Record<string, string> = {
  owner: "chip chip-accent",
  admin: "chip border-line",
  editor: "chip border-line",
  viewer: "chip border-line",
  client: "chip border-line",
};

export default async function MembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div>
        <PageHeader title="Members" subtitle="Who has access to this organization" />
        <p className="mt-6 text-sm text-muted">Sign in to view members.</p>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("org_id", membership?.org_id)
    .order("created_at", { ascending: true });

  return (
    <div>
      <PageHeader title="Members" subtitle="Who has access to this organization" />
      <div className="mt-6 max-w-xl">
        <Panel title={`Members (${(members ?? []).length})`} description="Email addresses are only shown for your own account.">
          <ul className="divide-y divide-line">
            {(members ?? []).map((m) => {
              const isYou = m.user_id === user.id;
              const label = isYou ? (user.email ?? "You") : "Team member";
              const sub = isYou ? "you" : m.user_id.slice(0, 8) + "…";
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{label}</p>
                    <p className="text-xs text-muted">{sub}</p>
                  </div>
                  <span className={ROLE_STYLE[m.role] ?? "chip border-line"}>{m.role}</span>
                </li>
              );
            })}
            {(members ?? []).length === 0 && (
              <li className="py-3 text-sm text-muted">No members found.</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
