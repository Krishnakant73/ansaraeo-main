import { redirect } from "next/navigation";
import { getSelectedBrand } from "@/lib/selected-brand";

// ============================================================
// Phase 2 stub — the Mission Control page has moved to
// /dashboard/b/[slug]. This resolves the cookie's brand and
// forwards to the URL-scoped route so bookmarks and external
// links keep working.
//
// If the user has no brand, we send them to /dashboard/welcome
// (the onboarding entry point), same as the old page did.
// ============================================================

export const dynamic = "force-dynamic";

export default async function DashboardIndex() {
  const { brand } = await getSelectedBrand();
  if (!brand) redirect("/dashboard/welcome");
  redirect(`/dashboard/b/${brand.slug}`);
}
