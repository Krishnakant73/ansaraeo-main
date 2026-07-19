// ============================================================
// Content workspace — client-safe shared surface.
//
// Pure types + deterministic helpers with no server-only imports.
// Client components (draft editor, checklist) import from here so
// the server-only supabase client doesn't leak across the boundary.
// The server loader lives in `content-workspace.ts` and re-exports
// these types for server consumers.
// ============================================================

export type ContentEeat = {
  has_named_author: boolean;
  has_original_data_point: boolean;
  has_first_hand_detail: boolean;
};

export type ContentStats = {
  wordCount: number;
  placeholderCount: number;
  eeatChecked: number;
  approvalBlockers: string[];
};

export type ContentBrand = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type ContentPrompt = {
  id: string;
  text: string;
} | null;

export type ContentItem = {
  id: string;
  brand_id: string;
  prompt_id: string | null;
  title: string | null;
  status: string;
  content_markdown: string | null;
  target_engine: string | null;
  eeat_checklist: ContentEeat;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  brand: ContentBrand;
  prompt: ContentPrompt;
  stats: ContentStats;
};

export function computeStats(markdown: string, eeat: ContentEeat): ContentStats {
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const placeholderCount = (markdown.match(/\[ADD[^\]]*\]/g) ?? []).length;
  const eeatChecked =
    (eeat.has_named_author ? 1 : 0) +
    (eeat.has_original_data_point ? 1 : 0) +
    (eeat.has_first_hand_detail ? 1 : 0);
  const blockers: string[] = [];
  if (placeholderCount > 0) {
    blockers.push(
      `Replace ${placeholderCount} \`[ADD ...]\` placeholder${placeholderCount === 1 ? "" : "s"}`,
    );
  }
  if (!eeat.has_named_author) blockers.push("Add a named author");
  if (!eeat.has_original_data_point) blockers.push("Add an original data point");
  if (!eeat.has_first_hand_detail) blockers.push("Add a first-hand detail");
  return { wordCount, placeholderCount, eeatChecked, approvalBlockers: blockers };
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
