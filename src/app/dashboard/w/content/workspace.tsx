import {
  LayoutDashboard, PenSquare, ShieldCheck, Activity, Bot,
  Eye, Send, Rocket, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { getContentById, timeAgo, type ContentItem } from "@/lib/content-workspace";

import OverviewBody from "./tabs/overview";
import DraftBody from "./tabs/draft";
import ChecklistBody from "./tabs/checklist";
import ActivityBody from "./tabs/activity";
import CopilotBody from "./tabs/copilot";
import ContentWorkspaceListeners from "./ContentWorkspaceListeners.client";

// ============================================================
// Content workspace descriptor. Eighth UWE kind.
// content_items sit under Brand + optionally Prompt; the workspace
// gives one draft its own operating table with an editor, checklist,
// and Copilot canvas. Approval routes through the existing
// /api/content/approve endpoint (E-E-A-T gate is server-enforced).
// ============================================================

function healthFromContent(c: ContentItem): "healthy" | "warning" | "critical" | "unknown" {
  if (c.status === "published") return "healthy";
  if (c.status === "approved") return "healthy";
  if (c.stats.approvalBlockers.length === 0) return "healthy";
  if (c.stats.placeholderCount > 0) return "warning";
  return "unknown";
}

const contentWorkspace = defineWorkspace<ContentItem>({
  kind: "content",
  slugParam: "slug",

  async loader({ slug }) {
    return await getContentById(slug);
  },

  header: (c) => ({
    title: c.title || "Untitled draft",
    subtitle: c.prompt ? `Targets: ${c.prompt.text.slice(0, 100)}${c.prompt.text.length > 100 ? "…" : ""}` : undefined,
    status: c.status.replace(/_/g, " "),
    statusTone:
      c.status === "approved" || c.status === "published"
        ? "accent"
        : c.status === "in_review"
          ? "warning"
          : "neutral",
    health: healthFromContent(c),
    chips: [
      { label: "Brand", value: c.brand.name },
      ...(c.target_engine ? [{ label: "Engine", value: c.target_engine.replace(/_/g, " ") }] : []),
      { label: "Words", value: String(c.stats.wordCount) },
      { label: "Created", value: timeAgo(c.created_at) },
    ],
  }),

  summary: (c) => [
    {
      key: "status",
      label: "Status",
      value: c.status.replace(/_/g, " "),
      hint:
        c.status === "approved" || c.status === "published"
          ? "shipped"
          : c.stats.approvalBlockers.length === 0
            ? "ready to approve"
            : `${c.stats.approvalBlockers.length} blocker${c.stats.approvalBlockers.length === 1 ? "" : "s"}`,
      tone: c.status === "approved" || c.status === "published" ? "positive" : undefined,
    },
    {
      key: "placeholders",
      label: "Placeholders",
      value: c.stats.placeholderCount,
      hint: c.stats.placeholderCount > 0 ? "must resolve before approval" : "clear",
      tone: c.stats.placeholderCount > 0 ? "negative" : "positive",
      href: `/dashboard/w/content/${c.id}/draft`,
    },
    {
      key: "eeat",
      label: "E-E-A-T",
      value: `${c.stats.eeatChecked}/3`,
      hint: c.stats.eeatChecked === 3 ? "all boxes checked" : "checklist incomplete",
      tone: c.stats.eeatChecked === 3 ? "positive" : "negative",
      href: `/dashboard/w/content/${c.id}/checklist`,
    },
    {
      key: "words",
      label: "Words",
      value: c.stats.wordCount,
      hint: c.stats.wordCount === 0 ? "empty draft" : "in body",
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: c }) => (
        <>
          <ContentWorkspaceListeners contentId={c.id} />
          <OverviewBody item={c} />
        </>
      ),
    },
    {
      key: "draft",
      label: "Draft",
      icon: PenSquare,
      render: ({ object: c }) => (
        <>
          <ContentWorkspaceListeners contentId={c.id} />
          <DraftBody item={c} />
        </>
      ),
    },
    {
      key: "checklist",
      label: "Checklist",
      icon: ShieldCheck,
      render: ({ object: c }) => (
        <>
          <ContentWorkspaceListeners contentId={c.id} />
          <ChecklistBody item={c} />
        </>
      ),
    },
    {
      key: "activity",
      label: "Activity",
      icon: Activity,
      render: ({ object: c }) => (
        <>
          <ContentWorkspaceListeners contentId={c.id} />
          <ActivityBody item={c} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: c }) => (
        <>
          <ContentWorkspaceListeners contentId={c.id} />
          <CopilotBody item={c} />
        </>
      ),
    },
  ],

  activity: (c) => ({
    async entries() {
      const rows: { id: string; at: string; kind: string; message: string; href?: string }[] = [
        { id: `c-${c.id}`, at: c.created_at, kind: "content", message: `Draft created · ${c.title || "Untitled"}` },
      ];
      if (c.approved_at) {
        rows.push({
          id: `a-${c.id}`,
          at: c.approved_at,
          kind: "content",
          message: c.status === "published" ? "Approved (later published)" : "Approved",
        });
      }
      return rows;
    },
  }),

  related: (c) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: c.brand.id, label: c.brand.name, relation: "belongs_to" });
      if (c.prompt) {
        nodes.push({
          kind: "prompt",
          id: c.prompt.id,
          label: c.prompt.text.length > 60 ? c.prompt.text.slice(0, 60) + "…" : c.prompt.text,
          relation: "targets",
        });
      }
      return nodes;
    },
  }),

  quickActions: (c) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Send;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
      href?: string;
    }> = [];
    if (c.status === "draft") {
      actions.push({
        id: "review",
        label: "Send to review",
        icon: Send,
        keyboard: "r",
        variant: "primary",
        event: { name: "content:set-status", detail: { contentId: c.id, status: "in_review" } },
      });
    }
    if (c.status === "in_review") {
      actions.push({
        id: "back-to-draft",
        label: "Back to draft",
        icon: PenSquare,
        keyboard: "b",
        event: { name: "content:set-status", detail: { contentId: c.id, status: "draft" } },
      });
    }
    if (c.status === "approved") {
      actions.push({
        id: "publish",
        label: "Mark published",
        icon: Rocket,
        keyboard: "p",
        variant: "primary",
        event: { name: "content:set-status", detail: { contentId: c.id, status: "published" } },
      });
    }
    // Approve action deliberately not surfaced here — the checklist tab
    // owns the E-E-A-T gate + approve button so the operator can't skip
    // reading the blockers.
    if (c.status !== "approved" && c.status !== "published") {
      actions.push({
        id: "check",
        label: "Review checklist",
        icon: Eye,
        keyboard: "c",
        href: `/dashboard/w/content/${c.id}/checklist`,
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "content:share", detail: { contentId: c.id } },
    });
    return actions;
  },

  copilotContext: (c) => ({
    kind: "content",
    id: c.id,
    label: c.title || "Untitled draft",
    summary: `Content draft "${c.title || "Untitled"}" for brand ${c.brand.name}${c.prompt ? ` targeting prompt "${c.prompt.text.slice(0, 80)}"` : ""}. Status ${c.status}. ${c.stats.wordCount} words, ${c.stats.placeholderCount} placeholder(s), E-E-A-T ${c.stats.eeatChecked}/3.`,
    hints: [
      "Suggest edits from the actual draft body only — no inventions.",
      "Keep [ADD ...] placeholders when specifics belong to the owner.",
      "Explain WHY each suggestion helps AEO citability, briefly.",
    ],
  }),

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: true,
  },
});

export default contentWorkspace;
