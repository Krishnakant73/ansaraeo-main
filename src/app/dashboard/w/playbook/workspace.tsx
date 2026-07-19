import {
  LayoutDashboard, ListChecks, Bot, Play, Pause, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import { getPlaybookById, timeAgo, triggerLabel, type Playbook } from "@/lib/playbook-workspace";

import OverviewBody from "./tabs/overview";
import StepsBody from "./tabs/steps";
import CopilotBody from "./tabs/copilot";
import PlaybookWorkspaceListeners from "./PlaybookWorkspaceListeners.client";

// ============================================================
// Playbook workspace descriptor.
//
// Fifteenth UWE kind. Playbooks are org-scoped templates that
// instantiate mission/task sequences when their trigger fires
// (opportunity_type|engine|manual). Three tabs: overview · steps ·
// copilot. Toggle active/paused via serializable event.
// ============================================================

function healthFromPlaybook(p: Playbook): "healthy" | "warning" | "critical" | "unknown" {
  if (p.stats.stepCount === 0) return "critical";
  if (!p.stats.hasVerifyStep) return "warning";
  if (!p.is_active) return "unknown";
  return "healthy";
}

const playbookWorkspace = defineWorkspace<Playbook>({
  kind: "playbook",
  slugParam: "slug",

  async loader({ slug }) {
    return await getPlaybookById(slug);
  },

  header: (p) => ({
    title: p.name,
    subtitle: p.description ?? undefined,
    status: p.is_active ? "active" : "paused",
    statusTone: p.is_active ? "accent" : "neutral",
    health: healthFromPlaybook(p),
    chips: [
      { label: "Trigger", value: triggerLabel(p.trigger_type) },
      { label: "Steps", value: String(p.stats.stepCount) },
      { label: "Created", value: timeAgo(p.created_at) },
    ],
  }),

  summary: (p) => [
    {
      key: "state",
      label: "State",
      value: p.is_active ? "active" : "paused",
      hint: p.is_active ? "fires on trigger" : "won't fire",
      tone: p.is_active ? "positive" : undefined,
    },
    {
      key: "steps",
      label: "Steps",
      value: p.stats.stepCount,
      hint: p.stats.stepCount === 0 ? "empty template" : "in sequence",
      tone: p.stats.stepCount === 0 ? "negative" : undefined,
      href: `/dashboard/w/playbook/${p.id}/steps`,
    },
    {
      key: "verify",
      label: "Verify step",
      value: p.stats.hasVerifyStep ? "yes" : "no",
      hint: p.stats.hasVerifyStep ? "closes the loop" : "no closure",
      tone: p.stats.hasVerifyStep ? "positive" : "negative",
    },
    {
      key: "gate",
      label: "Approval gate",
      value: p.stats.hasApprovalStep ? "yes" : "no",
      hint: p.stats.hasApprovalStep ? "requires sign-off" : "no gate",
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: p }) => (
        <>
          <PlaybookWorkspaceListeners playbookId={p.id} />
          <OverviewBody playbook={p} />
        </>
      ),
    },
    {
      key: "steps",
      label: "Steps",
      icon: ListChecks,
      render: ({ object: p }) => (
        <>
          <PlaybookWorkspaceListeners playbookId={p.id} />
          <StepsBody playbook={p} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: p }) => (
        <>
          <PlaybookWorkspaceListeners playbookId={p.id} />
          <CopilotBody playbook={p} />
        </>
      ),
    },
  ],

  timeline: (p) => ({
    async entries() {
      return [
        {
          id: `pb-${p.id}`,
          at: p.created_at,
          kind: "playbook",
          message: `Playbook created · ${p.name}`,
        },
      ];
    },
  }),

  related: (p) => ({
    async nodes() {
      // Surface sibling playbooks in the same org.
      const supabase = await createClient();
      const { data } = await supabase
        .from("playbooks")
        .select("id, name")
        .eq("org_id", p.org_id)
        .neq("id", p.id)
        .order("created_at", { ascending: false })
        .limit(4);
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      for (const s of (data as { id: string; name: string }[] | null) ?? []) {
        nodes.push({ kind: "playbook", id: s.id, label: s.name, relation: "sibling" });
      }
      return nodes;
    },
  }),

  quickActions: (p) => [
    p.is_active
      ? {
          id: "pause",
          label: "Pause",
          icon: Pause,
          keyboard: "p",
          variant: "ghost",
          event: { name: "playbook:toggle", detail: { playbookId: p.id, isActive: false } },
        }
      : {
          id: "activate",
          label: "Activate",
          icon: Play,
          keyboard: "a",
          variant: "primary",
          event: { name: "playbook:toggle", detail: { playbookId: p.id, isActive: true } },
        },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "playbook:share", detail: { playbookId: p.id } },
    },
  ],

  copilotContext: (p) => ({
    kind: "playbook",
    id: p.id,
    label: p.name,
    summary: `Playbook "${p.name}" in org "${p.org.name ?? "—"}". Trigger: ${triggerLabel(p.trigger_type)}. ${p.stats.stepCount} step${p.stats.stepCount === 1 ? "" : "s"}. ${p.is_active ? "Active." : "Paused."}${p.stats.hasVerifyStep ? " Has verify step." : " No verify step."}`,
    hints: [
      "Answer from the playbook row (steps + trigger + active state) only.",
      "Playbooks are templates — do not claim they have already run.",
    ],
  }),

  async list({ limit }) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("playbooks")
      .select("id, name, trigger_type, is_active")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    return ((data as { id: string; name: string; trigger_type: string; is_active: boolean }[] | null) ?? []).map(
      (p) => ({
        id: p.id,
        label: p.name,
        sublabel: `${p.is_active ? "active" : "paused"} · ${triggerLabel(p.trigger_type)}`,
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

export default playbookWorkspace;
