import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import CompetitorsBody from "@/app/dashboard/w/brand/tabs/competitors";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();
  return <CompetitorsBody brand={brand} />;
}
