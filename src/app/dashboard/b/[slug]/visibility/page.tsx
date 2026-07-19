import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import VisibilityBody from "@/app/dashboard/w/brand/tabs/visibility";

export const dynamic = "force-dynamic";

// ============================================================
// /dashboard/b/[slug]/visibility — Brand › Visibility.
//
// Step 3 fold: this is now a thin wrapper that resolves the brand
// and delegates rendering to the shared workspace tab body. The
// workspace tab under /dashboard/w/brand/[slug]/visibility renders
// the same content.
// ============================================================

export default async function BrandVisibilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return <VisibilityBody brand={brand} slug={slug} />;
}
