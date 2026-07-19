import { LayoutDashboard, Cog, Bot, Play, Pause, Share2 } from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { getAutomationById, timeAgo, type Automation } from "@/lib/automation-workspace";

import OverviewBody from "./tabs/overview";
import ConfigBody from "./tabs/config";
import CopilotBody from "./tabs/copilot";
import AutomationWorkspaceListeners from "./AutomationWorkspaceListeners.client";

// ============================================================
// Automation workspace descriptor. Tenth kind. Two tabs — automations
// are simpler objects than tasks: overview + raw config. Toggle
// action flips is_active via PATCH /api/automations/[id].
// ============================================================

const automationWorkspace = defineWorkspace<Automation>({
  kind: "automation",
  slugParam: "slug",

  async loader({ slug }) {
    return await getAutomationById(slug);
  },

  header: (a) => ({
    title: a.name,
    subtitle: a.description ?? undefined,
    status: a.is_active ? "Active" : "Inactive",
    statusTone: a.is_active ? "accent" : "neutral",
    health: a.is_active
      ? a.stats.hasTrigger && a.stats.actionCount > 0
        ? "healthy"
        : "warning"
      : "unknown",
    chips: [
      { label: "Brand", value: a.brand.name },
      ...(a.trigger?.type ? [{ label: "Trigger", value: String(a.trigger.type) }] : []),
      { label: "Actions", value: String(a.stats.actionCount) },
      { label: "Updated", value: timeAgo(a.updated_at) },
    ],
  }),

  summary: (a) => [
    {
      key: "state",
      label: "State",
      value: a.is_active ? "On" : "Off",
      hint: a.is_active ? "trigger armed" : "not firing",
      tone: a.is_active ? "positive" : undefined,
    },
    {
      key: "trigger",
      label: "Trigger",
      value: a.trigger?.type ? String(a.trigger.type) : "—",
      hint: a.stats.hasTrigger ? "configured" : "missing",
      tone: a.stats.hasTrigger ? undefined : "negative",
    },
    {
      key: "actions",
      label: "Actions",
      value: a.stats.actionCount,
      hint: a.stats.actionCount === 0 ? "none" : "run in order",
      tone: a.stats.actionCount === 0 ? "negative" : undefined,
    },
    {
      key: "age",
      label: "Age",
      value: a.stats.ageInDays == null ? "—" : `${a.stats.ageInDays}d`,
      hint: "since created",
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: a }) => (
        <>
          <AutomationWorkspaceListeners automationId={a.id} />
          <OverviewBody automation={a} />
        </>
      ),
    },
    {
      key: "config",
      label: "Config",
      icon: Cog,
      render: ({ object: a }) => (
        <>
          <AutomationWorkspaceListeners automationId={a.id} />
          <ConfigBody automation={a} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: a }) => (
        <>
          <AutomationWorkspaceListeners automationId={a.id} />
          <CopilotBody automation={a} />
        </>
      ),
    },
  ],

  related: (a) => ({
    async nodes() {
      return [{ kind: "brand", id: a.brand.id, label: a.brand.name, relation: "belongs_to" }];
    },
  }),

  quickActions: (a) => [
    {
      id: "toggle",
      label: a.is_active ? "Deactivate" : "Activate",
      icon: a.is_active ? Pause : Play,
      keyboard: a.is_active ? "d" : "a",
      variant: "primary",
      event: {
        name: "automation:toggle",
        detail: { automationId: a.id, next: !a.is_active },
      },
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "automation:share", detail: { automationId: a.id } },
    },
  ],

  copilotContext: (a) => ({
    kind: "automation",
    id: a.id,
    label: a.name,
    summary: `Automation "${a.name}" for brand ${a.brand.name}. ${a.is_active ? "Active" : "Inactive"}. Trigger type ${a.trigger?.type ?? "none"}, ${a.stats.actionCount} action(s).`,
    hints: [
      "Explain from the trigger + actions JSONB only.",
      "Never invent firing history — the schema doesn't record it.",
    ],
  }),

  capabilities: {
    share: true,
    export: false,
    delete: false,
    api: true,
  },
});

export default automationWorkspace;
