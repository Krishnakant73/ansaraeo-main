import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import GeoLintClient from "@/app/dashboard/geo-lint/GeoLintClient";

export const dynamic = "force-dynamic";

export default async function GeoLintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return <GeoLintClient />;
}
