import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runFanoutCoverage } from "@/lib/fanout-coverage";

// POST /api/fanout-coverage — generate an AI fan-out question set for a
// topic and (optionally) measure how much a page/pasted content covers it.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { topic?: string; url?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

  try {
    const result = await runFanoutCoverage({ topic, url: body.url?.trim() || undefined, text: body.text?.trim() || undefined });
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
