import {
  LayoutDashboard, Bot, CheckCircle2, XCircle, RotateCcw, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getApprovalById, statusChipClass, targetLabel, timeAgo,
  type Approval,
} from "@/lib/approval-workspace";

import OverviewBody from "./tabs/overview";
import CopilotBody from "./tabs/copilot";
import ApprovalWorkspaceListeners from "./ApprovalWorkspaceListeners.client";

// ============================================================
// Approval workspace descriptor.
//
// Eighteenth UWE kind. Approvals gate deploys (migration_021).
// Two tabs: overview · copilot. Approve/reject are serializable
// events; rejection prompts for a note client-side. PATCH endpoint
// stamps decided_by + decided_at atomically.
// ============================================================

function healthFromApproval(a: Approval): "healthy" | "warning" | "critical" | "unknown" {
  if (a.status === "approved") return "healthy";
  if (a.status === "rejected") return "critical";
  if (a.stats.ageInHours > 48) return "critical";
  if (a.stats.ageInHours > 24) return "warning";
  return "unknown";
}

// Prevent the descriptor from emitting an unused symbol warning by
// referencing statusChipClass through TS type inference at build
// time. It's actually consumed in overview.tsx; keep this line off.
void statusChipClass;

const approvalWorkspace = defineWorkspace<Approval>({
  kind: "approval",
  slugParam: "slug",

  async loader({ slug }) {
    return await getApprovalById(slug);
  },

  header: (a) => ({
    title: targetLabel(a.target),
    subtitle: `Requires ${a.approver_role} sign-off`,
    status: a.status,
    statusTone:
      a.status === "approved"
        ? "accent"
        : a.status === "rejected"
          ? "danger"
          : a.stats.ageInHours > 24
            ? "warning"
            : "neutral",
    health: healthFromApproval(a),
    chips: [
      { label: "Brand", value: a.brand.name },
      { label: "Approver", value: a.approver_role },
      { label: "Requested", value: timeAgo(a.created_at) },
    ],
  }),

  summary: (a) => [
    {
      key: "status",
      label: "Status",
      value: a.status,
      hint: a.status === "pending" ? "awaiting decision" : "decided",
      tone:
        a.status === "approved"
          ? "positive"
          : a.status === "rejected"
            ? "negative"
            : undefined,
    },
    {
      key: "age",
      label: "Age",
      value: a.stats.ageInHours < 24 ? `${a.stats.ageInHours}h` : `${Math.floor(a.stats.ageInHours / 24)}d`,
      hint: a.stats.isPending ? "since requested" : "at time of decision",
      tone: a.stats.isPending && a.stats.ageInHours > 24 ? "negative" : undefined,
    },
    {
      key: "to-decision",
      label: "Decision time",
      value: a.stats.hoursToDecision == null ? "—" : `${a.stats.hoursToDecision}h`,
      hint: a.stats.hoursToDecision == null ? "not decided" : "requested → decided",
    },
    {
      key: "role",
      label: "Approver role",
      value: a.approver_role,
      hint: "must sign off",
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: a }) => (
        <>
          <ApprovalWorkspaceListeners approvalId={a.id} />
          <OverviewBody approval={a} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: a }) => (
        <>
          <ApprovalWorkspaceListeners approvalId={a.id} />
          <CopilotBody approval={a} />
        </>
      ),
    },
  ],

  timeline: (a) => ({
    async entries() {
      const rows = [
        {
          id: `a-c-${a.id}`,
          at: a.created_at,
          kind: "approval",
          message: `Approval requested · ${a.approver_role}`,
        },
      ];
      if (a.decided_at) {
        rows.push({
          id: `a-d-${a.id}`,
          at: a.decided_at,
          kind: "approval",
          message: `Approval ${a.status}${a.note ? ` — ${a.note.slice(0, 80)}` : ""}`,
        });
      }
      return rows;
    },
  }),

  related: (a) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: a.brand.id, label: a.brand.name, relation: "belongs_to" });
      if (a.target?.kind === "task") {
        nodes.push({ kind: "task", id: a.target.id, label: a.target.title, relation: "gates" });
        nodes.push({
          kind: "mission",
          id: a.target.mission_id,
          label: "Parent mission",
          relation: "part_of",
        });
      } else if (a.target?.kind === "content") {
        nodes.push({
          kind: "content",
          id: a.target.id,
          label: a.target.title ?? "Draft",
          relation: "gates",
        });
      }
      // Sibling pending approvals on the same brand.
      const supabase = await createClient();
      const { data: siblings } = await supabase
        .from("approvals")
        .select("id, approver_role, status")
        .eq("brand_id", a.brand_id)
        .neq("id", a.id)
        .eq("status", "pending")
        .limit(3);
      for (const s of (siblings as { id: string; approver_role: string; status: string }[] | null) ?? []) {
        nodes.push({
          kind: "approval",
          id: s.id,
          label: `Pending · ${s.approver_role}`,
          relation: "sibling_pending",
        });
      }
      return nodes;
    },
  }),

  quickActions: (a) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof CheckCircle2;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
    }> = [];
    if (a.status === "pending") {
      actions.push({
        id: "approve",
        label: "Approve",
        icon: CheckCircle2,
        keyboard: "a",
        variant: "primary",
        event: { name: "approval:mark-status", detail: { approvalId: a.id, status: "approved" } },
      });
      actions.push({
        id: "reject",
        label: "Reject",
        icon: XCircle,
        keyboard: "j",
        variant: "danger",
        event: { name: "approval:mark-status", detail: { approvalId: a.id, status: "rejected" } },
      });
    } else {
      actions.push({
        id: "reopen",
        label: "Re-open",
        icon: RotateCcw,
        keyboard: "u",
        event: { name: "approval:mark-status", detail: { approvalId: a.id, status: "pending" } },
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "approval:share", detail: { approvalId: a.id } },
    });
    return actions;
  },

  copilotContext: (a) => ({
    kind: "approval",
    id: a.id,
    label: targetLabel(a.target),
    summary: `Approval for ${targetLabel(a.target)} on brand ${a.brand.name}. Requires ${a.approver_role}. Status ${a.status}${a.status === "pending" ? ` · pending ${a.stats.ageInHours}h` : ""}${a.note ? ` · note: "${a.note}"` : ""}.`,
    hints: [
      "Answer from the approval row + target row only.",
      "Never invent a rejection reason not in the note field.",
      "Never approve on the user's behalf — surface what to inspect first.",
    ],
  }),

  async list({ limit }) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("approvals")
      .select("id, brand_id, approver_role, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    const rows = (data as { id: string; brand_id: string; approver_role: string; status: string; created_at: string }[] | null) ?? [];
    const brandIds = Array.from(new Set(rows.map((r) => r.brand_id)));
    const brandNames = new Map<string, string>();
    if (brandIds.length > 0) {
      const { data: bs } = await supabase.from("brands").select("id, name").in("id", brandIds);
      for (const b of (bs as { id: string; name: string }[] | null) ?? []) {
        brandNames.set(b.id, b.name);
      }
    }
    return rows.map((r) => ({
      id: r.id,
      label: `${brandNames.get(r.brand_id) ?? "brand"} · ${r.approver_role}`,
      sublabel: `${r.status} · ${timeAgo(r.created_at)}`,
    }));
  },

  capabilities: {
    share: true,
    export: false,
    delete: false,
    api: true,
  },
});

export default approvalWorkspace;
