import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import BrandCookieSync from "@/components/dashboard/BrandCookieSync";

// ============================================================
// Brand-scoped layout — the anchor of the /b/[slug]/** URL grammar.
//
// Resolves the slug via the cookie (RLS-scoped) client. If the brand
// doesn't exist OR the current user isn't a member of its org, the
// query returns null and we render the standard 404 (leak-free — same
// response for "no such brand" as "not yours", so cross-org existence
// stays hidden).
//
// After resolving, <BrandCookieSync> nudges the `selected_brand_id`
// cookie into agreement with the URL so unmigrated pages
// (/dashboard/site-audit, /dashboard/alerts, /api/** handlers) still
// find the right brand on subsequent navigations. See BrandCookieSync
// for why this can't live in the layout as `cookies().set()`.
// ============================================================

export default async function BrandScopedLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return (
    <>
      <BrandCookieSync brandId={brand.id} />
      {children}
    </>
  );
}
