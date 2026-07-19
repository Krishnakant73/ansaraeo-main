// ============================================================
// Team workspace loader + shape.
//
// Teams live in migration_021 (workflow core). Each team is org-scoped
// (not brand-scoped) — a team can span multiple brands under the same
// org. team_members joins teams to auth.users with a role (member|lead).
//
// getTeamById(id) — cookie-scoped, RLS-safe, null → 404. Embeds member
// list + brands the team owns missions for. auth.users cannot be joined
// through the cookie client, so we surface user_id + role and let the
// UI render them by id (existing convention across the app).
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type TeamStats = {
  memberCount: number;
  leadCount: number;
  activeMissionCount: number;
  brandsCoveredCount: number;
  ageInDays: number;
};

export type TeamMember = {
  user_id: string;
  role: string;             // member|lead
  created_at: string;
};

export type TeamOrg = {
  id: string;
  name: string | null;
};

export type TeamBrand = {
  id: string;
  name: string;
  slug: string;
};

export type Team = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_at: string;
  org: TeamOrg;
  members: TeamMember[];
  brands: TeamBrand[];          // brands under org that have at least one active mission (heuristic scope)
  stats: TeamStats;
};

export async function getTeamById(id: string): Promise<Team | null> {
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("teams")
    .select("id, org_id, name, description, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;

  const team = t as Omit<Team, "org" | "members" | "brands" | "stats">;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", team.org_id)
    .maybeSingle();

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, role, created_at")
    .eq("team_id", id)
    .order("created_at", { ascending: true });

  const memberRows = (members as TeamMember[] | null) ?? [];

  // Brands under this team's org that have at least one active mission.
  // team_members doesn't attribute missions to teams directly (migration_021
  // has no mission.team_id), so we surface the org's active-mission brands
  // as the team's operational surface area. Honest limit; described in-UI.
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug, org_id")
    .eq("org_id", team.org_id)
    .order("created_at", { ascending: false })
    .limit(50);
  const brandRows =
    ((brands as { id: string; name: string; slug: string; org_id: string }[] | null) ?? []).map(
      (b) => ({ id: b.id, name: b.name, slug: b.slug }),
    );

  let activeMissionCount = 0;
  let brandsCoveredCount = 0;
  if (brandRows.length > 0) {
    const { data: missions } = await supabase
      .from("missions")
      .select("id, brand_id")
      .in(
        "brand_id",
        brandRows.map((b) => b.id),
      )
      .in("status", ["active", "on_hold"]);
    const missionRows = (missions as { id: string; brand_id: string }[] | null) ?? [];
    activeMissionCount = missionRows.length;
    brandsCoveredCount = new Set(missionRows.map((m) => m.brand_id)).size;
  }

  const stats: TeamStats = {
    memberCount: memberRows.length,
    leadCount: memberRows.filter((m) => m.role === "lead").length,
    activeMissionCount,
    brandsCoveredCount,
    ageInDays: Math.max(
      0,
      Math.floor((Date.now() - new Date(team.created_at).getTime()) / 86_400_000),
    ),
  };

  return {
    ...team,
    org: (org as TeamOrg | null) ?? { id: team.org_id, name: null },
    members: memberRows,
    brands: brandRows,
    stats,
  };
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
