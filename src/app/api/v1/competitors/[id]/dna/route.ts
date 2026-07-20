import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeCompetitorDna } from "@/lib/competitor-dna";

// ============================================================
// GET /api/v1/competitors/[id]/dna
//
// Returns the six-axis DNA scores for the competitor + the user's
// brand overlay. Cookie-scoped; RLS is authoritative for access.
// Used by client code that needs the DNA without re-rendering the
// server tab (e.g. the SimulatorOverlay).
// ============================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: comp } = await supabase
    .from("competitors")
    .select("id, brand_id, name, domain")
    .eq("id", id)
    .maybeSingle();
  if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

   
  const dna = await computeCompetitorDna(supabase as any, comp as {
    id: string;
    brand_id: string;
    name: string;
    domain: string | null;
  });
  return NextResponse.json(dna);
}
