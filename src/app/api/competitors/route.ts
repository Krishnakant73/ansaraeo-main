import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/competitors — Body: { brandId, name }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { brandId, name } = await request.json();
  if (!brandId || !name) return NextResponse.json({ error: "brandId and name are required" }, { status: 400 });

  const { data, error } = await supabase
    .from("competitors")
    .insert({ brand_id: brandId, name, source: "manual", confirmed: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, competitor: data });
}
