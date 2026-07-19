import { getSelectedBrand } from "@/lib/selected-brand";
import ContentOptimizerClient from "./ContentOptimizerClient";

export default async function Page() {
  const { brand } = await getSelectedBrand();
  if (!brand) {
    return <p className="text-sm text-muted">Set up a brand first.</p>;
  }
  return <ContentOptimizerClient brandId={brand.id} brandName={brand.name} />;
}
