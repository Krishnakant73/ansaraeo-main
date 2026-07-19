import crypto from "crypto";

// ============================================================
// Application-level encryption for sensitive credentials (GA4 service
// account JSON, Shopify access tokens) stored in the `integrations`
// table — fixes the CRITICAL gap flagged in Batch 19's setup notes,
// where these were stored as plaintext JSONB.
//
// Uses AES-256-GCM: authenticated encryption, meaning it also detects
// tampering (not just confidentiality). ENCRYPTION_KEY must be a 32-byte
// key — see BATCH20_SETUP_NOTES.md for how to generate one.
//
// Why application-level instead of Supabase Vault: Vault is a genuinely
// good option too (built into Postgres via pgsodium), but requires
// enabling an extension and using Postgres-side SQL functions
// (vault.create_secret/vault.decrypted_secrets) which couples your
// encryption logic to Supabase specifically. This approach works
// identically if you ever migrate databases, and keeps the encryption
// key management fully in your own application code where it's easier
// to reason about and rotate.
// ============================================================

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) throw new Error("ENCRYPTION_KEY environment variable is not set");
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters) — see setup notes");
  }
  return key;
}

// Encrypts any JSON-serializable value. Returns a single string safe to
// store in a text/jsonb column: "iv:authTag:ciphertext" (all hex-encoded).
export function encryptCredentials(value: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV, standard for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptCredentials<T = unknown>(stored: string): T {
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Malformed encrypted credential value — cannot decrypt");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
