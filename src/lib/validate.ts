import { z, type ZodType } from "zod";

// Tiny request-validation helpers built on zod (already a project dependency).
// Keeps route handlers from trusting an unvalidated request body.

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function parseJsonBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<ParseResult<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return { ok: false, error };
  }

  return { ok: true, data: parsed.data };
}

// Reusable schemas for the highest-traffic routes.
export const visibilityCheckSchema = z.object({ promptId: z.string().min(1) });

export const contentGenerateSchema = z.object({ promptId: z.string().min(1) });

export const agentChatSchema = z.object({
  message: z.string().min(1).max(8000),
  conversationId: z.string().uuid().optional(),
});
