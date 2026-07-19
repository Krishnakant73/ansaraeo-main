// ============================================================
// Activation event helper — single writer used across the onboarding
// funnel so we can count drop-off honestly at each step.
//
// Called from server routes only (public /api/analyze, /auth/callback,
// /api/onboarding/*, celebrations, weekly-report cron). Never blocks
// the caller: any write failure is logged and swallowed — instrumentation
// must never break user-facing flows.
//
// Events are keyed by user_id when we have one; pre-signup events fall
// back to ip_hash so we can still stitch the funnel across signup.
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

export type ActivationEvent =
  // Pre-signup
  | "scan_started"
  | "scan_completed"
  | "report_viewed"
  | "signup_gate_shown"
  // Signup
  | "signup"
  | "scan_hydrated"
  // First-run
  | "welcomed"
  | "goal_picked"
  | "first_task_proposed"
  | "first_draft_generated"
  | "first_draft_saved"
  | "first_draft_published"
  // Ongoing
  | "first_mention_detected"
  | "first_competitor_beat"
  | "score_crossed_50"
  | "score_crossed_75"
  | "weekly_digest_sent"
  | "weekly_digest_clicked"
  // Celebration sentinels (guard so we never fire the same modal twice)
  | "celebrated_report_rendered"
  | "celebrated_first_draft_saved"
  | "celebrated_first_draft_published"
  | "celebrated_first_mention"
  | "celebrated_first_competitor_beat"
  | "celebrated_score_50"
  | "celebrated_score_75";

export type LogParams = {
  event: ActivationEvent;
  userId?: string | null;
  brandId?: string | null;
  ipHash?: string | null;
  payload?: Record<string, unknown>;
};

// Hash an IP address so we can group pre-signup events without storing
// the IP itself. SHA-256 with an env-scoped salt (falling back to a
// constant so the function is total). The salt should be set in env
// to keep hashes stable across deploys.
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.ACTIVATION_IP_SALT ?? "ansaraeo-activation-v1";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function logActivationEvent(params: LogParams): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from("activation_events").insert({
      user_id: params.userId ?? null,
      brand_id: params.brandId ?? null,
      event: params.event,
      payload: params.payload ?? {},
      ip_hash: params.ipHash ?? null,
    });
  } catch (err) {
    // Never throw — instrumentation must never break the flow.
    console.warn(`[activation-events] failed to log ${params.event}:`, err);
  }
}

// Returns true iff the sentinel event has NOT been recorded before for
// this user/brand — used to guard one-shot celebrations. On DB error,
// returns false (i.e., we don't fire twice on flaky reads).
export async function hasEvent(
  userId: string,
  brandId: string | null,
  event: ActivationEvent,
): Promise<boolean> {
  try {
    const sb = createServiceClient();
    let q = sb.from("activation_events").select("id").eq("user_id", userId).eq("event", event).limit(1);
    if (brandId) q = q.eq("brand_id", brandId);
    const { data } = await q;
    return (data?.length ?? 0) > 0;
  } catch {
    return true; // fail closed
  }
}
