import { NextRequest, NextResponse } from "next/server";
import { autofillFromDomain } from "@/lib/domain-autofill";

// POST /api/onboarding/autofill — Body: { domain }
// Called when the user finishes typing their domain in onboarding, before
// they even fill in the rest of the form.
export async function POST(request: NextRequest) {
  try {
    const { domain } = await request.json();
    if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

    const result = await autofillFromDomain(domain);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("autofill error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Autofill failed" }, { status: 500 });
  }
}
