import { LayoutDashboard, FileText, Activity, Bot, Check, X, Share2 } from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { getOpportunityById, opportunityTypeLabel, timeAgo, type Opportunity } from "@/lib/opportunity-workspace";

import OverviewBody from "./tabs/overview";
import DetailBody from "./tabs/detail";
import ActivityBody from "./tabs/activity";
import CopilotBody from "./tabs/copilot";
import OpportunityWorkspaceListeners from "./OpportunityWorkspaceListeners.client";

// ============================================================
// Opportunity workspace descriptor. Ninth kind.
// Anchors a single opportunity_recommendations row with accept /
// dismiss quick actions. The Copilot canvas is deliberately omitted
// — most opportunities live for minutes-to-hours before conversion,
// not long enough to warrant a dedicated chat surface.
// ============================================================

function healthFromOpportunity(o: Opportunity): "healthy" | "warning" | "critical" | "unknown" {
  if (o.status === "done") return "healthy";
  if (o.status === "dismissed") return "unknown";
  if ((o.priority_score ?? 0) >= 0.75) return "critical";
  if ((o.priority_score ?? 0) >= 0.5) return "warning";
  return "unknown";
}

const opportunityWorkspace = defineWorkspace<Opportunity>({
  kind: "opportunity",
  slugParam: "slug",

  async loader({ slug }) {
    return await getOpportunityById(slug);
  },

  header: (o) => ({
    title: o.title,
    subtitle: `${opportunityTypeLabel(o.type)} · ${o.brand.name}`,
    status: o.status,
    statusTone:
      o.status === "open" ? "warning" : o.status === "done" ? "accent" : "neutral",
    health: healthFromOpportunity(o),
    chips: [
      { label: "Brand", value: o.brand.name },
      { label: "Type", value: opportunityTypeLabel(o.type) },
      { label: "Created", value: timeAgo(o.created_at) },
      ...(o.related.linkedMissionTitle ? [{ label: "Mission", value: o.related.linkedMissionTitle }] : []),
    ],
  }),

  summary: (o) => [
    {
      key: "priority",
      label: "Priority",
      value: `${Math.round((o.priority_score ?? 0) * 100)}%`,
      hint: "0..100 score",
      tone: (o.priority_score ?? 0) >= 0.7 ? "negative" : undefined,
    },
    {
      key: "impact",
      label: "Est. mentions/mo",
      value: o.estimated_impact?.mentions_per_month ?? "—",
      hint: "if accepted + verified",
      tone: "positive",
    },
    {
      key: "visibility",
      label: "Visibility Δ",
      value:
        typeof o.estimated_impact?.visibility_delta === "number"
          ? `+${o.estimated_impact.visibility_delta.toFixed(1)}pp`
          : "—",
      hint: "projected",
      tone: "positive",
    },
    {
      key: "status",
      label: "Status",
      value: o.status,
      hint: o.related.linkedMissionId ? "mission in flight" : "no mission yet",
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: o }) => (
        <>
          <OpportunityWorkspaceListeners opportunityId={o.id} brandId={o.brand_id} />
          <OverviewBody opportunity={o} />
        </>
      ),
    },
    {
      key: "detail",
      label: "Detail",
      icon: FileText,
      render: ({ object: o }) => (
        <>
          <OpportunityWorkspaceListeners opportunityId={o.id} brandId={o.brand_id} />
          <DetailBody opportunity={o} />
        </>
      ),
    },
    {
      key: "activity",
      label: "Activity",
      icon: Activity,
      render: ({ object: o }) => (
        <>
          <OpportunityWorkspaceListeners opportunityId={o.id} brandId={o.brand_id} />
          <ActivityBody opportunity={o} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: o }) => (
        <>
          <OpportunityWorkspaceListeners opportunityId={o.id} brandId={o.brand_id} />
          <CopilotBody opportunity={o} />
        </>
      ),
    },
  ],

  activity: (o) => ({
    async entries() {
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [];
      rows.push({
        id: `c-${o.id}`,
        at: o.created_at,
        kind: "opportunity",
        message: `Opportunity generated · ${o.title}`,
      });
      return rows;
    },
  }),

  related: (o) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: o.brand.id, label: o.brand.name, relation: "belongs_to" });
      if (o.related.prompt) {
        nodes.push({
          kind: "prompt",
          id: o.related.prompt.id,
          label: (o.related.prompt.text ?? "").slice(0, 60) || "prompt",
          relation: "targets",
        });
      }
      if (o.related.linkedMissionId) {
        nodes.push({
          kind: "mission",
          id: o.related.linkedMissionId,
          label: o.related.linkedMissionTitle ?? "linked mission",
          relation: "spawned",
        });
      }
      return nodes;
    },
  }),

  quickActions: (o) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Check;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
    }> = [];
    if (o.status === "open") {
      actions.push({
        id: "accept",
        label: "Accept",
        icon: Check,
        keyboard: "a",
        variant: "primary",
        event: { name: "opportunity:accept", detail: { opportunityId: o.id } },
      });
      actions.push({
        id: "dismiss",
        label: "Dismiss",
        icon: X,
        keyboard: "x",
        variant: "danger",
        event: { name: "opportunity:dismiss", detail: { opportunityId: o.id } },
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "opportunity:share", detail: { opportunityId: o.id } },
    });
    return actions;
  },

  copilotContext: (o) => ({
    kind: "opportunity",
    id: o.id,
    label: o.title,
    summary: `Opportunity "${o.title}" (${opportunityTypeLabel(o.type)}) for brand ${o.brand.name}. Status ${o.status}, priority ${Math.round((o.priority_score ?? 0) * 100)}%.${o.estimated_impact?.mentions_per_month ? ` Estimated +${o.estimated_impact.mentions_per_month} mentions/mo.` : ""}`,
    hints: [
      "Explain from the detail + estimated_impact JSONB only.",
      "Never invent completion status or numbers not in the payload.",
    ],
  }),

  capabilities: {
    share: true,
    export: false,
    delete: false,
    api: true,
  },
});

export default opportunityWorkspace;
