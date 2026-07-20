import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hmacVerify } from "@/lib/platform/signing";

// ============================================================
// POST /api/billing/webhook
//
// Configure this URL in Razorpay Dashboard > Settings > Webhooks:
//   https://yourdomain.com/api/billing/webhook
// Subscribe to at least the "payment.captured" event.
//
// SECURITY: this route verifies Razorpay's HMAC signature before trusting
// anything in the payload. Never update plan/payment status based on a
// client-side "success" callback alone — a malicious user could fake that
// call. The webhook, with a verified signature, is the only source of truth.
// ============================================================

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Constant-time HMAC verification via the shared signing helper.
  // Rejects missing signatures/secrets outright — no signature = spoofed request.
  if (!signature || !secret || !hmacVerify(secret, rawBody, signature)) {
    console.error("Razorpay webhook: signature mismatch — possible spoofed request");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createServiceClient();

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const orderId = payment.order_id as string;

    // Find the pending payment row we created in /api/billing/create-order
    const { data: paymentRow } = await supabase
      .from("payments")
      .select("id, org_id, plan")
      .eq("razorpay_order_id", orderId)
      .single();

    if (paymentRow) {
      await supabase
        .from("payments")
        .update({ status: "paid", razorpay_payment_id: payment.id })
        .eq("id", paymentRow.id);

      // Upgrade the organization's plan — this is the moment a customer
      // actually becomes a paying customer.
      await supabase
        .from("organizations")
        .update({ plan: paymentRow.plan, billing_provider: "razorpay", billing_customer_id: payment.id })
        .eq("id", paymentRow.org_id);
    }
  }

  if (event.event === "payment.failed") {
    const payment = event.payload.payment.entity;
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("razorpay_order_id", payment.order_id);
  }

  // Always return 200 quickly — Razorpay retries on non-2xx responses.
  return NextResponse.json({ received: true });
}
