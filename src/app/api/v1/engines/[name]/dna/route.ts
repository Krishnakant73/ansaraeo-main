import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { loadEngineDnaOverlay } from "@/lib/engine-dna";

// ============================================================
// GET /api/v1/engines/[name]/dna
//
// Returns the six-axis engine personality DNA + the brand's cross-
// engine baseline overlay. Cookie-scoped brand. RLS on
// engine_personalities is authoritative for access when the cache
// row exists; the live computer falls back to visibility_runs when
// it doesn't, and RLS on that table is org-scoped by prompt → brand.
// ============================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createClient();

  const { data: engine } = await supabase
    .from("engines")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();
  if (!engine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand context" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dna = await loadEngineDnaOverlay(supabase as any, (engine as { id: string }).id, brand.id);
  return NextResponse.json(dna);
}
