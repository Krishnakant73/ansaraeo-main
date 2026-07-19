import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { listMissions, createMission } from "@/lib/workflow";

export async function GET() {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });
  const missions = await listMissions(brand.id, {}, supabase);
  return NextResponse.json({ missions });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const body = await req.json();
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const mission = await createMission(
    {
      brand_id: brand.id,
      title: body.title,
      objective: body.objective ?? null,
      priority: body.priority ?? 3,
      owner_id: user.id,
      linked_campaign_id: body.linked_campaign_id ?? null,
      linked_sprint_id: body.linked_sprint_id ?? null,
      due_date: body.due_date ?? null,
    },
    supabase,
  );
  return NextResponse.json({ mission });
}
