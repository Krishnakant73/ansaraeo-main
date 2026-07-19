import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePdp } from "@/lib/pdp-generator";

// POST /api/pdp — Body: { brandId, url?, productJson? }
// Generates schema.org Product JSON-LD + AI-citation-optimized copy
// from a product page URL and/or pasted product JSON.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { brandId, url, productJson } = await request.json();

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const { data: brand } = await supabase
      .from("brands")
      .select("name")
      .eq("id", brandId)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const result = await generatePdp({
      url: url || undefined,
      productJson: productJson || undefined,
      brandName: brand.name,
    });

    return NextResponse.json({ result });
  } catch (err) {
    console.error("pdp generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error generating PDP" },
      { status: 500 }
    );
  }
}
