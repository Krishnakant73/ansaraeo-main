import { LayoutDashboard, Users, Bot, Copy, Ban } from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { getShareByToken, timeAgo, type ShareToken } from "@/lib/share-workspace";

import OverviewBody from "./tabs/overview";
import AccessBody from "./tabs/access";
import CopilotBody from "./tabs/copilot";
import ShareWorkspaceListeners from "./ShareWorkspaceListeners.client";

// ============================================================
// Share workspace descriptor. Twelfth kind.
// Slug = share_view_tokens.token (a uuid). Two tabs — overview
// (URL + status + expiry countdown) and access (audit-friendly
// key/value view). No editing surface — this object is either
// live, expired, or revoked; changes are just revoke.
// ============================================================

function healthFromShare(s: ShareToken): "healthy" | "warning" | "critical" | "unknown" {
  if (s.revoked) return "critical";
  if (s.stats.isExpired) return "warning";
  if (s.stats.daysUntilExpiry != null && s.stats.daysUntilExpiry <= 1) return "warning";
  return "healthy";
}

const shareWorkspace = defineWorkspace<ShareToken>({
  kind: "share",
  slugParam: "slug",

  async loader({ slug }) {
    return await getShareByToken(slug);
  },

  header: (s) => ({
    title: `Report link · ${s.brand.name}`,
    subtitle: `Public snapshot of ${s.brand.name}'s report. Expires ${new Date(s.expires_at).toLocaleDateString()}.`,
    status: s.revoked ? "Revoked" : s.stats.isExpired ? "Expired" : "Live",
    statusTone: s.revoked || s.stats.isExpired ? "danger" : "accent",
    health: healthFromShare(s),
    chips: [
      { label: "Brand", value: s.brand.name },
      { label: "Created", value: timeAgo(s.created_at) },
      {
        label: "Expires",
        value:
          s.stats.daysUntilExpiry != null
            ? s.stats.daysUntilExpiry >= 0
              ? `in ${s.stats.daysUntilExpiry}d`
              : `${Math.abs(s.stats.daysUntilExpiry)}d ago`
            : "unknown",
      },
    ],
  }),

  summary: (s) => [
    {
      key: "state",
      label: "State",
      value: s.revoked ? "Revoked" : s.stats.isExpired ? "Expired" : "Live",
      hint:
        s.revoked
          ? "URL disabled"
          : s.stats.isExpired
            ? "past expiry"
            : "URL works",
      tone: s.revoked || s.stats.isExpired ? "negative" : "positive",
    },
    {
      key: "days-left",
      label: "Days left",
      value:
        s.stats.daysUntilExpiry == null
          ? "—"
          : s.stats.daysUntilExpiry < 0
            ? `${Math.abs(s.stats.daysUntilExpiry)} over`
            : s.stats.daysUntilExpiry,
      hint: "before expiry",
      tone:
        s.stats.daysUntilExpiry != null && s.stats.daysUntilExpiry <= 1 ? "negative" : undefined,
    },
    {
      key: "age",
      label: "Age",
      value: s.stats.ageInDays == null ? "—" : `${s.stats.ageInDays}d`,
      hint: "since created",
    },
    {
      key: "path",
      label: "URL",
      value: "share/report/…",
      hint: "click Copy in quick actions",
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: s }) => (
        <>
          <ShareWorkspaceListeners token={s.token} />
          <OverviewBody share={s} />
        </>
      ),
    },
    {
      key: "access",
      label: "Access",
      icon: Users,
      render: ({ object: s }) => (
        <>
          <ShareWorkspaceListeners token={s.token} />
          <AccessBody share={s} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: s }) => (
        <>
          <ShareWorkspaceListeners token={s.token} />
          <CopilotBody share={s} />
        </>
      ),
    },
  ],

  activity: (s) => ({
    async entries() {
      const rows: { id: string; at: string; kind: string; message: string }[] = [];
      rows.push({
        id: `c-${s.token}`,
        at: s.created_at,
        kind: "share",
        message: `Share link created`,
      });
      if (s.revoked) {
        rows.push({
          id: `r-${s.token}`,
          at: s.expires_at, // best-approximation timestamp; the table doesn't store a revoke ts
          kind: "share",
          message: "Link revoked",
        });
      }
      return rows;
    },
  }),

  related: (s) => ({
    async nodes() {
      return [{ kind: "brand", id: s.brand.id, label: s.brand.name, relation: "belongs_to" }];
    },
  }),

  quickActions: (s) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Copy;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
    }> = [];
    if (!s.revoked && !s.stats.isExpired) {
      actions.push({
        id: "copy",
        label: "Copy URL",
        icon: Copy,
        keyboard: "c",
        variant: "primary",
        event: { name: "share:copy", detail: { token: s.token } },
      });
    }
    if (!s.revoked) {
      actions.push({
        id: "revoke",
        label: "Revoke",
        icon: Ban,
        keyboard: "r",
        variant: "danger",
        event: { name: "share:revoke", detail: { token: s.token } },
      });
    }
    return actions;
  },

  copilotContext: (s) => ({
    kind: "share",
    id: s.token,
    label: `Report link · ${s.brand.name}`,
    summary: `Public share link for brand ${s.brand.name}. ${s.revoked ? "Revoked." : s.stats.isExpired ? "Expired." : `Live, expires in ${s.stats.daysUntilExpiry}d.`} Created ${timeAgo(s.created_at)}.`,
    hints: [
      "Answer from the share row and brand row only.",
      "Never invent recipient identity — the table doesn't record who opened the link.",
    ],
  }),

  capabilities: {
    share: false,
    export: false,
    delete: true,
    api: false,
  },
});

export default shareWorkspace;
