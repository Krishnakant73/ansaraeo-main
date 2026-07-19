import { notFound } from "next/navigation";
import "@/workspace/workspaces";
import { get as getDescriptor } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// /dashboard/w/[kind]/[slug]
// Renders the workspace's default (first) tab. Deeper URLs
// (/w/[kind]/[slug]/[tab]) land in the sibling [tab]/page.tsx.
// ============================================================

export const dynamic = "force-dynamic";

export default async function WorkspaceDefaultTab({
  params,
}: {
  params: Promise<{ kind: string; slug: string }>;
}) {
  const { kind, slug } = await params;
  const descriptor = getDescriptor(kind);
  if (!descriptor) notFound();

  const supabase = await createClient();
  const object = await descriptor.loader({
    slug,
    params: { kind, slug },
    supabase,
  });
  if (object === null || object === undefined) notFound();

  const tab = descriptor.tabs[0];
  if (!tab) notFound();

  const rendered = await tab.render({
    object,
    params: { kind, slug },
    searchParams: new URLSearchParams(),
  });
  return <>{rendered}</>;
}
