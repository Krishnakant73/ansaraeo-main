import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRazorpay, PLAN_PRICING } from "@/lib/razorpay";

// ============================================================
// POST /api/billing/create-order
// Body: { plan: "starter" | "growth" | "agency", cycle: "monthly" | "yearly" }
//
// Creates a Razorpay Order (a server-side record of "this org intends to
// pay this amount"). The actual payment happens client-side via Razorpay
// Checkout using the order_id this returns. Payment confirmation itself
// happens in /api/billing/webhook — NEVER trust the client to tell you
// "payment succeeded"; only trust the signed webhook from Razorpay.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { plan, cycle } = await request.json();
  if (!PLAN_PRICING[plan] || !["monthly", "yearly"].includes(cycle)) {
    return NextResponse.json({ error: "Invalid plan or billing cycle" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

  const amountInr = PLAN_PRICING[plan][cycle as "monthly" | "yearly"];
  const amountPaise = amountInr * 100; // Razorpay works in the smallest currency unit (paise)

  const order = await getRazorpay().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `${membership.org_id}_${Date.now()}`,
    notes: { org_id: membership.org_id, plan, cycle },
  });

  // Log the intent immediately (status: created) — the webhook will
  // update this row to "paid" once Razorpay confirms the payment.
  await supabase.from("payments").insert({
    org_id: membership.org_id,
    razorpay_order_id: order.id,
    plan,
    billing_cycle: cycle,
    amount_inr: amountInr,
    status: "created",
  });

  return NextResponse.json({
    orderId: order.id,
    amount: amountPaise,
    currency: "INR",
    keyId: process.env.RAZORPAY_KEY_ID, // public key — safe to send to the client
  });
}
