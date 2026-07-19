import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import CampaignsBody from "@/app/dashboard/w/brand/tabs/campaigns";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();
  return <CampaignsBody brand={brand} />;
}
