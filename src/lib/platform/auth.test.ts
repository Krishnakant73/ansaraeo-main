import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabase } from "./__fixtures__/mockSupabase";
import { authenticateApiRequest, requireScope, type ApiAuth } from "./auth";
import { hashApiKey } from "./signing";
import { ApiError } from "./responses";

describe("auth", () => {
  let mock = createMockSupabase();

  beforeEach(async () => {
    mock = createMockSupabase();
    await mock.client.from("api_keys").insert({
      id: "key1",
      org_id: "org1",
      key_hash: hashApiKey("aka_sk_valid"),
      scopes: ["visibility:read", "visibility:write"],
      label: "test",
    });
  });

  const req = (auth?: string) =>
    new Request("https://x/api/v1", auth ? { headers: { authorization: auth } } : {});

  it("authenticates a valid key and resolves tenant + scopes", async () => {
    const auth = await authenticateApiRequest(req("Bearer aka_sk_valid"), mock.client);
    expect(auth).not.toBeNull();
    expect(auth!.tenantId).toBe("org1");
    expect(auth!.scopes).toEqual(["visibility:read", "visibility:write"]);
  });

  it("returns null when the header is missing", async () => {
    expect(await authenticateApiRequest(req(), mock.client)).toBeNull();
  });

  it("returns null for an unknown key", async () => {
    expect(await authenticateApiRequest(req("Bearer aka_sk_unknown"), mock.client)).toBeNull();
  });

  it("returns null for non-bearer scheme or wrong prefix", async () => {
    expect(await authenticateApiRequest(req("Basic aka_sk_valid"), mock.client)).toBeNull();
    expect(await authenticateApiRequest(req("Bearer notprefix"), mock.client)).toBeNull();
  });

  it("requireScope allows present scope, throws 403 for absent scope", () => {
    const auth: ApiAuth = { tenantId: "org1", scopes: ["visibility:read"], keyId: "k" };
    expect(() => requireScope(auth, "visibility:read")).not.toThrow();
    expect(() => requireScope(auth, "agent:run")).toThrow(ApiError);
    try {
      requireScope(auth, "agent:run");
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
    }
  });
});
