import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hydrateScanIntoBrand } from "@/lib/scan-hydrate";

// Required for Google (and any OAuth provider) login to work.
// Supabase redirects here after the user approves access on Google's
// consent screen; this exchanges the temporary `code` for a real session.
//
// After a successful exchange, if a `pending_scan_id` cookie is present
// (set on /analyze/[scanId]/report), we hydrate that scan into a real
// brand + prompts + runs so Mission Control opens populated. The cookie
// is cleared regardless of hydration outcome so a failed claim can't
// wedge future signups.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const userId = data.session.user.id;
  const cookieStore = await cookies();
  const pendingScanId = cookieStore.get("pending_scan_id")?.value;

  // Clear the cookie immediately — we treat it as one-shot regardless of hydration outcome.
  if (pendingScanId) {
    cookieStore.set("pending_scan_id", "", { path: "/", maxAge: 0 });
  }

  if (pendingScanId) {
    try {
      const result = await hydrateScanIntoBrand({ userId, scanId: pendingScanId });
      if (result.ok) {
        return NextResponse.redirect(`${origin}/dashboard/welcome?scan=${pendingScanId}`);
      }
      // If hydration failed (e.g., someone else already claimed the scan),
      // fall through to the ordinary dashboard flow rather than blocking signup.
      console.warn("[auth/callback] scan hydration failed:", result.error);
    } catch (err) {
      console.warn("[auth/callback] scan hydration threw:", err);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
