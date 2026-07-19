import { notFound } from "next/navigation";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import TokenBloatClient from "@/app/dashboard/token-bloat/TokenBloatClient";

export const dynamic = "force-dynamic";

export default async function TokenBloatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  return (
    <div>
      <PageHeader
        title="Token Bloat Checker"
        subtitle="Estimates how many tokens an AI crawler (GPTBot / ClaudeBot / PerplexityBot) burns consuming a page, and pinpoints the bloat — inline scripts, utility CSS, framework data-* attributes, missing structured data — that gets your pages dropped from AI recommendations. Deterministic measurement (no LLM); token counts are approximate (~4 chars/token), but the ratios and flags are exact."
      />
      <div className="mt-6">
        <TokenBloatClient brandId={brand.id} brandDomain={brand.domain ?? undefined} />
      </div>
    </div>
  );
}
