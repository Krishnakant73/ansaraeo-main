// ============================================================
// Approval workspace loader + shape.
//
// Approvals live in migration_021. Each approval hangs off EITHER
// a task OR a content_item (never both), and is role-gated by
// `approver_role` (default 'admin'). Status: pending|approved|
// rejected. Once decided, `decided_by` + `decided_at` are set.
//
// getApprovalById(id) — cookie-scoped, RLS-safe, null → 404.
// Embeds the parent brand + the target (task or content) so the
// header can link out.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export type ApprovalStats = {
  ageInHours: number;
  isPending: boolean;
  hoursToDecision: number | null;
};

export type ApprovalBrand = {
  id: string;
  name: string;
  slug: string;
};

export type ApprovalTarget =
  | { kind: "task"; id: string; title: string; mission_id: string }
  | { kind: "content"; id: string; title: string | null }
  | null;

export type Approval = {
  id: string;
  brand_id: string;
  task_id: string | null;
  content_item_id: string | null;
  requested_by: string | null;
  approver_role: string;
  status: string;             // pending|approved|rejected
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  created_at: string;
  brand: ApprovalBrand;
  target: ApprovalTarget;
  stats: ApprovalStats;
};

const BRAND_COLUMNS = "id, name, slug";

export async function getApprovalById(id: string): Promise<Approval | null> {
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("approvals")
    .select(
      "id, brand_id, task_id, content_item_id, requested_by, approver_role, status, decided_by, decided_at, note, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!a) return null;

  const approval = a as Omit<Approval, "brand" | "target" | "stats">;

  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", approval.brand_id)
    .maybeSingle();
  if (!brand) return null;

  let target: ApprovalTarget = null;
  if (approval.task_id) {
    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, mission_id")
      .eq("id", approval.task_id)
      .maybeSingle();
    if (task) {
      const t = task as { id: string; title: string; mission_id: string };
      target = { kind: "task", id: t.id, title: t.title, mission_id: t.mission_id };
    }
  } else if (approval.content_item_id) {
    const { data: content } = await supabase
      .from("content_items")
      .select("id, title")
      .eq("id", approval.content_item_id)
      .maybeSingle();
    if (content) {
      const c = content as { id: string; title: string | null };
      target = { kind: "content", id: c.id, title: c.title };
    }
  }

  const now = Date.now();
  const createdMs = new Date(approval.created_at).getTime();
  const ageInHours = Math.max(0, Math.floor((now - createdMs) / 3_600_000));
  const hoursToDecision = approval.decided_at
    ? Math.max(0, Math.floor((new Date(approval.decided_at).getTime() - createdMs) / 3_600_000))
    : null;

  return {
    ...approval,
    brand: brand as ApprovalBrand,
    target,
    stats: {
      ageInHours,
      isPending: approval.status === "pending",
      hoursToDecision,
    },
  };
}

export function statusChipClass(status: string): string {
  switch (status) {
    case "approved":
      return "chip border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "chip border-rose-200 bg-rose-50 text-rose-600";
    case "pending":
      return "chip border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "chip";
  }
}

export function targetLabel(target: ApprovalTarget): string {
  if (!target) return "Unknown target";
  if (target.kind === "task") return `Task · ${target.title}`;
  return `Content · ${target.title ?? "Untitled draft"}`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
