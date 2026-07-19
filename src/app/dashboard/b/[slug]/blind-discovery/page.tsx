import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import BlindDiscoveryClient from "@/app/dashboard/blind-discovery/BlindDiscoveryClient";

export const dynamic = "force-dynamic";

export default async function BlindDiscoveryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  // Chat-completion engines suited to repeated sampling (google_ai_overview
  // is a SERP scrape and is intentionally excluded).
  const engines = ["chatgpt", "perplexity", "gemini", "grok", "copilot"];

  return <BlindDiscoveryClient brandId={brand.id} brandName={brand.name} engines={engines} />;
}
