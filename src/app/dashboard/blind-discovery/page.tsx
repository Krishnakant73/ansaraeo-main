import { getSelectedBrand } from "@/lib/selected-brand";
import BlindDiscoveryClient from "./BlindDiscoveryClient";

export default async function BlindDiscoveryPage() {
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div className="card p-6">
        <p className="text-sm text-muted">No brand selected. Set up or select a brand first.</p>
      </div>
    );
  }

  // Chat-completion engines suited to repeated sampling (google_ai_overview
  // is a SERP scrape and is intentionally excluded).
  const engines = ["chatgpt", "perplexity", "gemini", "grok", "copilot"];

  return <BlindDiscoveryClient brandId={brand.id} brandName={brand.name} engines={engines} />;
}
