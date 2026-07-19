import crypto from "crypto";

// ============================================================
// Pure signing/hashing helpers for the platform API.
// No `@/` imports — this module is trivially unit-testable and is the
// single source of truth for API-key hashing and webhook HMAC.
// ============================================================

const ALGO = "sha256";

export function hashApiKey(raw: string): string {
  return crypto.createHash(ALGO).update(raw).digest("hex");
}

export function hashWebhookSecret(raw: string): string {
  return crypto.createHash(ALGO).update(raw).digest("hex");
}

/** Generates `aka_sk_<48 hex chars>` and its sha256 hash. Raw key is shown once. */
export function generateApiKey(): { raw: string; hash: string } {
  const rand = crypto.randomBytes(24).toString("hex");
  const raw = `aka_sk_${rand}`;
  return { raw, hash: hashApiKey(raw) };
}

/** Generates a webhook secret (raw shown once; stored encrypted via crypto.ts). */
export function generateWebhookSecret(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(24).toString("hex");
  return { raw, hash: hashWebhookSecret(raw) };
}

export function hmacSign(secret: string, body: string): string {
  return crypto.createHmac(ALGO, secret).update(body).digest("hex");
}

export function hmacVerify(secret: string, body: string, signature: string): boolean {
  const expected = hmacSign(secret, body);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
