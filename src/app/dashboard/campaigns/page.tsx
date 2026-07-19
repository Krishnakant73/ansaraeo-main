import { redirect } from "next/navigation";
import { getSelectedBrand } from "@/lib/selected-brand";

// Phase 2 redirect stub — see /dashboard/b/[slug]/campaigns.
export const dynamic = "force-dynamic";

export default async function CampaignsRedirect() {
  const { brand } = await getSelectedBrand();
  if (!brand) redirect("/dashboard/welcome");
  redirect(`/dashboard/b/${brand.slug}/campaigns`);
}
