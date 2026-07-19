import { getSelectedBrand } from "@/lib/selected-brand";
import PromptSuiteClient from "./PromptSuiteClient";

export default async function PromptSuitePage() {
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div className="card p-6">
        <p className="text-sm text-muted">No brand selected. Set up or select a brand first.</p>
      </div>
    );
  }

  return <PromptSuiteClient brandId={brand.id} />;
}
