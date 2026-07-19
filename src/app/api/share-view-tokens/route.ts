import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// POST /api/share-view-tokens
//
// Mints a share_view_tokens row scoped to a workspace. Cookie
// client + RLS: the caller must belong to the brand's org (RLS on
// share_view_tokens's insert path derives from the brand FK).
//
// Body:
//   { workspaceKind: "competitor" | "engine" | "brand",
//     workspaceId: string,          // competitor uuid | engine name | brand id
//     brandId: string }              // resolved by the caller
//
// Returns { token, url, expires_at }. The token is a UUID; the URL
// is the ready-to-share /share/w/[token] path.
// ============================================================

const bodySchema = z.object({
  workspaceKind: z.enum(["competitor", "engine", "brand"]),
  workspaceId: z.string().min(1).max(200),
  brandId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { workspaceKind, workspaceId } = parsed.data;
  let brandId = parsed.data.brandId;

  // Resolve brandId when the caller didn't supply it. Cookie client +
  // RLS: an unauthorized caller reads null on every path below.
  if (!brandId) {
    if (workspaceKind === "brand") {
      brandId = workspaceId;
    } else if (workspaceKind === "competitor") {
      const { data: c } = await supabase
        .from("competitors")
        .select("brand_id")
        .eq("id", workspaceId)
        .maybeSingle();
      brandId = (c as { brand_id: string } | null)?.brand_id;
    } else if (workspaceKind === "engine") {
      const { getSelectedBrand } = await import("@/lib/selected-brand");
      const { brand } = await getSelectedBrand();
      brandId = brand?.id;
    }
    if (!brandId) {
      return NextResponse.json({ error: "Brand not resolvable from context" }, { status: 400 });
    }
  }

  // RLS on brands scopes access to the caller's org; if we can't
  // read the brand under the cookie client, the caller has no
  // business minting a token for it.
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .maybeSingle();
  if (!brand) return NextResponse.json({ error: "Brand not accessible" }, { status: 403 });

  const { data: row, error } = await supabase
    .from("share_view_tokens")
    .insert({
      brand_id: brandId,
      created_by: user.id,
      workspace_kind: workspaceKind,
      workspace_id: workspaceId,
    })
    .select("token, expires_at")
    .single();
  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to mint token" },
      { status: 500 },
    );
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://ansaraeo.com";
  return NextResponse.json({
    token: row.token,
    url: `${base}/share/w/${row.token}`,
    expires_at: row.expires_at,
  });
}
