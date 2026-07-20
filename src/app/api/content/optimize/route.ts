import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { optimizeContent } from "@/lib/content-optimizer";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let body: { brandId?: string; url?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = body.brandId;
  if (!brandId || typeof brandId !== "string") {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  const url = typeof body.url === "string" && body.url.trim().length > 0 ? body.url.trim() : undefined;
  const text = typeof body.text === "string" && body.text.trim().length > 0 ? body.text : undefined;

  if (!url && !text) {
    return NextResponse.json(
      { error: "Provide either a url or text to optimize" },
      { status: 400 }
    );
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("name, industry")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError || !brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  try {
    const result = await optimizeContent({
      url,
      text,
      brandName: brand.name,
      industry: brand.industry,
    });

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "content_optimized",
      properties: {
        brand_id: brandId,
        has_url: !!url,
        has_text: !!text,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
