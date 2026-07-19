import { NextResponse } from "next/server";

// ============================================================
// Shared API response + error shapes for the /api/v1 gateway.
// Matches docs/ANSARAEO_CLOUD.md §7: every error body is
// { error: { code, message, retryable?, capability? } }.
// ============================================================

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable = false,
    public capability?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiSuccess(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Pure error-shape builder — unit-testable without instantiating NextResponse. */
export function errorShape(err: unknown): {
  status: number;
  body: { error: { code: string; message: string; retryable: boolean; capability?: string } };
} {
  if (err instanceof ApiError) {
    const error: { code: string; message: string; retryable: boolean; capability?: string } = {
      code: err.code,
      message: err.message,
      retryable: err.retryable,
    };
    if (err.capability) error.capability = err.capability;
    return { status: err.status, body: { error } };
  }
  console.error("Unhandled API error:", err);
  return {
    status: 500,
    body: { error: { code: "internal_error", message: "Internal server error", retryable: true } },
  };
}

export function apiError(err: unknown): NextResponse {
  const { status, body } = errorShape(err);
  return NextResponse.json(body, { status });
}

/** Wraps a route handler so thrown ApiError (and anything else) become a response. */
export async function withApi(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (err) {
    return apiError(err);
  }
}
