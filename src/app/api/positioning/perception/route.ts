import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";

export async function GET(req: Request) {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_perception")
    .select(
      "id, run_id, engine_id, perceived_category, strengths, weaknesses, recommended_for, tone, created_at",
    )
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rows: data ?? [] });
}
