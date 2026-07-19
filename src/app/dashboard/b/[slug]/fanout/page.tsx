import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import FanoutClient from "@/app/dashboard/fanout/FanoutClient";

export const dynamic = "force-dynamic";

// Page is analysis-only (nothing persisted), but we still enforce brand
// membership via getBrandFromSlug so the URL requires authorized access.
// The layout's <BrandCookieSync> keeps the cookie in sync so any API calls
// the client makes still resolve to the URL-authoritative brand.
export default async function FanoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return <FanoutClient />;
}
