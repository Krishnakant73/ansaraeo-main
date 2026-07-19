import { notFound } from "next/navigation";
import "@/workspace/workspaces";
import { get as getDescriptor } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// /dashboard/w/[kind]/[slug]/[tab]
// Looks up the descriptor tab by key and renders it. Unknown tab or
// gated (feature-locked) tab → 404.
// ============================================================

export const dynamic = "force-dynamic";

export default async function WorkspaceTab({
  params,
}: {
  params: Promise<{ kind: string; slug: string; tab: string }>;
}) {
  const { kind, slug, tab: tabKey } = await params;
  const descriptor = getDescriptor(kind);
  if (!descriptor) notFound();
  const tab = descriptor.tabs.find((t) => t.key === tabKey);
  if (!tab) notFound();

  const supabase = await createClient();
  const object = await descriptor.loader({
    slug,
    params: { kind, slug, tab: tabKey },
    supabase,
  });
  if (object === null || object === undefined) notFound();

  const rendered = await tab.render({
    object,
    params: { kind, slug, tab: tabKey },
    searchParams: new URLSearchParams(),
  });
  return <>{rendered}</>;
}
