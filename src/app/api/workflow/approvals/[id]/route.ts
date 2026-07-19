import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { decideApproval } from "@/lib/workflow";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const body = await req.json();
  const decision = body.decision as "approved" | "rejected";
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }
  try {
    await decideApproval(id, decision, user.id, brand.id, supabase);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "decision failed" }, { status: 400 });
  }
}
