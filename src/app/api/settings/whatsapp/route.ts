import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { whatsappNumber } = await request.json();

  const { data: membership } = await supabase.from("org_members").select("org_id").eq("user_id", user.id).limit(1).single();
  if (!membership) return NextResponse.json({ error: "No organization found" }, { status: 404 });

  // Saving a new number resets verification — an admin (you, at MVP stage)
  // must confirm WhatsApp Business API access before digests actually send.
  const { error } = await supabase
    .from("organizations")
    .update({ whatsapp_number: whatsappNumber, whatsapp_verified: false })
    .eq("id", membership.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
