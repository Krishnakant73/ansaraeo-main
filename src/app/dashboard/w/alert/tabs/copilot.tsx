import { metricLabel, type Alert } from "@/lib/alert-workspace";
import AlertCopilotCanvas from "./AlertCopilotCanvas.client";

export default function CopilotBody({ alert }: { alert: Alert }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this alert</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the rule + firings. Never invents thresholds or metric values.
        </p>
      </div>
      <AlertCopilotCanvas
        alertId={alert.id}
        metric={metricLabel(alert.metric)}
        brandName={alert.brand.name}
      />
    </div>
  );
}
