import { redirect } from "next/navigation";
import { getSelectedBrand } from "@/lib/selected-brand";

// Phase 2 redirect stub — see /dashboard/b/[slug]/competitors.
export const dynamic = "force-dynamic";

export default async function CompetitorsRedirect() {
  const { brand } = await getSelectedBrand();
  if (!brand) redirect("/dashboard/welcome");
  redirect(`/dashboard/b/${brand.slug}/competitors`);
}
