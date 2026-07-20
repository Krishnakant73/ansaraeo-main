// Payments adapter port. BillingService depends on this interface, not on
// any specific provider SDK. Constitution rule: every provider replaceable.
//
// Two providers today: Razorpay (India) + Stripe (rest of world). More can
// slot in later without touching BillingService.

export type OrderInput = {
  amount: number; // smallest currency unit (paise for INR, cents for USD)
  currency: string;
  orgId: string;
  plan: string; // starter / growth / agency (see PLAN_PRICING)
  notes?: Record<string, string>;
};

export type OrderResult = {
  provider: "razorpay" | "stripe";
  orderId: string; // provider-native order/payment-intent ID
  checkoutUrl?: string; // Stripe returns a URL; Razorpay returns creds for their JS SDK
  publishableKey?: string; // for client-side redirect / SDK init
};

export type VerifiedWebhook = {
  provider: "razorpay" | "stripe";
  eventType: string;
  // The subset of fields BillingService needs — providers expose different
  // payloads, so adapters normalize to this shape.
  orgId?: string | null;
  plan?: string | null;
  amount?: number | null;
  currency?: string | null;
  status: "paid" | "failed" | "refunded" | "canceled" | "unknown";
  providerInvoiceId?: string | null;
  providerSubscriptionId?: string | null;
  raw: Record<string, unknown>;
};

export interface PaymentAdapter {
  readonly provider: "razorpay" | "stripe";
  createOrder(input: OrderInput): Promise<OrderResult>;
  // Verifies the webhook signature AND normalizes the payload. Returns null
  // on signature mismatch (caller responds 400 without doing anything else).
  verifyWebhook(rawBody: string, signature: string): VerifiedWebhook | null;
}
