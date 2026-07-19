import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { brand, allBrands } = await getSelectedBrand();

  return (
    <DashboardShell
      brands={allBrands}
      selectedBrandId={brand?.id ?? null}
      email={user.email ?? null}
    >
      {children}
    </DashboardShell>
  );
}
