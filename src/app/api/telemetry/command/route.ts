import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/telemetry/command
// Body: { commandId: string, brandId?: string, method?: "palette"|"keyboard"|"click"|"quick_action", ms?: number }
//
// Fire-and-forget palette telemetry. Rows are RLS-scoped to the user's
// org, so a compromised client can only pollute its own history. The
// route is intentionally forgiving: bad payloads return 200 with a hint
// so a broken client can't spam sentry with error tracebacks.
// ============================================================

const METHODS = new Set(["palette", "keyboard", "click", "quick_action"]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Not logged in? Silently succeed — this route is best-effort telemetry.
  if (!user) return NextResponse.json({ ok: true, skipped: "unauthenticated" });

  let body: {
    commandId?: string;
    brandId?: string | null;
    method?: string;
    ms?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, skipped: "invalid_json" });
  }

  const commandId = String(body.commandId ?? "").trim();
  if (!commandId) return NextResponse.json({ ok: true, skipped: "missing_command_id" });
  const method = METHODS.has(String(body.method ?? "")) ? String(body.method) : "palette";

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ ok: true, skipped: "no_org" });

  await supabase.from("command_events").insert({
    org_id: membership.org_id,
    user_id: user.id,
    command_id: commandId,
    brand_id: body.brandId ?? null,
    method,
    ms: typeof body.ms === "number" ? Math.round(body.ms) : null,
  });

  return NextResponse.json({ ok: true });
}
