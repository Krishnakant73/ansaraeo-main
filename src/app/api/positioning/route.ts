import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { parseJsonBody } from "@/lib/validate";
import { getAggregatePerception, judgePositioningGap } from "@/lib/brand-perception-io";
import { createRateLimiter } from "@/lib/rate-limit";

const positioningLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

const positioningSchema = z.object({
  category: z.string().max(200).nullable().optional(),
  target_customer: z.string().max(500).nullable().optional(),
  differentiators: z.array(z.string().max(120)).max(20).optional(),
  best_for: z.array(z.string().max(200)).max(20).optional(),
  transformation_from: z.string().max(200).nullable().optional(),
  transformation_to: z.string().max(200).nullable().optional(),
});

function clampArray(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const cleaned = input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0)
    .slice(0, 20);
  return cleaned.length ? cleaned : undefined;
}

export async function GET() {
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 404 });

  const supabase = await createClient();
  const { data: position } = await supabase
    .from("brand_positioning")
    .select("category, target_customer, differentiators, best_for, transformation_from, transformation_to")
    .eq("brand_id", brand.id)
    .maybeSingle();

  const aggregate = await getAggregatePerception(supabase, brand.id);
  const gap = judgePositioningGap(
    {
      category: position?.category ?? null,
      target_customer: position?.target_customer ?? null,
      differentiators: position?.differentiators ?? [],
      best_for: position?.best_for ?? [],
      transformation_from: position?.transformation_from ?? null,
      transformation_to: position?.transformation_to ?? null,
    },
    aggregate,
  );

  return NextResponse.json({ position: position ?? null, aggregate, gap });
}

export async function POST(req: Request) {
  const limited = positioningLimiter(req.headers.get("x-forwarded-for") ?? "positioning");
  if (!limited.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 404 });

  const parsed = await parseJsonBody(req, positioningSchema);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const row = {
    category: parsed.data.category ?? null,
    target_customer: parsed.data.target_customer ?? null,
    differentiators: clampArray(parsed.data.differentiators) ?? null,
    best_for: clampArray(parsed.data.best_for) ?? null,
    transformation_from: parsed.data.transformation_from ?? null,
    transformation_to: parsed.data.transformation_to ?? null,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_positioning")
    .upsert({ brand_id: brand.id, ...row }, { onConflict: "brand_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ position: data });
}
