import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTextMessage } from "@/lib/whatsapp";
import { reportError } from "@/lib/monitoring";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// GET /api/whatsapp/webhook — Meta's one-time verification handshake.
// When you register this URL in Meta App Dashboard > WhatsApp > Configuration,
// Meta calls this with a challenge token that must be echoed back exactly.
// ============================================================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type PendingAction = { id: string; content_item_id: string | null };
type ApprovalResult = "approved" | "none" | "no-match";

// Approve a specific pending automation_action, scoped to THIS org's brands.
// If a reference code is supplied it must match details.reference_code; otherwise
// the most recent org-scoped pending action is approved. Never approves another
// organization's action (the original cross-org mis-approval bug).
async function approvePendingAction(
  supabase: SupabaseClient,
  brandIds: string[],
  refCode: string | undefined
): Promise<ApprovalResult> {
  if (brandIds.length === 0) return "none";

  const query = supabase
    .from("automation_actions")
    .select("id, content_item_id, details")
    .in("brand_id", brandIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (refCode) {
    // Best-effort: match a reference code stored in the details jsonb. Safe even
    // when details is null (no match). We decline rather than blindly approve.
    const { data } = await query;
    const list = (data ?? []) as Array<{
      id: string;
      content_item_id: string | null;
      details?: { reference_code?: string } | null;
    }>;
    const target = list.find((a) => a.details?.reference_code?.toUpperCase() === refCode);
    if (!target) return "no-match";
    await markApproved(supabase, target);
    return "approved";
  }

  const { data } = await query.limit(1);
  const target = data?.[0] as PendingAction | undefined;
  if (!target) return "none";
  await markApproved(supabase, target);
  return "approved";
}

async function markApproved(supabase: SupabaseClient, target: PendingAction) {
  await supabase
    .from("automation_actions")
    .update({ status: "approved", approved_via: "whatsapp", executed_at: new Date().toISOString() })
    .eq("id", target.id);

  if (target.content_item_id) {
    await supabase
      .from("content_items")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", target.content_item_id);
  }
}

async function rejectMostRecentPending(supabase: SupabaseClient, brandIds: string[]) {
  if (brandIds.length === 0) return;
  const { data } = await supabase
    .from("automation_actions")
    .select("id")
    .in("brand_id", brandIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  const target = data?.[0];
  if (target) {
    await supabase.from("automation_actions").update({ status: "rejected" }).eq("id", target.id);
  }
}

// ============================================================
// POST /api/whatsapp/webhook — real inbound messages land here.
//
// Approval flow: a customer replies "APPROVE" (optionally "APPROVE <code>") to
// publish the most recent pending draft for THEIR org. Approvals are scoped to
// the org that owns this WhatsApp number via its brand_ids, so a reply can
// never approve another organization's action.
// ============================================================
export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createServiceClient();

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return NextResponse.json({ received: true }); // status updates, not a real message

    const fromNumber = message.from as string; // e.g. "919876543210"
    const text = (message.text?.body ?? "").trim().toLowerCase();

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .ilike("whatsapp_number", `%${fromNumber.slice(-10)}%`) // match by last 10 digits, ignoring country code formatting
      .single();

    if (!org) {
      reportError(new Error("WhatsApp message from unrecognized number"), { fromNumber });
      return NextResponse.json({ received: true });
    }

    // Resolve this org's brands so approvals are scoped to its own actions.
    const { data: brands } = await supabase.from("brands").select("id").eq("org_id", org.id);
    const brandIds = (brands ?? []).map((b) => b.id as string);

    const codeMatch = text.match(/(?:approve|yes|confirm)[-_ ]?([a-z0-9]{4,})/i);
    const refCode = codeMatch?.[1]?.toUpperCase();

    if (["approve", "yes", "y", "confirm"].includes(text) || refCode) {
      const result = await approvePendingAction(supabase, brandIds, refCode);
      if (result === "none") {
        await sendTextMessage(fromNumber, "No pending approvals found for your account right now.");
      } else if (result === "no-match") {
        await sendTextMessage(
          fromNumber,
          `No pending approval matches the code "${refCode}". Reply APPROVE (no code) to approve your most recent draft.`
        );
      } else {
        await sendTextMessage(fromNumber, "Approved ✅ — you can find it in Content Studio, ready to publish.");
      }
    } else if (["no", "decline", "reject"].includes(text)) {
      await rejectMostRecentPending(supabase, brandIds);
      await sendTextMessage(fromNumber, "Got it — declined. No changes made.");
    } else {
      await sendTextMessage(
        fromNumber,
        "Reply APPROVE to publish the latest draft, or open your dashboard for full details."
      );
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    reportError(err, { where: "whatsapp-webhook" });
    // Still return 200 — Meta will retry aggressively on non-2xx responses
    return NextResponse.json({ received: true });
  }
}
