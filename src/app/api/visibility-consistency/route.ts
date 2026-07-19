import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runConsistencyCheck } from "@/lib/visibility-consistency";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  let body: { brandId: string; promptText: string; engine: string; runs?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brandId, promptText, engine, runs } = body;
  if (!brandId || !promptText || !engine) {
    return NextResponse.json({ error: "brandId, promptText, and engine are required" }, { status: 400 });
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError || !brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  try {
    const result = await runConsistencyCheck({
      promptText,
      engine,
      brandName: brand.name,
      runs,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
