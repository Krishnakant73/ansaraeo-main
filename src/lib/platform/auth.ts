import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey } from "./signing";
import { ApiError } from "./responses";

// ============================================================
// API-key authentication + scope enforcement for /api/v1.
// The gateway uses the SERVICE client (RLS bypass) and then scopes every
// downstream query on `organizations.id = auth.tenantId` — see §6 of the
// Phase 1 doc. Scopes are namespace-denied-by-default; new scopes
// (trust:read in Phase 2, agent:run in Phase 3) never grant implicit access.
// ============================================================

export interface ApiAuth {
  tenantId: string; // organizations.id
  scopes: string[];
  keyId: string;
}

const KEY_PREFIX = "aka_sk_";

export async function authenticateApiRequest(
  req: Request,
  sb: SupabaseClient = createServiceClient()
): Promise<ApiAuth | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  if (!token.startsWith(KEY_PREFIX)) return null;

  const hash = hashApiKey(token);
  const { data: key, error } = await sb
    .from("api_keys")
    .select("id, org_id, scopes")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !key) return null;

  // Best-effort last_used_at (non-blocking; ignore failure).
  void sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return {
    tenantId: key.org_id as string,
    scopes: (key.scopes as string[]) ?? [],
    keyId: key.id as string,
  };
}

export function requireScope(auth: ApiAuth, scope: string): void {
  if (!auth.scopes.includes(scope)) {
    throw new ApiError(403, "forbidden", `Missing required scope: ${scope}`);
  }
}
