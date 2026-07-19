import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { listApprovals, requestApproval, getUserOrgRole } from "@/lib/workflow";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const approvals = await listApprovals(brand.id, { status }, supabase);
  return NextResponse.json({ approvals });
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
  if (!body.task_id && !body.content_item_id) {
    return NextResponse.json({ error: "task_id or content_item_id required" }, { status: 400 });
  }
  await requestApproval(
    {
      brandId: brand.id,
      taskId: body.task_id ?? null,
      contentItemId: body.content_item_id ?? null,
      approverRole: body.approver_role ?? "admin",
      userId: user.id,
    },
    supabase,
  );
  return NextResponse.json({ ok: true });
}
