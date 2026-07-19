import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { setTaskStatus } from "@/lib/workflow";
import { type TaskStatus } from "@/lib/workflow-state";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const body = await req.json();
  const status = body.status as TaskStatus;
  const VALID = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"] as const;
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  try {
    const task = await setTaskStatus(id, status, brand.id, supabase);
    if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "transition failed" }, { status: 400 });
  }
}
