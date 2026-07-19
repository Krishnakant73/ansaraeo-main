import type { Brand } from "@/lib/selected-brand";
import BrandCopilotCanvas from "./BrandCopilotCanvas.client";

// ============================================================
// Brand › Copilot — dedicated conversation surface for the brand.
// Complements the docked Copilot with a larger canvas + brand-scoped
// suggested prompts. Same SSE contract; DOM copilot-context on the
// shell root still supplies richer hints to the dock in parallel.
// ============================================================

export default function CopilotBody({ brand }: { brand: Brand }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this brand</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on {brand.name}&rsquo;s runs, citations, competitors, and content
          history. Never invents engine behavior, competitor moves, or citations.
        </p>
      </div>
      <BrandCopilotCanvas brandId={brand.id} brandName={brand.name} />
    </div>
  );
}
