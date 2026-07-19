import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { verifyTask } from "@/lib/workflow";

// Live Verification Loop endpoint. Given a `verify` task, measures whether the
// shipped fix moved the brand's benchmark metric vs the opportunity baseline.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const body = await req.json();
  const taskId = body.task_id as string | undefined;
  if (!taskId) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

  try {
    const result = await verifyTask(taskId, brand.id, user.id, supabase);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "verification failed" },
      { status: 400 },
    );
  }
}
