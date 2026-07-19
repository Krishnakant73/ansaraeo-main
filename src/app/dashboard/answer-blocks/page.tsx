import { getSelectedBrand } from "@/lib/selected-brand";
import AnswerBlocksClient from "./AnswerBlocksClient";

export default async function AnswerBlocksPage() {
  const { brand } = await getSelectedBrand();

  if (!brand) {
    return (
      <div className="card p-6">
        <p className="text-sm text-muted">No brand selected. Set up or select a brand first.</p>
      </div>
    );
  }

  return <AnswerBlocksClient brandId={brand.id} />;
}
