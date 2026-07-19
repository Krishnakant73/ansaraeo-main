import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import PromptSuiteClient from "@/app/dashboard/prompt-suite/PromptSuiteClient";

export const dynamic = "force-dynamic";

export default async function PromptSuitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return <PromptSuiteClient brandId={brand.id} />;
}
