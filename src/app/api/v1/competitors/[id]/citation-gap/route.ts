import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/v1/competitors/[id]/citation-gap
//
// Returns two arrays: `only` (they're cited, you're not) and
// `both` (co-cited pages). Domain-level aggregation with example
// URLs. Cookie-scoped; RLS on citations enforces access.
// ============================================================

type Row = {
  id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean }[] | null;
};

type CitationRow = {
  cited_url: string | null;
  cited_domain: string | null;
  is_own_domain: boolean | null;
  is_trusted_source: boolean | null;
  authority_score: number | null;
  run_id: string;
};

type Agg = {
  domain: string;
  count: number;
  trusted: boolean;
  authority: number | null;
  urls: string[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: comp } = await supabase
    .from("competitors")
    .select("id, brand_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id")
    .eq("brand_id", (comp as { brand_id: string }).brand_id)
    .limit(500);
  const promptIds = ((prompts as { id: string }[] | null) ?? []).map((p) => p.id);

  const onlyMap = new Map<string, Agg>();
  const bothMap = new Map<string, Agg>();

  if (promptIds.length > 0) {
    const { data: runs } = await supabase
      .from("visibility_runs")
      .select("id, brand_mentioned, competitor_mentions")
      .in("prompt_id", promptIds);
    const rows = (runs as Row[] | null) ?? [];
    const nameLower = (comp as { name: string }).name.toLowerCase();

    const gapIds = rows
      .filter(
        (r) =>
          r.brand_mentioned === false &&
          (r.competitor_mentions ?? []).some(
            (m) => m.mentioned && m.name.toLowerCase() === nameLower,
          ),
      )
      .map((r) => r.id);
    const bothIds = rows
      .filter(
        (r) =>
          r.brand_mentioned === true &&
          (r.competitor_mentions ?? []).some(
            (m) => m.mentioned && m.name.toLowerCase() === nameLower,
          ),
      )
      .map((r) => r.id);

    if (gapIds.length + bothIds.length > 0) {
      const { data: cits } = await supabase
        .from("citations")
        .select("cited_url, cited_domain, is_own_domain, is_trusted_source, authority_score, run_id")
        .in("run_id", [...gapIds, ...bothIds]);
      const citRows = (cits as CitationRow[] | null) ?? [];
      const gapSet = new Set(gapIds);

      const push = (m: Map<string, Agg>, c: CitationRow) => {
        if (c.is_own_domain) return;
        const key = c.cited_domain ?? c.cited_url;
        if (!key) return;
        const cur =
          m.get(key) ??
          ({ domain: key, count: 0, trusted: false, authority: null, urls: [] } as Agg);
        cur.count += 1;
        if (c.is_trusted_source) cur.trusted = true;
        if (c.authority_score != null && (cur.authority == null || c.authority_score > cur.authority)) {
          cur.authority = c.authority_score;
        }
        if (c.cited_url && cur.urls.length < 6 && !cur.urls.includes(c.cited_url)) {
          cur.urls.push(c.cited_url);
        }
        m.set(key, cur);
      };
      for (const c of citRows) {
        if (gapSet.has(c.run_id)) push(onlyMap, c);
        else push(bothMap, c);
      }
    }
  }

  return NextResponse.json({
    only: Array.from(onlyMap.values()).sort((a, b) => b.count - a.count),
    both: Array.from(bothMap.values()).sort((a, b) => b.count - a.count),
  });
}
