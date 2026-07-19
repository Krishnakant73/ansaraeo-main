import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockSupabase } from "./__fixtures__/mockSupabase";
import {
  createSubscription,
  deliverEvent,
  signWebhookBody,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "./webhooks";

describe("webhooks", () => {
  let mock = createMockSupabase();
  let fetchMock: ReturnType<typeof vi.fn>;
  let captured: any = null;

  beforeEach(() => {
    mock = createMockSupabase();
    vi.stubEnv("ENCRYPTION_KEY", "0".repeat(64));
    captured = null;
    fetchMock = vi.fn(async (_url: string, init: any) => {
      captured = init;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("signWebhookBody/verifyWebhookSignature round-trips and rejects tampering", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = signWebhookBody("s", body);
    expect(verifyWebhookSignature("s", body, sig)).toBe(true);
    expect(verifyWebhookSignature("s", body + "x", sig)).toBe(false);
  });

  it("deliverEvent signs and POSTs to matching subscriptions, logs delivery", async () => {
    const { secret } = await createSubscription(
      "org1",
      "https://ex.com/hook",
      ["visibility_check.completed"],
      mock.client
    );
    await deliverEvent({ type: "visibility_check.completed", tenantId: "org1", data: { taskId: "j1" } }, mock.client);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = captured.body;
    const parsed = JSON.parse(body);
    expect(parsed.type).toBe("visibility_check.completed");
    expect(parsed.tenantId).toBe("org1");
    expect(parsed.timestamp).toBeTruthy();

    const sig = captured.headers[WEBHOOK_SIGNATURE_HEADER];
    expect(sig).toBeTruthy();
    expect(verifyWebhookSignature(secret, body, sig)).toBe(true);

    const deliveries = mock.tables["webhook_deliveries"];
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].last_status_code).toBe(200);
  });

  it("deliverEvent skips subscriptions whose events don't include the type", async () => {
    await createSubscription("org1", "https://ex.com/a", ["other.event"], mock.client);
    await createSubscription("org1", "https://ex.com/b", ["visibility_check.completed"], mock.client);
    await deliverEvent({ type: "visibility_check.completed", tenantId: "org1", data: {} }, mock.client);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
