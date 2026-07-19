import {
  LayoutDashboard, KeyRound, Bot, Play, Pause, Ban, Share2, Settings,
} from "lucide-react";
import { defineWorkspace } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import {
  getIntegrationById, providerHelpUrl, providerLabel, statusTone, timeAgo,
  type Integration,
} from "@/lib/integration-workspace";

import OverviewBody from "./tabs/overview";
import CredentialsBody from "./tabs/credentials";
import CopilotBody from "./tabs/copilot";
import IntegrationWorkspaceListeners from "./IntegrationWorkspaceListeners.client";

// ============================================================
// Integration workspace descriptor.
//
// Sixteenth UWE kind. Integrations are brand-scoped rows in
// migration_008. Three tabs: overview · credentials · copilot.
// Credentials tab surfaces SHAPE only — never decrypted values.
// PATCH endpoint only mutates status; reconnect (encrypted write)
// happens on the provider settings page.
// ============================================================

function healthFromIntegration(i: Integration): "healthy" | "warning" | "critical" | "unknown" {
  if (i.status === "connected" && i.stats.isEncrypted) return "healthy";
  if (i.status !== "connected") return "critical";
  if (!i.stats.isEncrypted && i.stats.credentialKeyCount > 0) return "warning";
  return "unknown";
}

const integrationWorkspace = defineWorkspace<Integration>({
  kind: "integration",
  slugParam: "slug",

  async loader({ slug }) {
    return await getIntegrationById(slug);
  },

  header: (i) => ({
    title: `${providerLabel(i.provider)} · ${i.brand.name}`,
    subtitle: i.brand.domain ?? undefined,
    status: i.status,
    statusTone: i.status === "connected" ? "accent" : "danger",
    health: healthFromIntegration(i),
    chips: [
      { label: "Provider", value: i.provider },
      { label: "Brand", value: i.brand.name },
      { label: "Connected", value: timeAgo(i.connected_at) },
    ],
  }),

  summary: (i) => [
    {
      key: "status",
      label: "Status",
      value: i.status,
      hint: i.status === "connected" ? "healthy" : "needs attention",
      tone: statusTone(i.status),
    },
    {
      key: "encryption",
      label: "Encryption",
      value: i.stats.isEncrypted ? "yes" : "no",
      hint: i.stats.isEncrypted ? "AES-256-GCM envelope" : "plaintext (legacy)",
      tone: i.stats.isEncrypted ? "positive" : "negative",
    },
    {
      key: "age",
      label: "Age",
      value: `${i.stats.ageInDays}d`,
      hint: "since connected",
    },
    {
      key: "provider",
      label: "Provider",
      value: i.provider,
      hint: providerLabel(i.provider),
    },
  ],

  tabs: [
    {
      key: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      render: ({ object: i }) => (
        <>
          <IntegrationWorkspaceListeners integrationId={i.id} />
          <OverviewBody integration={i} />
        </>
      ),
    },
    {
      key: "credentials",
      label: "Credentials",
      icon: KeyRound,
      render: ({ object: i }) => (
        <>
          <IntegrationWorkspaceListeners integrationId={i.id} />
          <CredentialsBody integration={i} />
        </>
      ),
    },
    {
      key: "copilot",
      label: "Copilot",
      icon: Bot,
      render: ({ object: i }) => (
        <>
          <IntegrationWorkspaceListeners integrationId={i.id} />
          <CopilotBody integration={i} />
        </>
      ),
    },
  ],

  timeline: (i) => ({
    async entries() {
      return [
        {
          id: `int-${i.id}`,
          at: i.connected_at,
          kind: "content",
          message: `${providerLabel(i.provider)} connected`,
        },
      ];
    },
  }),

  related: (i) => ({
    async nodes() {
      const nodes: { kind: string; id: string; label: string; relation: string }[] = [];
      nodes.push({ kind: "brand", id: i.brand.id, label: i.brand.name, relation: "belongs_to" });
      // Surface sibling integrations on the same brand.
      const supabase = await createClient();
      const { data: siblings } = await supabase
        .from("integrations")
        .select("id, provider")
        .eq("brand_id", i.brand_id)
        .neq("id", i.id)
        .limit(4);
      for (const s of (siblings as { id: string; provider: string }[] | null) ?? []) {
        nodes.push({
          kind: "integration",
          id: s.id,
          label: providerLabel(s.provider),
          relation: "sibling",
        });
      }
      return nodes;
    },
  }),

  quickActions: (i) => {
    const actions: Array<{
      id: string;
      label: string;
      icon: typeof Play;
      keyboard?: string;
      variant?: "primary" | "ghost" | "danger";
      event?: { name: string; detail: unknown };
      href?: string;
    }> = [];
    actions.push({
      id: "reconnect",
      label: "Reconnect",
      icon: Settings,
      keyboard: "r",
      variant: "primary",
      href: providerHelpUrl(i.provider, i.brand.slug),
    });
    if (i.status === "connected") {
      actions.push({
        id: "pause",
        label: "Pause",
        icon: Pause,
        keyboard: "p",
        event: { name: "integration:mark-status", detail: { integrationId: i.id, status: "paused" } },
      });
    } else if (i.status === "paused") {
      actions.push({
        id: "resume",
        label: "Resume",
        icon: Play,
        keyboard: "u",
        event: { name: "integration:mark-status", detail: { integrationId: i.id, status: "connected" } },
      });
    }
    if (i.status !== "revoked") {
      actions.push({
        id: "revoke",
        label: "Revoke",
        icon: Ban,
        keyboard: "x",
        variant: "danger",
        event: { name: "integration:mark-status", detail: { integrationId: i.id, status: "revoked" } },
      });
    }
    actions.push({
      id: "share",
      label: "Share",
      icon: Share2,
      keyboard: "s",
      event: { name: "integration:share", detail: { integrationId: i.id } },
    });
    return actions;
  },

  copilotContext: (i) => ({
    kind: "integration",
    id: i.id,
    label: `${providerLabel(i.provider)} for ${i.brand.name}`,
    summary: `${providerLabel(i.provider)} integration on brand ${i.brand.name}. Status ${i.status}. ${i.stats.isEncrypted ? "Encrypted credentials." : "Plaintext credentials (legacy)."} Connected ${timeAgo(i.connected_at)}.`,
    hints: [
      "Answer from the integration row only.",
      "Never claim to see decrypted credential values.",
      "Never invent scopes, tokens, or provider capabilities.",
    ],
  }),

  async list({ limit }) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("integrations")
      .select("id, provider, status, brand_id")
      .order("connected_at", { ascending: false })
      .limit(limit ?? 50);
    const rows = (data as { id: string; provider: string; status: string; brand_id: string }[] | null) ?? [];
    // Resolve brand names in one round-trip.
    const brandIds = Array.from(new Set(rows.map((r) => r.brand_id)));
    const brandNames = new Map<string, string>();
    if (brandIds.length > 0) {
      const { data: bs } = await supabase
        .from("brands")
        .select("id, name")
        .in("id", brandIds);
      for (const b of (bs as { id: string; name: string }[] | null) ?? []) {
        brandNames.set(b.id, b.name);
      }
    }
    return rows.map((r) => ({
      id: r.id,
      label: `${providerLabel(r.provider)} · ${brandNames.get(r.brand_id) ?? "brand"}`,
      sublabel: r.status,
    }));
  },

  capabilities: {
    share: true,
    export: false,
    delete: false,
    api: true,
  },
});

export default integrationWorkspace;
