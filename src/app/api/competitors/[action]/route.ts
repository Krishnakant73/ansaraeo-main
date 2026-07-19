import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/competitors/[action] — Body: { competitorId }
// action = "confirm" keeps it and starts tracking it in future runs;
// action = "reject" deletes the suggestion entirely.
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { competitorId } = await request.json();
  if (!competitorId) return NextResponse.json({ error: "competitorId is required" }, { status: 400 });

  if (action === "confirm") {
    const { error } = await supabase.from("competitors").update({ confirmed: true }).eq("id", competitorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "reject") {
    const { error } = await supabase.from("competitors").delete().eq("id", competitorId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
