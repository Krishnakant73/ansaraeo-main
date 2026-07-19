import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import TokenBloatClient from "./TokenBloatClient";

export default async function TokenBloatPage() {
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">Set up a brand first.</p>
      </div>
    );
  }

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
