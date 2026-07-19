import { redirect } from "next/navigation";
import { getSelectedBrand } from "@/lib/selected-brand";

export const dynamic = "force-dynamic";

// Phase 2b redirect stub. Real page lives under /dashboard/b/[slug]/answer-blocks.
// This shell reads the selected-brand cookie so old bookmarks / internal links
// keep working; if there's no brand yet, we land the user at onboarding.
export default async function Redirect() {
  const { brand } = await getSelectedBrand();
  if (!brand) redirect("/dashboard/welcome");
  redirect(`/dashboard/b/${brand.slug}/answer-blocks`);
}
