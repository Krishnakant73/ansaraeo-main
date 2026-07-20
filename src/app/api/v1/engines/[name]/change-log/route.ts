import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { detectEngineChanges } from "@/lib/engine-change-log";

// ============================================================
// GET /api/v1/engines/[name]/change-log
//
// Returns detected + recorded change events for this engine in the
// current brand's context. Cookie-scoped brand; RLS scopes the
// underlying snapshot + event tables by org.
// ============================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const supabase = await createClient();

  const { data: engine } = await supabase
    .from("engines")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (!engine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand context" }, { status: 400 });

   
  const events = await detectEngineChanges(supabase as any, (engine as { id: string }).id, brand.id);
  return NextResponse.json({ events });
}
