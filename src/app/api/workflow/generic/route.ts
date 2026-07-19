import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";

// Secure, allowlisted generic create for the workflow resource tables that are
// simple enough to not need a bespoke endpoint. RLS still enforces org scoping;
// we only inject brand_id / org_id from the authenticated selection so callers
// can never write to another org's rows.
const RESOURCES: Record<string, { table: string; scope: "brand" | "org"; createdBy?: boolean }> = {
  campaigns: { table: "campaigns", scope: "brand" },
  sprints: { table: "sprints", scope: "brand" },
  automations: { table: "automations", scope: "brand", createdBy: true },
  teams: { table: "teams", scope: "org" },
  playbooks: { table: "playbooks", scope: "org" },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brand } = await getSelectedBrand();
  if (!brand) return NextResponse.json({ error: "No brand selected" }, { status: 400 });

  const body = await req.json();
  const cfg = RESOURCES[body.resource as string];
  if (!cfg) return NextResponse.json({ error: "unknown resource" }, { status: 400 });

  const fields = body.fields && typeof body.fields === "object" ? body.fields : {};
  const row: Record<string, unknown> = { ...fields };
  if (cfg.scope === "brand") row.brand_id = brand.id;
  else {
    const { data: b } = await supabase.from("brands").select("org_id").eq("id", brand.id).single();
    row.org_id = (b as { org_id: string } | null)?.org_id;
  }
  if (cfg.createdBy) row.created_by = user.id;

  const { data, error } = await supabase.from(cfg.table).insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
