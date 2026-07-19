import type { ContentItem } from "@/lib/content-workspace";
import DraftClient from "./draft.client";

// ============================================================
// Content › Draft — thin server wrapper. All state lives in the
// client editor; this is just a passthrough so the server can hand
// down the freshest item snapshot.
// ============================================================

export default function DraftBody({ item }: { item: ContentItem }) {
  return <DraftClient item={item} />;
}
