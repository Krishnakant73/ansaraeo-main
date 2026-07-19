import type { ShareToken } from "@/lib/share-workspace";
import ShareCopilotCanvas from "./ShareCopilotCanvas.client";

export default function CopilotBody({ share }: { share: ShareToken }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this link</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the share token + brand. Never invents recipient identity.
        </p>
      </div>
      <ShareCopilotCanvas token={share.token} brandName={share.brand.name} />
    </div>
  );
}
