import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/palette/search?q=<term> — fuzzy-search across the primary
// object kinds so the Command Palette can offer "open Acme" when the
// user types "acme". Returns a small, uniform list of results the
// palette can render as an "Objects" group and route into a workspace.
//
// Scoped by the cookie client (RLS). No secrets. `q` is trimmed and
// case-insensitive.
// ============================================================

export type PaletteObjectResult = {
  kind: "brand" | "prompt" | "competitor" | "mission" | "campaign";
  id: string;                       // becomes the [slug] in /dashboard/w/<kind>/[slug]
  label: string;
  sublabel?: string;
};

const MAX_PER_KIND = 4;
const MAX_TOTAL = 12;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ results: [] });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = `%${q}%`;
  const results: PaletteObjectResult[] = [];

  // Run all searches in parallel — RLS scopes each query to the user's
  // orgs, so a bad org's data is filtered at the DB.
  const [brands, prompts, competitors, missions, campaigns] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, slug, domain")
      .ilike("name", like)
      .limit(MAX_PER_KIND),
    supabase
      .from("prompts")
      .select("id, text, language")
      .ilike("text", like)
      .limit(MAX_PER_KIND),
    supabase
      .from("competitors")
      .select("id, name, domain, confirmed")
      .eq("confirmed", true)
      .ilike("name", like)
      .limit(MAX_PER_KIND),
    supabase
      .from("missions")
      .select("id, title, status, priority")
      .ilike("title", like)
      .limit(MAX_PER_KIND),
    supabase
      .from("campaigns")
      .select("id, name, status, objective")
      .ilike("name", like)
      .limit(MAX_PER_KIND),
  ]);

  for (const b of (brands.data as { id: string; name: string; slug: string; domain: string | null }[] | null) ?? []) {
    results.push({
      kind: "brand",
      id: b.slug,
      label: b.name,
      sublabel: b.domain ?? undefined,
    });
  }
  for (const p of (prompts.data as { id: string; text: string; language: string }[] | null) ?? []) {
    results.push({
      kind: "prompt",
      id: p.id,
      label: p.text.length > 80 ? p.text.slice(0, 80) + "…" : p.text,
      sublabel: p.language?.toUpperCase(),
    });
  }
  for (const c of (competitors.data as { id: string; name: string; domain: string | null }[] | null) ?? []) {
    results.push({
      kind: "competitor",
      id: c.id,
      label: c.name,
      sublabel: c.domain ?? undefined,
    });
  }
  for (const m of (missions.data as { id: string; title: string; status: string; priority: number }[] | null) ?? []) {
    results.push({
      kind: "mission",
      id: m.id,
      label: m.title,
      sublabel: `P${m.priority} · ${m.status.replace(/_/g, " ")}`,
    });
  }
  for (const c of (campaigns.data as { id: string; name: string; status: string; objective: string | null }[] | null) ?? []) {
    results.push({
      kind: "campaign",
      id: c.id,
      label: c.name,
      sublabel: c.status,
    });
  }

  return NextResponse.json({ results: results.slice(0, MAX_TOTAL) });
}
