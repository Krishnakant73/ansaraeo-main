import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptCredentials } from "@/lib/crypto";

// POST /api/settings/analytics — Body: { brandId, provider, credentials }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { brandId, provider, credentials } = await request.json();
  if (!brandId || !provider || !credentials) {
    return NextResponse.json({ error: "brandId, provider, and credentials are required" }, { status: 400 });
  }
  if (!["ga4", "shopify"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  // Encrypt before it ever touches the database. The `credentials` column
  // still stores JSONB — just JSONB containing one encrypted string field
  // instead of the raw secret, so no column type migration is needed.
  const encrypted = { data: encryptCredentials(credentials) };

  const { error } = await supabase
    .from("integrations")
    .upsert({ brand_id: brandId, provider, credentials: encrypted, status: "connected" }, { onConflict: "brand_id,provider" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
