import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runGeoLint } from "@/lib/geo-linter";

// POST /api/geo-lint — deterministic GEO/AEO lint of a URL or pasted text.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { url?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim() || undefined;
  const text = body.text?.trim() || undefined;
  if (!url && !text) return NextResponse.json({ error: "Provide a url or text to lint" }, { status: 400 });

  try {
    const result = await runGeoLint({ url, text });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
