import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, saveGscIntegration, gscRedirectUri } from "@/lib/gsc";

// GET /api/gsc/callback — Google redirects here with ?code & ?state=brandId.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const code = request.nextUrl.searchParams.get("code");
  const brandId = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code || !brandId) {
    return NextResponse.redirect(new URL(`/dashboard/gsc?error=${error || "auth_failed"}`, request.url));
  }

  try {
    const { access_token, refresh_token } = await exchangeCodeForTokens(code, gscRedirectUri(request.nextUrl.origin));
    // We got an access token back; derive the owner email if present in id_token
    // is extra work — store refresh token only (email optional, unused for API).
    void access_token;
    await saveGscIntegration(supabase, brandId, { refresh_token });
    return NextResponse.redirect(new URL("/dashboard/gsc?connected=1", request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "token_exchange_failed";
    return NextResponse.redirect(new URL(`/dashboard/gsc?error=${encodeURIComponent(msg)}`, request.url));
  }
}
