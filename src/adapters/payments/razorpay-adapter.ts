// RazorpayAdapter — wraps the existing src/lib/razorpay.ts getRazorpay()
// lazy pattern behind the PaymentAdapter port. Zero behavior change for
// the existing /api/billing/webhook route until it migrates to this adapter.

import { getRazorpay, PLAN_PRICING } from "@/lib/razorpay";
import { hmacVerify } from "@/lib/platform/signing";
import type {
  OrderInput,
  OrderResult,
  PaymentAdapter,
  VerifiedWebhook,
} from "./types";

export class RazorpayAdapter implements PaymentAdapter {
  readonly provider = "razorpay" as const;

  async createOrder(input: OrderInput): Promise<OrderResult> {
    const rzp = getRazorpay();
    // Razorpay's TS types on the JS SDK are loose — cast to a narrow shape.
    const order = (await rzp.orders.create({
      amount: input.amount,
      currency: input.currency,
      notes: { org_id: input.orgId, plan: input.plan, ...input.notes },
    })) as { id: string };
    return {
      provider: "razorpay",
      orderId: order.id,
      publishableKey: process.env.RAZORPAY_KEY_ID,
    };
  }

  verifyWebhook(rawBody: string, signature: string): VerifiedWebhook | null {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return null;
    // Constant-time HMAC compare via shared helper — prevents timing side
    // channels on signature validation.
    if (!hmacVerify(secret, rawBody, signature)) return null;

    let event: {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const payment = event.payload?.payment?.entity ?? {};
    const notes = (payment.notes ?? {}) as Record<string, unknown>;

    let status: VerifiedWebhook["status"] = "unknown";
    if (event.event === "payment.captured") status = "paid";
    else if (event.event === "payment.failed") status = "failed";
    else if (event.event === "refund.processed") status = "refunded";
    else if (event.event === "subscription.cancelled") status = "canceled";

    return {
      provider: "razorpay",
      eventType: event.event ?? "unknown",
      orgId: (notes.org_id as string | undefined) ?? null,
      plan: (notes.plan as string | undefined) ?? null,
      amount: typeof payment.amount === "number" ? payment.amount : null,
      currency: (payment.currency as string | undefined) ?? null,
      status,
      providerInvoiceId: (payment.id as string | undefined) ?? null,
      providerSubscriptionId: null,
      raw: event as unknown as Record<string, unknown>,
    };
  }
}

// Re-export the plan table so services don't reach into src/lib/razorpay.ts directly.
export { PLAN_PRICING };
