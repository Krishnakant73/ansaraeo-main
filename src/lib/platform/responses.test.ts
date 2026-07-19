import { describe, it, expect } from "vitest";
import { ApiError, apiSuccess, apiError, errorShape } from "./responses";

describe("responses", () => {
  it("ApiError carries status/code and is instanceof Error", () => {
    const e = new ApiError(403, "forbidden", "nope", false);
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(403);
    expect(e.code).toBe("forbidden");
  });

  it("apiSuccess returns a NextResponse with the status", () => {
    const res = apiSuccess({ ok: true }, 201);
    expect(res.status).toBe(201);
  });

  it("errorShape maps ApiError to the shared error shape", () => {
    const { status, body } = errorShape(new ApiError(429, "rate_limited", "slow down", true, "grok"));
    expect(status).toBe(429);
    expect(body).toEqual({
      error: { code: "rate_limited", message: "slow down", retryable: true, capability: "grok" },
    });
  });

  it("errorShape maps apiError() to the same shape (status 429)", () => {
    const res = apiError(new ApiError(429, "rate_limited", "slow down", true, "grok"));
    expect(res.status).toBe(429);
  });

  it("errorShape maps unknown errors to 500", () => {
    const { status, body } = errorShape(new Error("boom"));
    expect(status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    expect(body.error.retryable).toBe(true);
  });
});
