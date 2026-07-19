import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runPriceFactCheck } from "@/lib/price-factcheck";

// POST /api/price-factcheck — Body: { brandName, productName, truePrice?, inStock?, engines? }
// Fact-checks AI product answers against the brand's true price/stock and
// ranks the brand against competing retailers the AI names. Analysis only.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandName, productName, truePrice, inStock, engines } = await request.json();
    if (!brandName || !productName) {
      return NextResponse.json({ error: "brandName and productName are required" }, { status: 400 });
    }

    const result = await runPriceFactCheck({
      brandName,
      productName,
      truePrice,
      inStock: typeof inStock === "boolean" ? inStock : undefined,
      engines,
    });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("price-factcheck error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error running fact-check" },
      { status: 500 }
    );
  }
}
