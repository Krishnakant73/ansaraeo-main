import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { listTasks, createTask } from "@/lib/workflow";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const tasks = await listTasks({ brand_id: brand.id, status: status as any }, supabase);
  return NextResponse.json({ tasks });
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
  if (!body.mission_id || !body.title) {
    return NextResponse.json({ error: "mission_id and title are required" }, { status: 400 });
  }
  const task = await createTask(
    {
      mission_id: body.mission_id,
      title: body.title,
      type: body.type ?? "fix",
      assignee_id: body.assignee_id ?? null,
      source_opportunity_id: body.source_opportunity_id ?? null,
      due_date: body.due_date ?? null,
      engine_action: body.engine_action ?? {},
    },
    supabase,
  );
  return NextResponse.json({ task });
}
