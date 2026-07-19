import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateLlmsTxt } from "@/lib/llms-txt-validator";

// POST /api/llms-txt/validate — Body: { url?, text? } (one required)
// Deterministic llms.txt grammar check. No LLM/key. User-facing → cookie client.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { url, text } = await request.json();
    if (!url && !text) {
      return NextResponse.json({ error: "Provide either a url or the llms.txt text." }, { status: 400 });
    }

    const result = await validateLlmsTxt({ url: url?.trim() || undefined, text: text?.trim() || undefined });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("llms-txt validate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error validating llms.txt" },
      { status: 500 }
    );
  }
}
