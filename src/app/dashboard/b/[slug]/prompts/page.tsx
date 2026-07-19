import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import PromptsBody from "@/app/dashboard/w/brand/tabs/prompts";

export const dynamic = "force-dynamic";

export default async function PromptsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();
  return <PromptsBody brand={brand} />;
}
