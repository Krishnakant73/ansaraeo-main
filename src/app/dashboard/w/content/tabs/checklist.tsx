import type { ContentItem } from "@/lib/content-workspace";
import ChecklistClient from "./checklist.client";

export default function ChecklistBody({ item }: { item: ContentItem }) {
  return <ChecklistClient item={item} />;
}
