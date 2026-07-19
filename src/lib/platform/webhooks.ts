import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptCredentials, decryptCredentials } from "@/lib/crypto";
import { generateWebhookSecret, hmacSign, hmacVerify } from "./signing";

// ============================================================
// Webhook subscriptions + signed delivery.
// Secret is stored AES-256-GCM encrypted (crypto.ts) and decrypted only to
// sign — never logged, never plaintext. Delivery is HMAC-SHA256 over the raw
// body (Razorpay-webhook discipline). Event `type` is an OPEN string so
// Phase 2/3 append events without schema change. See docs/PHASE1_API_GATEWAY §3.2.
// ============================================================

export const WEBHOOK_SIGNATURE_HEADER = "X-Ansar-Signature";
export const WEBHOOK_TS_HEADER = "X-Ansar-Timestamp";

export interface WebhookEvent {
  type: string;
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export function signWebhookBody(secret: string, body: string): string {
  return hmacSign(secret, body);
}

export function verifyWebhookSignature(secret: string, body: string, signature: string): boolean {
  return hmacVerify(secret, body, signature);
}

export async function createSubscription(
  tenantId: string,
  url: string,
  events: string[],
  sb: SupabaseClient = createServiceClient()
): Promise<{ id: string; secret: string }> {
  const { raw } = generateWebhookSecret();
  const { data, error } = await sb
    .from("webhook_subscriptions")
    .insert({
      tenant_id: tenantId,
      url,
      events,
      secret_enc: encryptCredentials(raw),
      active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createSubscription failed: ${error.message}`);
  return { id: (data as { id: string }).id, secret: raw }; // raw secret shown ONCE
}

export async function listSubscriptions(
  tenantId: string,
  sb: SupabaseClient = createServiceClient()
) {
  const { data, error } = await sb
    .from("webhook_subscriptions")
    .select("id, url, events, active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listSubscriptions failed: ${error.message}`);
  return data ?? [];
}

const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_BACKOFF_MS = 500;

export async function deliverEvent(
  event: Omit<WebhookEvent, "timestamp">,
  sb: SupabaseClient = createServiceClient()
): Promise<void> {
  const { data: subs, error } = await sb
    .from("webhook_subscriptions")
    .select("id, url, secret_enc")
    .eq("tenant_id", event.tenantId)
    .eq("active", true)
    .contains("events", [event.type]);
  if (error) throw new Error(`deliverEvent lookup failed: ${error.message}`);

  const full: WebhookEvent = { ...event, timestamp: new Date().toISOString() };
  const body = JSON.stringify(full);

  for (const sub of subs ?? []) {
    const raw = decryptCredentials<string>(sub.secret_enc);
    const sig = signWebhookBody(raw, body);
    let lastStatus: number | null = null;
    let lastError: string | null = null;
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(sub.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [WEBHOOK_SIGNATURE_HEADER]: sig,
            [WEBHOOK_TS_HEADER]: full.timestamp,
          },
          body,
        });
        lastStatus = res.status;
        if (res.ok) {
          lastError = null;
          break;
        }
        lastError = `HTTP ${res.status}`;
      } catch (e) {
        lastError = (e as Error).message;
      }
      if (attempt < MAX_DELIVERY_ATTEMPTS) await new Promise((r) => setTimeout(r, DELIVERY_BACKOFF_MS));
    }
    await sb.from("webhook_deliveries").insert({
      subscription_id: sub.id,
      tenant_id: event.tenantId,
      event_type: event.type,
      payload: full,
      attempt_count: MAX_DELIVERY_ATTEMPTS,
      last_status_code: lastStatus,
      last_error: lastError,
      next_retry_at: lastError ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
    });
  }
}
