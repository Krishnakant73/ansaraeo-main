import {
  LayoutDashboard, ClipboardList, Bot, RotateCcw, Share2,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getSiteAuditById, scoreTone, timeAgo,
  type SiteAudit,
} from "@/lib/site-audit-workspace";

import OverviewBody from "./tabs/overview";
import FindingsBody from "./tabs/findings";
import CopilotBody from "./tabs/copilot";
import SiteAuditWorkspaceListeners from "./SiteAuditWorkspaceListeners.client";

// ============================================================
// Site Audit workspace descriptor.
//
// Seventeenth UWE kind. Site audits are immutable snapshots
// (migration_004). Three tabs: overview · findings · copilot.
// "Re-run" quick action POSTs to /api/site-audit which creates a
// new row, then the listener navigates to it. No PATCH — audits
// don't mutate.
// ============================================================

function healthFromAudit(a: SiteAudit): "healthy" | "warning" | "critical" | "unknown" {
  if (a.overall_score == null) return "unknown";
  if (a.stats.failCount > 3 || a.overall_score < 50) return "critical";
  if (a.stats.failCount > 0 || a.overall_score < 80) return "warning";
  return "healthy";
}

const siteAuditWorkspace = defineWorkspace<SiteAudit>({
  kind: "site-audit",
  slugParam: "slug",

  async loader({ slug }) {
    return await getSiteAuditById(slug);
  },

  header: (a) => ({
    title: `Site audit · ${a.brand.name}`,
    subtitle: a.brand.domain ?? undefined,
    status: a.overall_score == null ? "unscored" : `${a.overall_score}/100`,
    statusTone:
      a.overall_score == null
        ? "neutral"
        : a.overall_score >= 80
          ? "accent"
          : a.overall_score >= 50
            ? "warning"
            : "danger",
    health: healthFromAudit(a),
    chips: [
      { label: "Brand", value: a.brand.name },
      { label: "Run", value: timeAgo(a.run_at) },
      { label: "Checks", value: String(a.stats.issueCount) },
    ],
  }),

  summary: (a) => [
    {
      key: "overall",
      label: "Overall",
      value: a.overall_score == null ? "—" : a.overall_score,
      hint: "out of 100",
      delta: a.stats.overallDelta ?? undefined,
      deltaFormat: "raw",
      tone: scoreTone(a.overall_score),
    },
    {
      key: "fails",
      label: "Failing checks",
      value: a.stats.failCount,
      hint: a.stats.failCount === 0 ? "clean" : "fix these first",
      tone: a.stats.failCount === 0 ? "positive" : "negative",
      href: `/dashboard/w/site-audit/${a.id}/findings`,
    },
    {
      key: "schema",
      label: "Schema markup",
      value: a.schema_markup_score == null ? "—" : a.schema_markup_score,
      hint: "JSON-LD & structured data",
      tone: scoreTone(a.schema_markup_score),
    },
    {
      key: "crawl",
      label: "Crawlability",
      value: a.crawlability_score == null ? "—" : a.crawlability_score,
      hint: "robots.txt + accessibility",
      tone: scoreTone(a.crawlability_score),
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: a }) => (
        <>
          <SiteAuditWorkspaceListeners auditId={a.id} brandId={a.brand_id} />
          <OverviewBody audit={a} />
        </>
      ),
    },
    {
      key: "findings",
      label: "Findings",
      icon: ClipboardList,
      render: ({ object: a }) => (
        <>
          <SiteAuditWorkspaceListeners auditId={a.id} brandId={a.brand_id} />
          <FindingsBody audit={a} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: a }) => (
        <>
          <SiteAuditWorkspaceListeners auditId={a.id} brandId={a.brand_id} />
          <CopilotBody audit={a} />
        </>
      ),
    },
  ],

  timeline: (a) => ({
    async entries() {
      return [
        {
          id: `sa-${a.id}`,
          at: a.run_at,
          kind: "scan",
          message: `Audit run · ${a.stats.issueCount} check(s), ${a.stats.failCount} failing`,
        },
      ];
    },
  }),

  related: (a) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: a.brand.id, label: a.brand.name, relation: "belongs_to" });
      // Sibling audits for the same brand (previous snapshots).
      const supabase = await createClient();
      const { data: siblings } = await supabase
        .from("site_audits")
        .select("id, run_at, overall_score")
        .eq("brand_id", a.brand_id)
        .neq("id", a.id)
        .order("run_at", { ascending: false })
        .limit(3);
      for (const s of (siblings as { id: string; run_at: string; overall_score: number | null }[] | null) ?? []) {
        nodes.push({
          kind: "site-audit",
          id: s.id,
          label: `${s.overall_score ?? "—"}/100 · ${timeAgo(s.run_at)}`,
          relation: "prior_snapshot",
        });
      }
      return nodes;
    },
  }),

  quickActions: (a) => [
    {
      id: "rerun",
      label: "Re-run",
      icon: RotateCcw,
      keyboard: "r",
      variant: "primary",
      event: { name: "site-audit:rerun", detail: { auditId: a.id } },
    },
    {
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "site-audit:share", detail: { auditId: a.id } },
    },
  ],

  copilotContext: (a) => ({
    kind: "site-audit",
    id: a.id,
    label: `Site audit for ${a.brand.name}`,
    summary: `Site audit snapshot for ${a.brand.name} from ${timeAgo(a.run_at)}. Overall ${a.overall_score ?? "—"}/100. ${a.stats.failCount} failing, ${a.stats.warnCount} warning, ${a.stats.passCount} passing. llms.txt ${a.llms_txt_present ? "present" : a.llms_txt_present === false ? "missing" : "unknown"}.`,
    hints: [
      "Answer from the audit row (scores + issues array) only.",
      "Never invent checks that aren't in the issues list.",
      "When suggesting fixes, prefer the check's own `fix` field verbatim.",
    ],
  }),

  async list({ limit }) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_audits")
      .select("id, brand_id, run_at, overall_score")
      .order("run_at", { ascending: false })
      .limit(limit ?? 50);
    const rows = (data as { id: string; brand_id: string; run_at: string; overall_score: number | null }[] | null) ?? [];
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
      label: `${brandNames.get(r.brand_id) ?? "brand"} · audit`,
      sublabel: `${r.overall_score ?? "—"}/100 · ${timeAgo(r.run_at)}`,
    }));
  },

  capabilities: {
    share: true,
    export: true,
    delete: false,
    api: true,
  },
});

export default siteAuditWorkspace;
