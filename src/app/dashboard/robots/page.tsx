import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import RobotsValidatorClient from "./RobotsValidatorClient";

export default async function RobotsValidatorPage() {
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
        title="Robots.txt Validator"
        subtitle="Parses your live robots.txt with a spec-accurate engine (group resolution, */$ wildcards, longest-rule-wins) and reports, per named AI crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …), whether your homepage and sitemap are allowed or disallowed. Deterministic — no LLM, no estimation. Fixes the simplified regex check used elsewhere in the product."
      />
      <div className="mt-6">
        <RobotsValidatorClient brandId={brand.id} brandDomain={brand.domain ?? undefined} />
      </div>
    </div>
  );
}
