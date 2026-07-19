import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import "@/workspace/workspaces"; // side-effect: populates the registry
import { get as getDescriptor } from "@/workspace/core";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/workspace/shell/WorkspaceShell";

// ============================================================
// /dashboard/w/[kind]/[slug]/layout.tsx
// Resolves the workspace descriptor for the URL, calls its loader, and
// renders the shell. Children are the active tab's page render.
//
// Step 1: no kinds are registered, so this route always 404s. Wiring
// stays here so registering a workspace is a one-file change.
// ============================================================

export const dynamic = "force-dynamic";

export default async function WorkspaceKindSlugLayout({
  params,
  children,
}: {
  params: Promise<{ kind: string; slug: string }>;
  children: ReactNode;
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

  return (
    <WorkspaceShell
      descriptor={descriptor}
      object={object}
      baseHref={`/dashboard/w/${kind}/${slug}`}
    >
      {children}
    </WorkspaceShell>
  );
}
