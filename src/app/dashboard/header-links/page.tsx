import { getSelectedBrand } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import HeaderLinkGraphClient from "./HeaderLinkGraphClient";

export default async function HeaderLinksPage() {
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
        title="Header & Link Graph"
        subtitle="Reads each crawled page's HTTP response headers (not the body) to map the Link: relationship graph and surface per-page AI-discovery signals the homepage-only Site Audit can't: canonical presence, llms.txt/ai.txt advertisement, and per-URL AI-blocking via X-Robots-Tag (which robots.txt cannot express). Deterministic — no LLM, no estimation."
      />
      <div className="mt-6">
        <HeaderLinkGraphClient brandId={brand.id} />
      </div>
    </div>
  );
}
