import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitIndexNow } from "@/lib/ai-index-generator";

// POST /api/ai-index/submit — Body: { key, host, urlList }
// Submits changed AI-index URLs to IndexNow (real protocol). Cookie auth.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { key, host, urlList } = await request.json();
    if (!key || !host || !Array.isArray(urlList) || urlList.length === 0) {
      return NextResponse.json(
        { error: "key, host, and a non-empty urlList are required" },
        { status: 400 }
      );
    }

    const outcome = await submitIndexNow({ key: String(key), host: String(host), urlList: urlList.map(String) });

    return NextResponse.json({ ok: outcome.ok, status: outcome.status, note: outcome.note });
  } catch (err) {
    console.error("ai-index submit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error submitting to IndexNow" },
      { status: 500 }
    );
  }
}
