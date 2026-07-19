import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey, hmacSign, hmacVerify } from "./signing";

describe("signing", () => {
  it("hashApiKey is deterministic and prefixed-free", () => {
    const raw = "aka_sk_abc123";
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
    expect(hashApiKey(raw)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateApiKey returns a raw key with prefix and matching hash", () => {
    const { raw, hash } = generateApiKey();
    expect(raw.startsWith("aka_sk_")).toBe(true);
    expect(hash).toBe(hashApiKey(raw));
  });

  it("hmac sign/verify round-trips and rejects tampering", () => {
    const secret = "topsecret";
    const body = JSON.stringify({ a: 1 });
    const sig = hmacSign(secret, body);
    expect(hmacVerify(secret, body, sig)).toBe(true);
    expect(hmacVerify(secret, body + "x", sig)).toBe(false);
    expect(hmacVerify("wrong", body, sig)).toBe(false);
  });
});
