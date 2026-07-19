import type { ContentItem } from "@/lib/content-workspace";
import ContentCopilotCanvas from "./ContentCopilotCanvas.client";

export default function CopilotBody({ item }: { item: ContentItem }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this draft</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot suggests edits and grounds. It never fabricates facts — anything specific to
          you stays as an <code className="rounded bg-surface px-1 text-[11px]">[ADD ...]</code>{" "}
          placeholder for a human to fill in.
        </p>
      </div>
      <ContentCopilotCanvas
        contentId={item.id}
        title={item.title || "Untitled draft"}
        brandName={item.brand.name}
      />
    </div>
  );
}
