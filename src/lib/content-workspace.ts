// ============================================================
// Content workspace — server-side loader.
//
// Uses the cookie-scoped supabase client, so this module can never be
// imported by a client component. Types and pure helpers live in
// `content-workspace-shared.ts` and are re-exported here for server
// consumers so a single import point still works.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import {
  computeStats,
  type ContentEeat,
  type ContentItem,
  type ContentBrand,
  type ContentPrompt,
} from "./content-workspace-shared";

export type { ContentEeat, ContentItem, ContentBrand, ContentPrompt, ContentStats } from "./content-workspace-shared";
export { computeStats, timeAgo } from "./content-workspace-shared";

const BRAND_COLUMNS = "id, name, slug, domain";

export async function getContentById(id: string): Promise<ContentItem | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("content_items")
    .select(
      "id, brand_id, prompt_id, title, status, content_markdown, target_engine, eeat_checklist, created_at, approved_at, approved_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;

  const item = row as Omit<ContentItem, "brand" | "prompt" | "stats">;
  const { data: brand } = await supabase
    .from("brands")
    .select(BRAND_COLUMNS)
    .eq("id", item.brand_id)
    .maybeSingle();
  if (!brand) return null;

  let prompt: ContentPrompt = null;
  if (item.prompt_id) {
    const { data: p } = await supabase
      .from("prompts")
      .select("id, text")
      .eq("id", item.prompt_id)
      .maybeSingle();
    prompt = (p as { id: string; text: string } | null) ?? null;
  }

  const eeat: ContentEeat = {
    has_named_author: !!item.eeat_checklist?.has_named_author,
    has_original_data_point: !!item.eeat_checklist?.has_original_data_point,
    has_first_hand_detail: !!item.eeat_checklist?.has_first_hand_detail,
  };

  const stats = computeStats(item.content_markdown ?? "", eeat);

  return {
    ...item,
    eeat_checklist: eeat,
    brand: brand as ContentBrand,
    prompt,
    stats,
  };
}
