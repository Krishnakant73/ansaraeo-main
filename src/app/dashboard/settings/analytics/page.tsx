import { redirect } from "next/navigation";
import { getSelectedBrand } from "@/lib/selected-brand";

export const dynamic = "force-dynamic";

// Phase 2b redirect stub. Real page lives under /dashboard/b/[slug]/settings/analytics.
export default async function Redirect() {
  const { brand } = await getSelectedBrand();
  if (!brand) redirect("/dashboard/welcome");
  redirect(`/dashboard/b/${brand.slug}/settings/analytics`);
}
