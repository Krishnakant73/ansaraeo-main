import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGscAuthUrl, gscConfigured } from "@/lib/gsc";

// GET /api/gsc/auth?brandId=xxx — start the GSC OAuth consent flow.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.redirect(new URL("/dashboard/gsc?error=missing_brand", request.url));

  if (!gscConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/gsc?error=not_configured", request.url));
  }

  const authUrl = buildGscAuthUrl(request.nextUrl.origin, brandId);
  return NextResponse.redirect(authUrl);
}
