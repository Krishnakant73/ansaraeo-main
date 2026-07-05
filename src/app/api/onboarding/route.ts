import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStarterPrompts } from "@/lib/starter-prompts";

// ============================================================
// POST /api/onboarding
// Body: { brandName, domain, industry, category, competitor, city, languages }
//
// Uses the REGULAR (session-aware) Supabase client, not the service-role
// one — so Row Level Security applies automatically and a user can only
// ever create brands inside their own organization. This is the
// "Onboarding / Setup Wizard" from 05-ui-ux-design-system.md, Screen A.
// ============================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { brandName, domain, industry, category, competitor, city, languages } = body;

  if (!brandName || !domain || !industry || !category) {
    return NextResponse.json(
      { error: "brandName, domain, industry, and category are required" },
      { status: 400 }
    );
  }

  // Find the user's organization (created automatically by the
  // handle_new_user() trigger from schema.sql when they signed up)
  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "No organization found for this user" }, { status: 404 });
  }

  // 1. Create the brand
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .insert({
      org_id: membership.org_id,
      name: brandName,
      domain,
      industry,
      languages: languages && languages.length > 0 ? languages : ["en"],
    })
    .select()
    .single();

  if (brandError || !brand) {
    return NextResponse.json({ error: brandError?.message ?? "Failed to create brand" }, { status: 500 });
  }

  // 2. Optionally save the competitor
  if (competitor) {
    await supabase.from("competitors").insert({ brand_id: brand.id, name: competitor });
  }

  // 3. Auto-generate + insert starter prompts (no LLM call needed — see starter-prompts.ts)
  const starterPrompts = generateStarterPrompts({
    industry,
    category,
    competitor,
    city,
    languages: languages && languages.length > 0 ? languages : ["en"],
  });

  if (starterPrompts.length > 0) {
    const { error: promptsError } = await supabase.from("prompts").insert(
      starterPrompts.map((p) => ({
        brand_id: brand.id,
        text: p.text,
        language: p.language,
      }))
    );
    if (promptsError) {
      // Brand was created successfully even if prompt insertion partially fails —
      // don't fail the whole onboarding step, just report it.
      return NextResponse.json({
        success: true,
        brand,
        warning: `Brand created, but starter prompts failed: ${promptsError.message}`,
      });
    }
  }

  return NextResponse.json({ success: true, brand, promptsCreated: starterPrompts.length });
}
