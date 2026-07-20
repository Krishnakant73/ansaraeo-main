// Payments composition. Picks adapter by provider name (or by user's
// currency / region in BillingService). Both adapters coexist — caller
// decides which provider to bill through.

import { RazorpayAdapter, PLAN_PRICING } from "./razorpay-adapter";
import { StripeAdapter } from "./stripe-adapter";
import type { PaymentAdapter } from "./types";

export type { OrderInput, OrderResult, PaymentAdapter, VerifiedWebhook } from "./types";
export { RazorpayAdapter, StripeAdapter, PLAN_PRICING };

let _razorpay: RazorpayAdapter | null = null;
let _stripe: StripeAdapter | null = null;

export function getPaymentAdapter(provider: "razorpay" | "stripe"): PaymentAdapter {
  if (provider === "razorpay") {
    if (!_razorpay) _razorpay = new RazorpayAdapter();
    return _razorpay;
  }
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new StripeAdapter(key, process.env.STRIPE_WEBHOOK_SECRET ?? null);
  }
  return _stripe;
}
