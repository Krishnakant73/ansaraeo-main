// StripeAdapter — additive alongside RazorpayAdapter for non-India billing.
// Uses raw fetch against the Stripe REST API to avoid pulling the stripe
// SDK into the serverless bundle (each API route stays lean).
//
// Signature verification uses HMAC-SHA256 with Stripe's dot-separated
// timestamp+payload format per their docs.

import crypto from "crypto";
import type {
  OrderInput,
  OrderResult,
  PaymentAdapter,
  VerifiedWebhook,
} from "./types";

const STRIPE_API = "https://api.stripe.com/v1";
const CHECKOUT_SESSION_EXPIRY_SEC = 60 * 60; // 1h

export class StripeAdapter implements PaymentAdapter {
  readonly provider = "stripe" as const;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string | null,
  ) {}

  async createOrder(input: OrderInput): Promise<OrderResult> {
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("payment_method_types[]", "card");
    body.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    body.set("line_items[0][price_data][product_data][name]", `AnsarAEO ${input.plan}`);
    body.set("line_items[0][price_data][unit_amount]", String(input.amount));
    body.set("line_items[0][quantity]", "1");
    body.set("client_reference_id", input.orgId);
    body.set("metadata[org_id]", input.orgId);
    body.set("metadata[plan]", input.plan);
    body.set(
      "expires_at",
      String(Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_EXPIRY_SEC),
    );
    body.set(
      "success_url",
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ansaraeo.com"}/dashboard/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
    );
    body.set(
      "cancel_url",
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ansaraeo.com"}/pricing`,
    );

    const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) throw new Error(`Stripe error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { id: string; url: string };
    return {
      provider: "stripe",
      orderId: data.id,
      checkoutUrl: data.url,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    };
  }

  verifyWebhook(rawBody: string, signature: string): VerifiedWebhook | null {
    if (!this.webhookSecret) return null;
    const parts = Object.fromEntries(
      signature.split(",").map((p) => p.split("=") as [string, string]),
    );
    const timestamp = parts["t"];
    const sig = parts["v1"];
    if (!timestamp || !sig) return null;

    // Constant-time comparison + timestamp-tolerance window (5 min).
    const signed = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(signed)
      .digest("hex");
    if (!safeEqual(expected, sig)) return null;

    const age = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (Number.isNaN(age) || age > 5 * 60) return null;

    let event: {
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const obj = event.data?.object ?? {};
    const metadata = (obj.metadata ?? {}) as Record<string, unknown>;

    let status: VerifiedWebhook["status"] = "unknown";
    if (event.type === "checkout.session.completed" || event.type === "invoice.paid") {
      status = "paid";
    } else if (event.type === "invoice.payment_failed") {
      status = "failed";
    } else if (event.type === "customer.subscription.deleted") {
      status = "canceled";
    } else if (event.type === "charge.refunded") {
      status = "refunded";
    }

    return {
      provider: "stripe",
      eventType: event.type ?? "unknown",
      orgId: (metadata.org_id as string | undefined) ?? null,
      plan: (metadata.plan as string | undefined) ?? null,
      amount:
        typeof obj.amount_total === "number"
          ? (obj.amount_total as number)
          : typeof obj.amount_paid === "number"
            ? (obj.amount_paid as number)
            : null,
      currency: (obj.currency as string | undefined) ?? null,
      status,
      providerInvoiceId: (obj.id as string | undefined) ?? null,
      providerSubscriptionId: (obj.subscription as string | undefined) ?? null,
      raw: event as unknown as Record<string, unknown>,
    };
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
