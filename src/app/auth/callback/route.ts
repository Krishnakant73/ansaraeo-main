import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Required for Google (and any OAuth provider) login to work.
// Supabase redirects here after the user approves access on Google's
// consent screen; this exchanges the temporary `code` for a real session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong (user cancelled, expired code, etc.)
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
