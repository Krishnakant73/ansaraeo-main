import {
  LayoutDashboard, Target, Bot, Users, Pencil, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import { getTeamById, timeAgo, type Team } from "@/lib/team-workspace";

import OverviewBody from "./tabs/overview";
import MissionsBody from "./tabs/missions";
import CopilotBody from "./tabs/copilot";
import TeamWorkspaceListeners from "./TeamWorkspaceListeners.client";

// ============================================================
// Team workspace descriptor.
//
// Fourteenth UWE kind. Teams are org-scoped (migration_021).
// Three tabs: overview · missions · copilot. Members surface by
// user_id (auth.users can't be joined through the cookie client).
// Missions surface org-wide since mission.team_id doesn't exist.
// ============================================================

function healthFromTeam(t: Team): "healthy" | "warning" | "critical" | "unknown" {
  if (t.stats.memberCount === 0) return "critical";
  if (t.stats.leadCount === 0) return "warning";
  return "healthy";
}

const teamWorkspace = defineWorkspace<Team>({
  kind: "team",
  slugParam: "slug",

  async loader({ slug }) {
    return await getTeamById(slug);
  },

  header: (t) => ({
    title: t.name,
    subtitle: t.description ?? undefined,
    status: `${t.stats.memberCount} member${t.stats.memberCount === 1 ? "" : "s"}`,
    statusTone: t.stats.memberCount > 0 ? "neutral" : "danger",
    health: healthFromTeam(t),
    chips: [
      { label: "Org", value: t.org.name ?? "—" },
      { label: "Leads", value: String(t.stats.leadCount) },
      { label: "Created", value: timeAgo(t.created_at) },
    ],
  }),

  summary: (t) => [
    {
      key: "members",
      label: "Members",
      value: t.stats.memberCount,
      hint: `${t.stats.leadCount} lead${t.stats.leadCount === 1 ? "" : "s"}`,
      tone: t.stats.memberCount === 0 ? "negative" : "positive",
    },
    {
      key: "leads",
      label: "Leads",
      value: t.stats.leadCount,
      hint: t.stats.leadCount === 0 ? "assign one" : "designated",
      tone: t.stats.leadCount === 0 && t.stats.memberCount > 0 ? "negative" : undefined,
    },
    {
      key: "missions",
      label: "Active missions",
      value: t.stats.activeMissionCount,
      hint: "org-wide, active + on-hold",
      href: `/dashboard/w/team/${t.id}/missions`,
    },
    {
      key: "brands",
      label: "Brands covered",
      value: t.stats.brandsCoveredCount,
      hint: `${t.brands.length} in org`,
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: t }) => (
        <>
          <TeamWorkspaceListeners teamId={t.id} />
          <OverviewBody team={t} />
        </>
      ),
    },
    {
      key: "missions",
      label: "Missions",
      icon: Target,
      render: ({ object: t }) => (
        <>
          <TeamWorkspaceListeners teamId={t.id} />
          <MissionsBody team={t} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: t }) => (
        <>
          <TeamWorkspaceListeners teamId={t.id} />
          <CopilotBody team={t} />
        </>
      ),
    },
  ],

  timeline: (t) => ({
    async entries() {
      const rows: { id: string; at: string; kind: string; message: string }[] = [];
      rows.push({
        id: `t-${t.id}`,
        at: t.created_at,
        kind: "team",
        message: `Team created · ${t.name}`,
      });
      for (const m of t.members) {
        rows.push({
          id: `m-${m.user_id}`,
          at: m.created_at,
          kind: "member",
          message: `${m.role === "lead" ? "Lead" : "Member"} joined`,
        });
      }
      rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      return rows.slice(0, 60);
    },
  }),

  related: (t) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      for (const b of t.brands.slice(0, 5)) {
        nodes.push({ kind: "brand", id: b.id, label: b.name, relation: "org_brand" });
      }
      // Surface active missions the team likely owns (org-wide).
      const supabase = await createClient();
      const brandIds = t.brands.map((b) => b.id);
      if (brandIds.length > 0) {
        const { data } = await supabase
          .from("missions")
          .select("id, title")
          .in("brand_id", brandIds)
          .eq("status", "active")
          .order("priority", { ascending: false })
          .limit(3);
        for (const m of (data as { id: string; title: string }[] | null) ?? []) {
          nodes.push({ kind: "mission", id: m.id, label: m.title, relation: "active_org_mission" });
        }
      }
      return nodes;
    },
  }),

  quickActions: (t) => [
    {
      id: "rename",
      label: "Rename",
      icon: Pencil,
      keyboard: "r",
      variant: "primary",
      event: { name: "team:rename", detail: { teamId: t.id } },
    },
    {
      id: "members",
      label: "Manage members",
      icon: Users,
      keyboard: "m",
      href: "/dashboard/settings/members",
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "team:share", detail: { teamId: t.id } },
    },
  ],

  copilotContext: (t) => ({
    kind: "team",
    id: t.id,
    label: t.name,
    summary: `Team "${t.name}" in org "${t.org.name ?? "—"}". ${t.stats.memberCount} member${t.stats.memberCount === 1 ? "" : "s"} (${t.stats.leadCount} lead${t.stats.leadCount === 1 ? "" : "s"}). ${t.stats.activeMissionCount} active org missions across ${t.brands.length} brand${t.brands.length === 1 ? "" : "s"}.`,
    hints: [
      "Answer from teams + team_members + missions data only.",
      "Never invent members or role assignments.",
      "Teams are org-scoped; missions aren't wired to teams in the schema.",
    ],
  }),

  async list({ limit }) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("teams")
      .select("id, name, description")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    return ((data as { id: string; name: string; description: string | null }[] | null) ?? []).map(
      (t) => ({
        id: t.id,
        label: t.name,
        sublabel: t.description ?? undefined,
      }),
    );
  },

  capabilities: {
    share: true,
    export: false,
    delete: false,
    api: true,
  },
});

export default teamWorkspace;
