import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import AnswerBlocksClient from "@/app/dashboard/answer-blocks/AnswerBlocksClient";

export const dynamic = "force-dynamic";

export default async function AnswerBlocksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return <AnswerBlocksClient brandId={brand.id} />;
}
