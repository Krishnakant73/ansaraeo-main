import { LayoutDashboard, Zap, Cog, Bot, Play, Pause, Share2 } from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { getAlertById, metricLabel, ruleSummary, timeAgo, type Alert } from "@/lib/alert-workspace";

import OverviewBody from "./tabs/overview";
import FiringsBody from "./tabs/firings";
import RuleBody from "./tabs/rule";
import CopilotBody from "./tabs/copilot";
import AlertWorkspaceListeners from "./AlertWorkspaceListeners.client";

// ============================================================
// Alert workspace descriptor. Eleventh kind.
// Three tabs: overview · firings · rule. Alerts are simple objects
// — one rule row, many firing rows. Toggle activation from quick
// actions; ack-all is a bulk action on the Firings tab.
// ============================================================

function healthFromAlert(a: Alert): "healthy" | "warning" | "critical" | "unknown" {
  if (!a.is_active) return "unknown";
  if (a.stats.unacknowledgedCount > 5) return "critical";
  if (a.stats.unacknowledgedCount > 0) return "warning";
  return "healthy";
}

const alertWorkspace = defineWorkspace<Alert>({
  kind: "alert",
  slugParam: "slug",

  async loader({ slug }) {
    return await getAlertById(slug);
  },

  header: (a) => ({
    title: metricLabel(a.metric),
    subtitle: ruleSummary(a),
    status: a.is_active ? "Active" : "Paused",
    statusTone: a.is_active ? "accent" : "neutral",
    health: healthFromAlert(a),
    chips: [
      { label: "Brand", value: a.brand.name },
      { label: "Direction", value: a.direction },
      { label: "Mode", value: a.mode },
      { label: "Window", value: a.window_type },
      { label: "Threshold", value: String(a.threshold) },
    ],
  }),

  summary: (a) => [
    {
      key: "state",
      label: "State",
      value: a.is_active ? "On" : "Off",
      hint: a.is_active ? "evaluating" : "silenced",
      tone: a.is_active ? "positive" : undefined,
    },
    {
      key: "firings-30d",
      label: "Firings 30d",
      value: a.stats.firingCount30d,
      hint: a.stats.firingCount30d > 0 ? "recent activity" : "quiet",
    },
    {
      key: "unack",
      label: "Unacknowledged",
      value: a.stats.unacknowledgedCount,
      hint: a.stats.unacknowledgedCount > 0 ? "needs attention" : "clear",
      tone: a.stats.unacknowledgedCount > 0 ? "negative" : "positive",
      href: `/dashboard/w/alert/${a.id}/firings`,
    },
    {
      key: "last",
      label: "Last fired",
      value: a.stats.lastFiringAt ? timeAgo(a.stats.lastFiringAt) : "—",
      hint: "most recent event",
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: a }) => (
        <>
          <AlertWorkspaceListeners alertId={a.id} />
          <OverviewBody alert={a} />
        </>
      ),
    },
    {
      key: "firings",
      label: "Firings",
      icon: Zap,
      render: ({ object: a }) => (
        <>
          <AlertWorkspaceListeners alertId={a.id} />
          <FiringsBody alert={a} />
        </>
      ),
    },
    {
      key: "rule",
      label: "Rule",
      icon: Cog,
      render: ({ object: a }) => (
        <>
          <AlertWorkspaceListeners alertId={a.id} />
          <RuleBody alert={a} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: a }) => (
        <>
          <AlertWorkspaceListeners alertId={a.id} />
          <CopilotBody alert={a} />
        </>
      ),
    },
  ],

  activity: (a) => ({
    async entries() {
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      if (a.stats.lastFiringAt) {
        rows.push({
          id: `f-${a.id}`,
          at: a.stats.lastFiringAt,
          kind: "firing",
          message: `${metricLabel(a.metric)} fired`,
          href: `/dashboard/w/alert/${a.id}/firings`,
        });
      }
      rows.push({
        id: `c-${a.id}`,
        at: a.created_at,
        kind: "rule",
        message: `Rule created`,
      });
      return rows;
    },
  }),

  related: (a) => ({
    async nodes() {
      return [{ kind: "brand", id: a.brand.id, label: a.brand.name, relation: "belongs_to" }];
    },
  }),

  quickActions: (a) => [
    {
      id: "toggle",
      label: a.is_active ? "Pause" : "Activate",
      icon: a.is_active ? Pause : Play,
      keyboard: a.is_active ? "p" : "a",
      variant: "primary",
      event: { name: "alert:toggle", detail: { alertId: a.id, next: !a.is_active } },
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "alert:share", detail: { alertId: a.id } },
    },
  ],

  copilotContext: (a) => ({
    kind: "alert",
    id: a.id,
    label: metricLabel(a.metric),
    summary: `${ruleSummary(a)} Brand ${a.brand.name}. ${a.is_active ? "Active" : "Paused"}. ${a.stats.firingCount30d} firing(s) in 30d, ${a.stats.unacknowledgedCount} unacknowledged.`,
    hints: [
      "Answer from geo_alert_firings only.",
      "Never invent metric values or thresholds that don't match the rule.",
    ],
  }),

  capabilities: {
    share: true,
    export: false,
    delete: false,
    api: true,
  },
});

export default alertWorkspace;
