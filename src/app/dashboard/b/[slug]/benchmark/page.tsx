import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import BenchmarkBody from "@/app/dashboard/w/brand/tabs/benchmark";

export const dynamic = "force-dynamic";

export default async function BenchmarkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();
  return <BenchmarkBody brand={brand} />;
}
