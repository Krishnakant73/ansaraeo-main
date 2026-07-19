import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getUnlockedFeatures, type FeatureKey } from "@/lib/feature-unlock";
import { FEATURE_TO_NAV_HREFS } from "@/components/dashboard/nav-config";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { brand, allBrands } = await getSelectedBrand();

  // Compute which nav items to hide via feature-unlock. Never blocks
  // rendering — if any of these queries fail, we fall back to showing
  // everything (better to over-show than to leave a user without an
  // escape hatch).
  let hiddenHrefs: string[] = [];
  try {
    if (brand?.id) {
      const svc = createServiceClient();
      const { data: brandRow } = await svc
        .from("brands")
        .select("created_at, org_id")
        .eq("id", brand.id)
        .single();
      const { data: orgRow } = brandRow?.org_id
        ? await svc.from("organizations").select("mode").eq("id", brandRow.org_id).single()
        : { data: null };
      const { data: events } = await svc
        .from("activation_events")
        .select("event")
        .eq("user_id", user.id);

      const unlocked = getUnlockedFeatures({
        createdAt: brandRow?.created_at ? new Date(brandRow.created_at) : new Date(),
        events: new Set((events ?? []).map((e) => e.event)),
        orgMode: ((orgRow as { mode?: string } | null)?.mode as "solo" | "agency" | "enterprise") ?? "solo",
      });

      // A nav item is hidden iff every feature it advertises is locked.
      // If a nav item isn't listed in FEATURE_TO_NAV_HREFS, it's always visible.
      const hidden: string[] = [];
      for (const [href, features] of Object.entries(FEATURE_TO_NAV_HREFS)) {
        if (
          features.length > 0 &&
          features.every((f) => !unlocked.has(f as FeatureKey))
        ) {
          hidden.push(href);
        }
      }
      hiddenHrefs = hidden;
    }
  } catch {
    hiddenHrefs = [];
  }

  return (
    <DashboardShell
      brands={allBrands}
      selectedBrandId={brand?.id ?? null}
      selectedBrandSlug={brand?.slug ?? null}
      email={user.email ?? null}
      hiddenHrefs={hiddenHrefs}
    >
      {children}
    </DashboardShell>
  );
}
