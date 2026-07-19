import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { acceptOpportunity, notify } from "@/lib/workflow";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const body = await req.json();
  const opportunityId = body.opportunity_id as string;
  if (!opportunityId) return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });

  try {
    const result = await acceptOpportunity(brand.id, opportunityId, user.id, supabase);
    await notify(
      {
        user_id: user.id,
        org_id: null,
        type: "mission_created",
        title: "Mission created from opportunity",
        body: `Opportunity turned into a mission with ${result.taskIds.length} tasks.`,
        payload: { mission_id: result.missionId },
        link: `/dashboard/mission-control`,
      },
      supabase,
    );
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "accept failed" }, { status: 400 });
  }
}
