import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import ReportsBody from "@/app/dashboard/w/brand/tabs/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();
  return <ReportsBody brand={brand} />;
}
