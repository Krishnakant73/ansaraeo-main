import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/content/approve — Body: { contentId, contentMarkdown, eeatChecklist }
//
// Enforces the Part 7 guardrail SERVER-SIDE, not just in the UI: content
// cannot be marked "approved" unless all three E-E-A-T checklist items
// are checked. A user could technically bypass a client-side-only check
// by calling this API directly — so the real enforcement has to live here.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { contentId, contentMarkdown, eeatChecklist } = await request.json();
  if (!contentId) return NextResponse.json({ error: "contentId is required" }, { status: 400 });

  const allChecked =
    eeatChecklist?.has_named_author && eeatChecklist?.has_original_data_point && eeatChecklist?.has_first_hand_detail;

  if (!allChecked) {
    return NextResponse.json(
      { error: "Complete the E-E-A-T checklist (real author, original data point, first-hand detail) before approving." },
      { status: 400 }
    );
  }

  // Also block approval if the placeholder markers are still in the text —
  // a checked box with unedited placeholder text would defeat the purpose.
  if (contentMarkdown.includes("[ADD ") || contentMarkdown.includes("[ADD AUTHOR")) {
    return NextResponse.json(
      { error: "Replace all [ADD ...] placeholder markers in the content before approving." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("content_items")
    .update({
      status: "approved",
      content_markdown: contentMarkdown,
      eeat_checklist: eeatChecklist,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", contentId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, contentItem: data });
}
