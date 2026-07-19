import { providerLabel, type Integration } from "@/lib/integration-workspace";
import IntegrationCopilotCanvas from "./IntegrationCopilotCanvas.client";

export default function CopilotBody({ integration }: { integration: Integration }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this integration</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the integration row. Never sees decrypted values.
        </p>
      </div>
      <IntegrationCopilotCanvas
        integrationId={integration.id}
        providerName={providerLabel(integration.provider)}
        status={integration.status}
        brandName={integration.brand.name}
        isEncrypted={integration.stats.isEncrypted}
      />
    </div>
  );
}
